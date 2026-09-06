import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  EconomyTransactionReason,
  Prisma,
  type ResourceType,
} from '@prisma/client';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import type { DevelopmentPlayerContext } from '../player/player-context.service';
import {
  calculateGuildLevelProgression,
  GUILD_PERK_DEFINITIONS,
  GUILD_TREASURY_DEFAULT_CAPACITY,
  GUILD_XP_PER_GOLD_DONATION,
  MIN_TREASURY_DONATION_GOLD,
} from './guild-perk.config';
import type {
  DonateToTreasuryDto,
  UpgradeGuildPerkDto,
} from './guild-treasury.dto';
import {
  GUILD_PERK_TYPES,
  type DonateToTreasuryResponse,
  type GuildPerkStatus,
  type GuildPerkType,
  type GuildTreasuryDonationItem,
  type GuildTreasuryOverviewResponse,
  type ResourceAmounts,
  type UpgradeGuildPerkResponse,
} from '@crown-and-coin/shared';

@Injectable()
export class GuildTreasuryService {
  constructor(private readonly prisma: PrismaService) {}

  async resolvePlayerId(context: DevelopmentPlayerContext): Promise<string> {
    const account = await this.prisma.platformAccount.findUnique({
      where: {
        platform_externalUserId: {
          platform: 'WEB',
          externalUserId: context.externalUserId,
        },
      },
      select: { playerId: true },
    });
    if (account) return account.playerId;

    const directPlayer = await this.prisma.player.findUnique({
      where: { id: context.externalUserId },
      select: { id: true },
    });
    if (directPlayer) return directPlayer.id;

    try {
      const created = await this.prisma.player.create({
        data: {
          displayName: 'Warden of Dawnkeep',
          platformAccounts: {
            create: {
              platform: 'WEB',
              externalUserId: context.externalUserId,
              verifiedAt: new Date(),
            },
          },
        },
        select: { id: true },
      });
      return created.id;
    } catch {
      throw new NotFoundException('Player account not found');
    }
  }

  /**
   * Retrieves the guild treasury overview including level progression, current bank balance,
   * active perks & upgrade statuses, recent contributions, and caller privileges.
   */
  async getTreasuryOverview(playerId: string): Promise<GuildTreasuryOverviewResponse> {
    const membership = await this.prisma.guildMember.findUnique({
      where: { playerId },
      include: {
        guild: {
          include: {
            perks: true,
            treasuryDonations: {
              orderBy: { createdAt: 'desc' },
              take: 10,
              include: {
                donor: { select: { displayName: true } },
              },
            },
          },
        },
      },
    });

    if (!membership) {
      throw new BadRequestException('You must be a member of a guild to access the Treasury.');
    }

    const { guild } = membership;
    const progression = calculateGuildLevelProgression(guild.xp);

    // Sync guild level in DB if changed
    if (progression.level !== guild.level) {
      await this.prisma.guild.update({
        where: { id: guild.id },
        data: { level: progression.level },
      });
      guild.level = progression.level;
    }

    const isOfficerOrLeader = membership.role === 'LEADER' || membership.role === 'OFFICER';

    // Map all 4 perks with their current status and upgrade conditions
    const perkStatuses: GuildPerkStatus[] = GUILD_PERK_TYPES.map((type) => {
      const def = GUILD_PERK_DEFINITIONS[type];
      const activePerk = guild.perks.find((p) => p.perkType === type);
      const currentLevel = activePerk?.level ?? 0;
      const currentTier = def.levels.find((l) => l.level === currentLevel);
      const nextTier = def.levels.find((l) => l.level === currentLevel + 1) ?? null;

      let canUpgrade = false;
      let lockReason: GuildPerkStatus['lockReason'];

      if (!nextTier) {
        lockReason = 'MAX_LEVEL';
      } else if (!isOfficerOrLeader) {
        lockReason = 'OFFICER_OR_LEADER_REQUIRED';
      } else if (guild.level < nextTier.requiredGuildLevel) {
        lockReason = 'INSUFFICIENT_LEVEL';
      } else if (guild.treasuryGold < BigInt(nextTier.costTreasuryGold)) {
        lockReason = 'INSUFFICIENT_TREASURY';
      } else {
        canUpgrade = true;
      }

      return {
        type,
        name: def.name,
        currentLevel,
        maxLevel: def.maxLevel,
        currentBonusValue: currentTier?.bonusValue ?? 0,
        currentBonusDescription: currentTier?.description ?? 'No active perk bonus',
        nextLevel: nextTier,
        canUpgrade,
        lockReason,
      };
    });

    // Format recent donations
    const recentDonations: GuildTreasuryDonationItem[] = guild.treasuryDonations.map((d) => ({
      id: d.id,
      donorId: d.donorId,
      donorName: d.donor.displayName || 'Guild Mate',
      amount: d.amount.toString(),
      createdAt: d.createdAt.toISOString(),
    }));

    // Player contribution total
    const playerContributionSum = await this.prisma.guildTreasuryDonation.aggregate({
      where: {
        guildId: guild.id,
        donorId: playerId,
      },
      _sum: { amount: true },
    });

    return {
      guildId: guild.id,
      guildName: guild.name,
      guildLevel: guild.level,
      guildXp: guild.xp,
      nextLevelXp: progression.nextLevelXp,
      xpProgressPct: progression.progressPct,
      treasuryGold: guild.treasuryGold.toString(),
      treasuryCapacity: GUILD_TREASURY_DEFAULT_CAPACITY,
      canDonate: true,
      canUpgradePerks: isOfficerOrLeader,
      currentUserRole: membership.role,
      perks: perkStatuses,
      recentDonations,
      playerContributionTotal: (playerContributionSum._sum.amount ?? 0n).toString(),
    };
  }

  /**
   * Donate gold from kingdom balance to the guild treasury.
   * Awards Guild XP and increases guild level if thresholds are met.
   */
  async donateToTreasury(
    playerId: string,
    dto: DonateToTreasuryDto,
  ): Promise<DonateToTreasuryResponse> {
    const donateAmount = BigInt(dto.amount.trim());
    if (donateAmount < BigInt(MIN_TREASURY_DONATION_GOLD)) {
      throw new BadRequestException(
        `Minimum treasury donation is ${MIN_TREASURY_DONATION_GOLD} Gold`,
      );
    }

    const membership = await this.prisma.guildMember.findUnique({
      where: { playerId },
      include: { guild: true },
    });
    if (!membership) {
      throw new BadRequestException('You must be a member of a guild to donate.');
    }

    const kingdom = await this.prisma.kingdom.findUnique({
      where: { playerId },
      include: {
        resourceBalances: true,
      },
    });
    if (!kingdom) {
      throw new NotFoundException('Kingdom not found for player');
    }

    const goldBalance = kingdom.resourceBalances.find((b) => b.resource === 'GOLD');
    if (!goldBalance || goldBalance.amount < donateAmount) {
      throw new BadRequestException('Insufficient gold in your kingdom vault to donate.');
    }

    const xpAwarded = Math.floor(Number(donateAmount) / GUILD_XP_PER_GOLD_DONATION);
    const referenceId = randomUUID();

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Deduct gold from player's balance
      const balanceBefore = goldBalance.amount;
      const balanceAfter = balanceBefore - donateAmount;
      await tx.resourceBalance.update({
        where: { id: goldBalance.id },
        data: { amount: balanceAfter },
      });

      // 2. Record double-entry ledger transaction
      await tx.economyTransaction.create({
        data: {
          playerId,
          kingdomId: kingdom.id,
          balanceId: goldBalance.id,
          resourceType: 'GOLD',
          delta: -donateAmount,
          balanceBefore,
          balanceAfter,
          reason: EconomyTransactionReason.GUILD_TREASURY_DONATE,
          referenceId,
        },
      });

      // 3. Increment guild treasury & XP
      const updatedGuild = await tx.guild.update({
        where: { id: membership.guildId },
        data: {
          treasuryGold: { increment: donateAmount },
          xp: { increment: xpAwarded },
        },
      });

      // Check level progression
      const progression = calculateGuildLevelProgression(updatedGuild.xp);
      if (progression.level !== updatedGuild.level) {
        await tx.guild.update({
          where: { id: updatedGuild.id },
          data: { level: progression.level },
        });
        updatedGuild.level = progression.level;
      }

      // 4. Record treasury donation log
      await tx.guildTreasuryDonation.create({
        data: {
          guildId: membership.guildId,
          donorId: playerId,
          amount: donateAmount,
        },
      });

      // Fetch refreshed balances
      const refreshedBalances = await tx.resourceBalance.findMany({
        where: { kingdomId: kingdom.id },
      });

      return {
        treasuryGold: updatedGuild.treasuryGold.toString(),
        guildXp: updatedGuild.xp,
        guildLevel: updatedGuild.level,
        playerBalances: this.presentBalances(refreshedBalances),
        donatedAmount: donateAmount.toString(),
        xpAwarded,
      };
    });

    return result;
  }

  /**
   * Upgrade a guild perk using shared treasury funds.
   * Restricted to Guild Leaders and Officers.
   */
  async upgradePerk(
    playerId: string,
    dto: UpgradeGuildPerkDto,
  ): Promise<UpgradeGuildPerkResponse> {
    const membership = await this.prisma.guildMember.findUnique({
      where: { playerId },
      include: {
        guild: {
          include: { perks: true },
        },
      },
    });

    if (!membership) {
      throw new BadRequestException('You must be a member of a guild.');
    }

    if (membership.role !== 'LEADER' && membership.role !== 'OFFICER') {
      throw new ForbiddenException('Only Guild Leaders and Officers can upgrade perks.');
    }

    const { guild } = membership;
    const def = GUILD_PERK_DEFINITIONS[dto.perkType];
    if (!def) {
      throw new BadRequestException('Unknown guild perk type.');
    }

    const activePerk = guild.perks.find((p) => p.perkType === dto.perkType);
    const currentLevel = activePerk?.level ?? 0;
    const nextLevel = currentLevel + 1;

    if (nextLevel > def.maxLevel) {
      throw new BadRequestException('Perk is already at maximum level.');
    }

    const nextTier = def.levels.find((l) => l.level === nextLevel);
    if (!nextTier) {
      throw new BadRequestException('Next perk tier configuration missing.');
    }

    if (guild.level < nextTier.requiredGuildLevel) {
      throw new BadRequestException(
        `Requires Guild Level ${nextTier.requiredGuildLevel} to unlock this tier.`,
      );
    }

    const upgradeCost = BigInt(nextTier.costTreasuryGold);
    if (guild.treasuryGold < upgradeCost) {
      throw new BadRequestException(
        `Insufficient treasury funds. Requires ${nextTier.costTreasuryGold} Gold.`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Deduct cost from treasury
      const updatedGuild = await tx.guild.update({
        where: { id: guild.id },
        data: {
          treasuryGold: { decrement: upgradeCost },
        },
      });

      // 2. Upsert perk record
      const savedPerk = await tx.guildPerk.upsert({
        where: {
          guildId_perkType: {
            guildId: guild.id,
            perkType: dto.perkType,
          },
        },
        create: {
          guildId: guild.id,
          perkType: dto.perkType,
          level: nextLevel,
        },
        update: {
          level: nextLevel,
        },
      });

      return {
        updatedGuild,
        savedPerk,
      };
    });

    const nextNextTier = def.levels.find((l) => l.level === nextLevel + 1) ?? null;
    const remainingGold = result.updatedGuild.treasuryGold;

    const perkStatus: GuildPerkStatus = {
      type: dto.perkType,
      name: def.name,
      currentLevel: nextLevel,
      maxLevel: def.maxLevel,
      currentBonusValue: nextTier.bonusValue,
      currentBonusDescription: nextTier.description,
      nextLevel: nextNextTier,
      canUpgrade: nextNextTier
        ? guild.level >= nextNextTier.requiredGuildLevel &&
          remainingGold >= BigInt(nextNextTier.costTreasuryGold)
        : false,
      lockReason: !nextNextTier
        ? 'MAX_LEVEL'
        : guild.level < nextNextTier.requiredGuildLevel
          ? 'INSUFFICIENT_LEVEL'
          : remainingGold < BigInt(nextNextTier.costTreasuryGold)
            ? 'INSUFFICIENT_TREASURY'
            : undefined,
    };

    return {
      perk: perkStatus,
      treasuryGold: remainingGold.toString(),
      guildLevel: result.updatedGuild.level,
    };
  }

  /**
   * Helper to retrieve active perk bonus percentage or value for any gameplay subsystem.
   */
  async getPerkBonus(guildId: string, perkType: GuildPerkType): Promise<number> {
    const perk = await this.prisma.guildPerk.findUnique({
      where: {
        guildId_perkType: {
          guildId,
          perkType,
        },
      },
    });
    if (!perk || perk.level <= 0) return 0;

    const def = GUILD_PERK_DEFINITIONS[perkType];
    const tier = def.levels.find((l) => l.level === perk.level);
    return tier?.bonusValue ?? 0;
  }

  private presentBalances(rows: Array<{ resource: ResourceType; amount: bigint }>): ResourceAmounts {
    const balances: ResourceAmounts = { GOLD: '0', FOOD: '0', WOOD: '0', STONE: '0', GEMS: '0' };
    for (const row of rows) balances[row.resource] = row.amount.toString();
    return balances;
  }
}
