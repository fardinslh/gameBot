import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import type { DevelopmentPlayerContext } from '../player/player-context.service';
import {
  calculateGuildScore,
  generateGuildTag,
  GUILD_CREATE_COST_GOLD,
  GUILD_MAX_MEMBERS,
  GUILD_REQUEST_COOLDOWN_MS,
  GUILD_REQUEST_EXPIRES_MS,
  GUILD_REQUEST_MAX_TROOPS,
  TROOP_DONATION_REWARDS,
} from './guild.config';
import {
  calculateGuildLevelProgression,
  GUILD_XP_PER_TROOP_DONATION,
} from './guild-perk.config';
import type {
  CreateGuildDto,
  DonateTroopsDto,
  RequestTroopsDto,
} from './guild.dto';
import {
  resolveLeagueFromTrophies,
  type DonateTroopsResult,
  type GuildCrest,
  type GuildCrestEmblem,
  type GuildDetailsResponse,
  type GuildJoinPolicy,
  type GuildLeaderboardEntry,
  type GuildLeaderboardResponse,
  type GuildMemberInfo,
  type GuildOverviewResponse,
  type GuildRole,
  type GuildSummary,
  type GuildTroopRequestItem,
  type ProfileCrestKey,
  type TroopType,
} from '@crown-and-coin/shared';

@Injectable()
export class GuildService {
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

  async getOverview(playerId: string): Promise<GuildOverviewResponse> {
    const membership = await this.prisma.guildMember.findUnique({
      where: { playerId },
      include: { guild: true },
    });

    if (membership) {
      const details = await this.getGuildDetails(membership.guildId, playerId);
      return {
        inGuild: true,
        guild: details,
        suggestedGuilds: [],
        creationCostGold: GUILD_CREATE_COST_GOLD,
      };
    }

    const suggested = await this.getSuggestedGuilds(playerId);
    return {
      inGuild: false,
      guild: null,
      suggestedGuilds: suggested,
      creationCostGold: GUILD_CREATE_COST_GOLD,
    };
  }

  async getGuildDetails(guildId: string, playerId?: string): Promise<GuildDetailsResponse> {
    const guild = await this.prisma.guild.findUnique({
      where: { id: guildId },
      include: {
        members: {
          include: {
            player: {
              include: {
                kingdom: {
                  include: {
                    buildings: { where: { type: 'CASTLE' } },
                  },
                },
              },
            },
          },
          orderBy: [{ role: 'asc' }, { player: { trophies: 'desc' } }],
        },
        requests: {
          where: {
            status: 'OPEN',
            expiresAt: { gt: new Date() },
          },
          include: {
            requester: true,
            donations: {
              include: { donor: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!guild) {
      throw new NotFoundException('Guild not found');
    }

    const leaderMember = guild.members.find((m) => m.role === 'LEADER');
    const leaderName = leaderMember?.player.displayName ?? 'Unknown Leader';

    const crest: GuildCrest = {
      emblem: guild.emblem as GuildCrestEmblem,
      primaryColor: guild.primaryColor,
      secondaryColor: guild.secondaryColor,
    };

    const progression = calculateGuildLevelProgression(guild.xp);
    const summary: GuildSummary = {
      id: guild.id,
      name: guild.name,
      tag: guild.tag,
      description: guild.description,
      crest,
      joinPolicy: guild.joinPolicy as GuildJoinPolicy,
      minTrophies: guild.minTrophies,
      memberCount: guild.members.length,
      maxMembers: GUILD_MAX_MEMBERS,
      score: guild.score,
      leaderName,
      level: guild.level,
      xp: guild.xp,
      nextLevelXp: progression.nextLevelXp,
      treasuryGold: guild.treasuryGold.toString(),
    };

    const members: GuildMemberInfo[] = guild.members.map((m) => {
      const castleLevel = m.player.kingdom?.buildings[0]?.level ?? 1;
      return {
        playerId: m.playerId,
        displayName: m.player.displayName ?? 'Warden',
        role: m.role as GuildRole,
        castleLevel,
        trophies: m.player.trophies,
        league: resolveLeagueFromTrophies(m.player.trophies),
        profileCrest: (m.player.equippedProfileCrest ?? 'DEFAULT') as ProfileCrestKey,
        donationsGiven: m.donationsGiven,
        donationsReceived: m.donationsReceived,
        joinedAt: m.joinedAt.toISOString(),
      };
    });

    const requests: GuildTroopRequestItem[] = guild.requests.map((r) => {
      const donorMap = new Map<string, { displayName: string; amount: number }>();
      for (const d of r.donations) {
        const existing = donorMap.get(d.donorId);
        if (existing) {
          existing.amount += d.amount;
        } else {
          donorMap.set(d.donorId, {
            displayName: d.donor.displayName ?? 'Clanmate',
            amount: d.amount,
          });
        }
      }

      return {
        id: r.id,
        requesterId: r.requesterId,
        requesterName: r.requester.displayName ?? 'Clanmate',
        troopType: r.troopType as TroopType,
        currentDonations: r.currentDonations,
        maxDonations: r.maxDonations,
        status: r.status as any,
        createdAt: r.createdAt.toISOString(),
        expiresAt: r.expiresAt.toISOString(),
        donors: Array.from(donorMap.entries()).map(([donorId, val]) => ({
          playerId: donorId,
          displayName: val.displayName,
          amount: val.amount,
        })),
      };
    });

    const currentMember = playerId ? guild.members.find((m) => m.playerId === playerId) : null;
    const currentUserRole = currentMember ? (currentMember.role as GuildRole) : null;

    // Check request cooldown for current user
    let canRequestTroops = false;
    let nextRequestAvailableAt: string | null = null;

    if (playerId && currentMember) {
      const latestRequest = await this.prisma.guildTroopRequest.findFirst({
        where: { requesterId: playerId },
        orderBy: { createdAt: 'desc' },
      });

      if (!latestRequest) {
        canRequestTroops = true;
      } else {
        const nextTime = new Date(latestRequest.createdAt.getTime() + GUILD_REQUEST_COOLDOWN_MS);
        if (Date.now() >= nextTime.getTime()) {
          canRequestTroops = true;
        } else {
          nextRequestAvailableAt = nextTime.toISOString();
        }
      }
    }

    return {
      guild: summary,
      members,
      requests,
      currentUserRole,
      canRequestTroops,
      nextRequestAvailableAt,
    };
  }

  async createGuild(playerId: string, dto: CreateGuildDto): Promise<GuildOverviewResponse> {
    const existingMembership = await this.prisma.guildMember.findUnique({
      where: { playerId },
    });
    if (existingMembership) {
      throw new BadRequestException('You are already a member of a guild');
    }

    const trimmedName = dto.name.trim();
    const nameExists = await this.prisma.guild.findUnique({
      where: { name: trimmedName },
    });
    if (nameExists) {
      throw new BadRequestException('Guild name is already taken');
    }

    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      include: {
        kingdom: {
          include: { resourceBalances: { where: { resource: 'GOLD' } } },
        },
      },
    });

    if (!player || !player.kingdom) {
      throw new NotFoundException('Player kingdom not found');
    }

    const goldBalance = player.kingdom.resourceBalances[0];
    const currentGold = goldBalance ? BigInt(goldBalance.amount) : 0n;
    const createCost = BigInt(GUILD_CREATE_COST_GOLD);

    if (currentGold < createCost) {
      throw new BadRequestException('Insufficient gold to create guild');
    }

    let tag = generateGuildTag();
    while (await this.prisma.guild.findUnique({ where: { tag } })) {
      tag = generateGuildTag();
    }

    const initialScore = calculateGuildScore([player.trophies]);

    await this.prisma.$transaction(async (tx) => {
      await tx.resourceBalance.update({
        where: { id: goldBalance.id },
        data: { amount: currentGold - createCost },
      });

      await tx.economyTransaction.create({
        data: {
          playerId,
          kingdomId: player.kingdom!.id,
          balanceId: goldBalance.id,
          resourceType: 'GOLD',
          delta: -createCost,
          balanceBefore: currentGold,
          balanceAfter: currentGold - createCost,
          reason: 'GUILD_CREATE',
          referenceId: tag,
        },
      });

      const guild = await tx.guild.create({
        data: {
          name: trimmedName,
          tag,
          description: dto.description?.trim() ?? '',
          emblem: dto.emblem,
          primaryColor: dto.primaryColor,
          secondaryColor: dto.secondaryColor,
          joinPolicy: dto.joinPolicy,
          minTrophies: dto.minTrophies,
          score: initialScore,
        },
      });

      await tx.guildMember.create({
        data: {
          guildId: guild.id,
          playerId,
          role: 'LEADER',
        },
      });
    });

    return this.getOverview(playerId);
  }

  async searchGuilds(query?: string, minTrophies?: number): Promise<GuildSummary[]> {
    const whereClause: any = {};
    if (query && query.trim()) {
      const q = query.trim();
      whereClause.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { tag: { equals: q, mode: 'insensitive' } },
      ];
    }
    if (minTrophies !== undefined) {
      whereClause.minTrophies = { lte: minTrophies };
    }

    const guilds = await this.prisma.guild.findMany({
      where: whereClause,
      include: {
        members: {
          include: { player: true },
        },
      },
      take: 20,
      orderBy: { score: 'desc' },
    });

    return guilds.map((g) => {
      const leader = g.members.find((m) => m.role === 'LEADER');
      return {
        id: g.id,
        name: g.name,
        tag: g.tag,
        description: g.description,
        crest: {
          emblem: g.emblem as GuildCrestEmblem,
          primaryColor: g.primaryColor,
          secondaryColor: g.secondaryColor,
        },
        joinPolicy: g.joinPolicy as GuildJoinPolicy,
        minTrophies: g.minTrophies,
        memberCount: g.members.length,
        maxMembers: GUILD_MAX_MEMBERS,
        score: g.score,
        leaderName: leader?.player.displayName ?? 'Leader',
      };
    });
  }

  async getSuggestedGuilds(playerId: string): Promise<GuildSummary[]> {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      select: { trophies: true },
    });

    const playerTrophies = player?.trophies ?? 1000;

    const guilds = await this.prisma.guild.findMany({
      where: {
        joinPolicy: 'OPEN',
        minTrophies: { lte: playerTrophies },
      },
      include: {
        members: {
          include: { player: true },
        },
      },
      take: 10,
      orderBy: { score: 'desc' },
    });

    return guilds
      .filter((g) => g.members.length < GUILD_MAX_MEMBERS)
      .slice(0, 6)
      .map((g) => {
        const leader = g.members.find((m) => m.role === 'LEADER');
        return {
          id: g.id,
          name: g.name,
          tag: g.tag,
          description: g.description,
          crest: {
            emblem: g.emblem as GuildCrestEmblem,
            primaryColor: g.primaryColor,
            secondaryColor: g.secondaryColor,
          },
          joinPolicy: g.joinPolicy as GuildJoinPolicy,
          minTrophies: g.minTrophies,
          memberCount: g.members.length,
          maxMembers: GUILD_MAX_MEMBERS,
          score: g.score,
          leaderName: leader?.player.displayName ?? 'Leader',
        };
      });
  }

  async joinGuild(playerId: string, guildId: string): Promise<GuildOverviewResponse> {
    const existingMembership = await this.prisma.guildMember.findUnique({
      where: { playerId },
    });
    if (existingMembership) {
      throw new BadRequestException('You are already in a guild');
    }

    const guild = await this.prisma.guild.findUnique({
      where: { id: guildId },
      include: {
        members: {
          include: { player: true },
        },
      },
    });
    if (!guild) {
      throw new NotFoundException('Guild not found');
    }

    if (guild.members.length >= GUILD_MAX_MEMBERS) {
      throw new BadRequestException('Guild is already full');
    }

    if (guild.joinPolicy !== 'OPEN') {
      throw new BadRequestException('This guild is not open for public joining');
    }

    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      select: { trophies: true },
    });
    if (!player) {
      throw new NotFoundException('Player not found');
    }

    if (player.trophies < guild.minTrophies) {
      throw new BadRequestException(`Requires at least ${guild.minTrophies} trophies to join`);
    }

    const memberTrophies = [...guild.members.map((m) => m.player.trophies), player.trophies];
    const newScore = calculateGuildScore(memberTrophies);

    await this.prisma.$transaction(async (tx) => {
      await tx.guildMember.create({
        data: {
          guildId,
          playerId,
          role: 'MEMBER',
        },
      });

      await tx.guild.update({
        where: { id: guildId },
        data: { score: newScore },
      });
    });

    return this.getOverview(playerId);
  }

  async leaveGuild(playerId: string): Promise<GuildOverviewResponse> {
    const membership = await this.prisma.guildMember.findUnique({
      where: { playerId },
      include: {
        guild: {
          include: {
            members: {
              include: { player: true },
              orderBy: [{ role: 'asc' }, { player: { trophies: 'desc' } }],
            },
          },
        },
      },
    });

    if (!membership) {
      throw new BadRequestException('You are not in a guild');
    }

    const guild = membership.guild;
    const remainingMembers = guild.members.filter((m) => m.playerId !== playerId);

    if (remainingMembers.length === 0) {
      // Disband empty guild
      await this.prisma.guild.delete({
        where: { id: guild.id },
      });
    } else {
      await this.prisma.$transaction(async (tx) => {
        // If leader left, promote next senior member
        if (membership.role === 'LEADER') {
          const nextLeader = remainingMembers.find((m) => m.role === 'OFFICER') ?? remainingMembers[0];
          await tx.guildMember.update({
            where: { id: nextLeader.id },
            data: { role: 'LEADER' },
          });
        }

        await tx.guildMember.delete({
          where: { id: membership.id },
        });

        const newScore = calculateGuildScore(remainingMembers.map((m) => m.player.trophies));
        await tx.guild.update({
          where: { id: guild.id },
          data: { score: newScore },
        });
      });
    }

    return this.getOverview(playerId);
  }

  async kickMember(actorPlayerId: string, memberPlayerId: string): Promise<GuildDetailsResponse> {
    if (actorPlayerId === memberPlayerId) {
      throw new BadRequestException('Cannot kick yourself');
    }

    const actor = await this.prisma.guildMember.findUnique({
      where: { playerId: actorPlayerId },
    });
    if (!actor || (actor.role !== 'LEADER' && actor.role !== 'OFFICER')) {
      throw new ForbiddenException('Only guild Leaders and Officers can kick members');
    }

    const target = await this.prisma.guildMember.findUnique({
      where: { playerId: memberPlayerId },
      include: { player: true },
    });
    if (!target || target.guildId !== actor.guildId) {
      throw new NotFoundException('Member not found in your guild');
    }

    if (actor.role === 'OFFICER' && (target.role === 'LEADER' || target.role === 'OFFICER')) {
      throw new ForbiddenException('Officers cannot kick other Officers or the Leader');
    }

    await this.prisma.guildMember.delete({
      where: { id: target.id },
    });

    // Recalculate score
    const remaining = await this.prisma.guildMember.findMany({
      where: { guildId: actor.guildId },
      include: { player: true },
    });
    const newScore = calculateGuildScore(remaining.map((m) => m.player.trophies));
    await this.prisma.guild.update({
      where: { id: actor.guildId },
      data: { score: newScore },
    });

    return this.getGuildDetails(actor.guildId, actorPlayerId);
  }

  async setMemberRole(
    leaderPlayerId: string,
    memberPlayerId: string,
    newRole: 'OFFICER' | 'MEMBER',
  ): Promise<GuildDetailsResponse> {
    const leader = await this.prisma.guildMember.findUnique({
      where: { playerId: leaderPlayerId },
    });
    if (!leader || leader.role !== 'LEADER') {
      throw new ForbiddenException('Only the guild Leader can change member roles');
    }

    const target = await this.prisma.guildMember.findUnique({
      where: { playerId: memberPlayerId },
    });
    if (!target || target.guildId !== leader.guildId) {
      throw new NotFoundException('Member not found in your guild');
    }

    await this.prisma.guildMember.update({
      where: { id: target.id },
      data: { role: newRole },
    });

    return this.getGuildDetails(leader.guildId, leaderPlayerId);
  }

  async requestTroops(playerId: string, dto: RequestTroopsDto): Promise<GuildDetailsResponse> {
    const membership = await this.prisma.guildMember.findUnique({
      where: { playerId },
    });
    if (!membership) {
      throw new BadRequestException('Must be in a guild to request troops');
    }

    const latestRequest = await this.prisma.guildTroopRequest.findFirst({
      where: { requesterId: playerId },
      orderBy: { createdAt: 'desc' },
    });

    if (latestRequest) {
      const cooldownElapsed = Date.now() - latestRequest.createdAt.getTime();
      if (cooldownElapsed < GUILD_REQUEST_COOLDOWN_MS) {
        throw new BadRequestException('Reinforcement request is on cooldown');
      }
    }

    // Check DONATION_CAPACITY perk
    const capacityPerk = await this.prisma.guildPerk.findUnique({
      where: {
        guildId_perkType: {
          guildId: membership.guildId,
          perkType: 'DONATION_CAPACITY',
        },
      },
    });
    const bonusCapacity =
      capacityPerk?.level === 1 ? 2 : capacityPerk?.level === 2 ? 4 : capacityPerk?.level === 3 ? 6 : 0;
    const maxDonations = GUILD_REQUEST_MAX_TROOPS + bonusCapacity;

    await this.prisma.guildTroopRequest.create({
      data: {
        guildId: membership.guildId,
        requesterId: playerId,
        troopType: dto.troopType,
        maxDonations,
        expiresAt: new Date(Date.now() + GUILD_REQUEST_EXPIRES_MS),
      },
    });

    return this.getGuildDetails(membership.guildId, playerId);
  }

  async donateTroops(donorPlayerId: string, dto: DonateTroopsDto): Promise<DonateTroopsResult> {
    const donorMembership = await this.prisma.guildMember.findUnique({
      where: { playerId: donorPlayerId },
    });
    if (!donorMembership) {
      throw new BadRequestException('Must be in a guild to donate troops');
    }

    const request = await this.prisma.guildTroopRequest.findUnique({
      where: { id: dto.requestId },
      include: { requester: { include: { kingdom: true } } },
    });

    if (!request || request.guildId !== donorMembership.guildId) {
      throw new NotFoundException('Troop request not found in your guild');
    }

    if (request.requesterId === donorPlayerId) {
      throw new BadRequestException('Cannot donate to your own request');
    }

    if (request.status !== 'OPEN' || request.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('This request is already fulfilled or expired');
    }

    const availableSlots = request.maxDonations - request.currentDonations;
    if (availableSlots <= 0) {
      throw new BadRequestException('Request is already full');
    }

    const donateAmount = Math.min(dto.amount ?? 1, availableSlots);

    // Check donor's troops
    const donorTroop = await this.prisma.playerTroop.findUnique({
      where: {
        playerId_troopType: {
          playerId: donorPlayerId,
          troopType: request.troopType,
        },
      },
    });

    if (!donorTroop || donorTroop.readyCount < donateAmount) {
      throw new BadRequestException(`Not enough ready ${request.troopType} to donate`);
    }

    const reward = TROOP_DONATION_REWARDS[request.troopType as TroopType];
    const totalGoldReward = BigInt(reward.gold) * BigInt(donateAmount);
    const totalXpReward = reward.xp * donateAmount;

    const donorKingdom = await this.prisma.kingdom.findUnique({
      where: { playerId: donorPlayerId },
      include: {
        resourceBalances: { where: { resource: 'GOLD' } },
      },
    });

    const newRequestCount = request.currentDonations + donateAmount;
    const isNowFulfilled = newRequestCount >= request.maxDonations;

    await this.prisma.$transaction(async (tx) => {
      // Deduct troop from donor
      await tx.playerTroop.update({
        where: { id: donorTroop.id },
        data: { readyCount: donorTroop.readyCount - donateAmount },
      });

      // Credit troop to requester
      await tx.playerTroop.upsert({
        where: {
          playerId_troopType: {
            playerId: request.requesterId,
            troopType: request.troopType,
          },
        },
        create: {
          playerId: request.requesterId,
          troopType: request.troopType,
          readyCount: donateAmount,
        },
        update: {
          readyCount: { increment: donateAmount },
        },
      });

      // Record donation
      await tx.guildTroopDonation.create({
        data: {
          requestId: request.id,
          donorId: donorPlayerId,
          amount: donateAmount,
        },
      });

      // Update request state
      await tx.guildTroopRequest.update({
        where: { id: request.id },
        data: {
          currentDonations: newRequestCount,
          status: isNowFulfilled ? 'FULFILLED' : 'OPEN',
        },
      });

      // Update member stats
      await tx.guildMember.update({
        where: { id: donorMembership.id },
        data: { donationsGiven: { increment: donateAmount } },
      });

      const requesterMembership = await tx.guildMember.findUnique({
        where: { playerId: request.requesterId },
      });
      if (requesterMembership) {
        await tx.guildMember.update({
          where: { id: requesterMembership.id },
          data: { donationsReceived: { increment: donateAmount } },
        });
      }

      // Award donor gold
      if (donorKingdom && donorKingdom.resourceBalances[0]) {
        const goldRow = donorKingdom.resourceBalances[0];
        const currentGold = BigInt(goldRow.amount);
        const newGold = currentGold + totalGoldReward;
        await tx.resourceBalance.update({
          where: { id: goldRow.id },
          data: { amount: newGold },
        });

        await tx.economyTransaction.create({
          data: {
            playerId: donorPlayerId,
            kingdomId: donorKingdom.id,
            balanceId: goldRow.id,
            resourceType: 'GOLD',
            delta: totalGoldReward,
            balanceBefore: currentGold,
            balanceAfter: newGold,
            reason: 'GUILD_DONATION_REWARD',
            referenceId: request.id,
          },
        });
      }

      // Increment Guild XP and check clan level progression
      const guildXpAwarded = GUILD_XP_PER_TROOP_DONATION * donateAmount;
      const updatedGuild = await tx.guild.update({
        where: { id: donorMembership.guildId },
        data: { xp: { increment: guildXpAwarded } },
      });
      const progression = calculateGuildLevelProgression(updatedGuild.xp);
      if (progression.level !== updatedGuild.level) {
        await tx.guild.update({
          where: { id: donorMembership.guildId },
          data: { level: progression.level },
        });
      }
    });

    return {
      requestId: request.id,
      status: isNowFulfilled ? 'FULFILLED' : 'OPEN',
      currentDonations: newRequestCount,
      maxDonations: request.maxDonations,
      donatedTroopType: request.troopType as TroopType,
      donatedAmount: donateAmount,
      xpAwarded: totalXpReward,
      goldAwarded: totalGoldReward.toString(),
    };
  }

  async getGuildLeaderboard(playerId?: string): Promise<GuildLeaderboardResponse> {
    const topGuildsData = await this.prisma.guild.findMany({
      take: 50,
      orderBy: [{ score: 'desc' }, { createdAt: 'asc' }],
      include: {
        members: {
          select: { playerId: true },
        },
      },
    });

    let playerGuildId: string | null = null;
    if (playerId) {
      const membership = await this.prisma.guildMember.findUnique({
        where: { playerId },
        select: { guildId: true },
      });
      if (membership) {
        playerGuildId = membership.guildId;
      }
    }

    const topGuilds: GuildLeaderboardEntry[] = topGuildsData.map((g, index) => ({
      rank: index + 1,
      guildId: g.id,
      name: g.name,
      tag: g.tag,
      crest: {
        emblem: g.emblem as GuildCrestEmblem,
        primaryColor: g.primaryColor,
        secondaryColor: g.secondaryColor,
      },
      memberCount: g.members.length,
      maxMembers: GUILD_MAX_MEMBERS,
      minTrophies: g.minTrophies,
      score: g.score,
      isPlayerGuild: playerGuildId === g.id,
    }));

    let playerGuild: GuildLeaderboardEntry | null = null;
    if (playerGuildId) {
      const existingInTop = topGuilds.find((g) => g.guildId === playerGuildId);
      if (existingInTop) {
        playerGuild = existingInTop;
      } else {
        const guild = await this.prisma.guild.findUnique({
          where: { id: playerGuildId },
          include: { members: true },
        });
        if (guild) {
          const higherCount = await this.prisma.guild.count({
            where: {
              OR: [
                { score: { gt: guild.score } },
                { score: guild.score, createdAt: { lt: guild.createdAt } },
              ],
            },
          });
          playerGuild = {
            rank: higherCount + 1,
            guildId: guild.id,
            name: guild.name,
            tag: guild.tag,
            crest: {
              emblem: guild.emblem as GuildCrestEmblem,
              primaryColor: guild.primaryColor,
              secondaryColor: guild.secondaryColor,
            },
            memberCount: guild.members.length,
            maxMembers: GUILD_MAX_MEMBERS,
            minTrophies: guild.minTrophies,
            score: guild.score,
            isPlayerGuild: true,
          };
        }
      }
    }

    return {
      topGuilds,
      playerGuild,
      serverTime: new Date().toISOString(),
    };
  }
}
