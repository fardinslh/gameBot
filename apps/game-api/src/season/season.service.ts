import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  type ClaimSeasonRewardResponse,
  type SeasonOverviewResponse,
  type SeasonRewardTier,
  type SeasonSummary,
  type TrophyLeague,
  SEASON_REWARD_TIERS,
  resolveLeagueFromTrophies,
} from '@crown-and-coin/shared';
import {
  EconomyTransactionReason,
  Prisma,
  SeasonStatus,
  TrophyLeague as PrismaTrophyLeague,
} from '@prisma/client';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import {
  SEASON_DURATION_MS,
  calculateTrophySoftReset,
  getSeasonName,
} from './season.config';

@Injectable()
export class SeasonService {
  constructor(private readonly prisma: PrismaService) {}

  async resolvePlayerId(context: { externalUserId: string }): Promise<string> {
    const account = await this.prisma.platformAccount.findUnique({
      where: {
        platform_externalUserId: {
          platform: 'WEB',
          externalUserId: context.externalUserId,
        },
      },
      select: { playerId: true },
    });
    if (!account) {
      throw new NotFoundException('Player account not found');
    }
    return account.playerId;
  }

  /**
   * Get or automatically initialize the currently active ranked season.
   */
  async getOrCreateCurrentSeason(): Promise<{
    id: string;
    seasonNumber: number;
    name: string;
    status: SeasonStatus;
    startsAt: Date;
    endsAt: Date;
  }> {
    const now = new Date();
    let currentSeason = await this.prisma.season.findFirst({
      where: { status: SeasonStatus.ACTIVE },
      orderBy: { seasonNumber: 'desc' },
    });

    if (!currentSeason) {
      const lastSeason = await this.prisma.season.findFirst({
        orderBy: { seasonNumber: 'desc' },
      });
      const seasonNumber = (lastSeason?.seasonNumber ?? 0) + 1;
      const startsAt = now;
      const endsAt = new Date(now.getTime() + SEASON_DURATION_MS);

      currentSeason = await this.prisma.season.create({
        data: {
          seasonNumber,
          name: getSeasonName(seasonNumber),
          status: SeasonStatus.ACTIVE,
          startsAt,
          endsAt,
        },
      });
    }

    return currentSeason;
  }

  /**
   * Fetch complete season overview, personal standing, projected rewards, and previous season loot.
   */
  async getSeasonOverview(playerId: string): Promise<SeasonOverviewResponse> {
    const currentSeason = await this.getOrCreateCurrentSeason();
    const now = Date.now();
    const endsAtMs = currentSeason.endsAt.getTime();
    const timeRemainingSeconds = Math.max(0, Math.floor((endsAtMs - now) / 1000));

    // Resolve player and trophies
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      include: {
        kingdom: {
          select: { id: true, level: true },
        },
      },
    });

    if (!player) {
      throw new NotFoundException('Player not found');
    }

    // Ensure player has a season record for the current active season
    const currentRecord = await this.prisma.playerSeasonRecord.upsert({
      where: {
        playerId_seasonId: {
          playerId,
          seasonId: currentSeason.id,
        },
      },
      create: {
        playerId,
        seasonId: currentSeason.id,
        startingTrophies: player.trophies,
        peakTrophies: player.trophies,
      },
      update: {
        peakTrophies: {
          // Keep highest peak
          set: player.trophies,
        },
      },
    });

    // Make sure peakTrophies is at least current trophies
    const effectivePeakTrophies = Math.max(currentRecord.peakTrophies, player.trophies);
    if (effectivePeakTrophies > currentRecord.peakTrophies) {
      await this.prisma.playerSeasonRecord.update({
        where: { id: currentRecord.id },
        data: { peakTrophies: effectivePeakTrophies },
      });
    }

    const currentLeague = resolveLeagueFromTrophies(player.trophies);
    const projectedReward = SEASON_REWARD_TIERS[currentLeague];

    // Find any ended previous season with claimable or recent record
    const previousEndedRecord = await this.prisma.playerSeasonRecord.findFirst({
      where: {
        playerId,
        season: {
          status: SeasonStatus.ENDED,
        },
      },
      include: { season: true },
      orderBy: { season: { seasonNumber: 'desc' } },
    });

    let previousSeasonInfo: SeasonOverviewResponse['playerStanding']['previousSeason'] = null;
    if (previousEndedRecord) {
      const endingTrophies = previousEndedRecord.endingTrophies ?? previousEndedRecord.peakTrophies;
      const endingLeague = (previousEndedRecord.endingLeague as TrophyLeague) ?? resolveLeagueFromTrophies(endingTrophies);
      previousSeasonInfo = {
        seasonNumber: previousEndedRecord.season.seasonNumber,
        seasonName: previousEndedRecord.season.name,
        endingTrophies,
        endingLeague,
        rewardsClaimed: previousEndedRecord.rewardsClaimed,
        reward: SEASON_REWARD_TIERS[endingLeague],
      };
    }

    // Fetch Top 5 Guilds for Season Standings
    const topGuildsRaw = await this.prisma.guild.findMany({
      take: 5,
      orderBy: [{ score: 'desc' }, { warWins: 'desc' }],
      select: {
        id: true,
        name: true,
        tag: true,
        emblem: true,
        score: true,
      },
    });

    const topGuilds = topGuildsRaw.map((g, idx) => ({
      rank: idx + 1,
      id: g.id,
      name: g.name,
      tag: g.tag,
      emblem: g.emblem,
      score: g.score,
    }));

    const rewardTiersList: SeasonRewardTier[] = [
      SEASON_REWARD_TIERS.CHAMPION,
      SEASON_REWARD_TIERS.MASTER,
      SEASON_REWARD_TIERS.CRYSTAL,
      SEASON_REWARD_TIERS.GOLD,
      SEASON_REWARD_TIERS.SILVER,
      SEASON_REWARD_TIERS.BRONZE,
    ];

    const currentSummary: SeasonSummary = {
      id: currentSeason.id,
      seasonNumber: currentSeason.seasonNumber,
      name: currentSeason.name,
      status: 'ACTIVE',
      startsAt: currentSeason.startsAt.toISOString(),
      endsAt: currentSeason.endsAt.toISOString(),
      timeRemainingSeconds,
    };

    return {
      currentSeason: currentSummary,
      playerStanding: {
        currentTrophies: player.trophies,
        currentLeague,
        peakTrophies: effectivePeakTrophies,
        projectedReward,
        previousSeason: previousSeasonInfo,
      },
      rewardTiers: rewardTiersList,
      topGuilds,
    };
  }

  /**
   * Claim unclaimed season rewards from the most recent ended season.
   */
  async claimPreviousSeasonRewards(playerId: string): Promise<ClaimSeasonRewardResponse> {
    const unclaimedRecord = await this.prisma.playerSeasonRecord.findFirst({
      where: {
        playerId,
        rewardsClaimed: false,
        season: { status: SeasonStatus.ENDED },
      },
      include: {
        season: true,
        player: {
          include: {
            kingdom: {
              include: { resourceBalances: true },
            },
          },
        },
      },
      orderBy: { season: { seasonNumber: 'desc' } },
    });

    if (!unclaimedRecord) {
      throw new BadRequestException('No unclaimed season rewards found');
    }

    const kingdom = unclaimedRecord.player.kingdom;
    if (!kingdom) {
      throw new BadRequestException('Player kingdom not found');
    }

    const endingTrophies = unclaimedRecord.endingTrophies ?? unclaimedRecord.peakTrophies;
    const endingLeague = (unclaimedRecord.endingLeague as TrophyLeague) ?? resolveLeagueFromTrophies(endingTrophies);
    const reward = SEASON_REWARD_TIERS[endingLeague];
    const now = new Date();
    const referenceId = randomUUID();

    await this.prisma.$transaction(async (tx) => {
      // 1. Credit GEMS
      const gemsBalance = kingdom.resourceBalances.find((b) => b.resource === 'GEMS');
      if (gemsBalance) {
        const balanceBefore = gemsBalance.amount;
        const balanceAfter = balanceBefore + BigInt(reward.gems);
        await tx.resourceBalance.update({
          where: { id: gemsBalance.id },
          data: { amount: balanceAfter },
        });
        await tx.economyTransaction.create({
          data: {
            playerId,
            kingdomId: kingdom.id,
            balanceId: gemsBalance.id,
            resourceType: 'GEMS',
            delta: BigInt(reward.gems),
            balanceBefore,
            balanceAfter,
            reason: EconomyTransactionReason.SEASON_REWARD,
            referenceId,
          },
        });
      }

      // 2. Credit GOLD
      const goldBalance = kingdom.resourceBalances.find((b) => b.resource === 'GOLD');
      if (goldBalance) {
        const goldGain = BigInt(reward.gold);
        const balanceBefore = goldBalance.amount;
        const balanceAfter = balanceBefore + goldGain;
        await tx.resourceBalance.update({
          where: { id: goldBalance.id },
          data: { amount: balanceAfter },
        });
        await tx.economyTransaction.create({
          data: {
            playerId,
            kingdomId: kingdom.id,
            balanceId: goldBalance.id,
            resourceType: 'GOLD',
            delta: goldGain,
            balanceBefore,
            balanceAfter,
            reason: EconomyTransactionReason.SEASON_REWARD,
            referenceId,
          },
        });
      }

      // 3. Mark Record as claimed
      await tx.playerSeasonRecord.update({
        where: { id: unclaimedRecord.id },
        data: {
          rewardsClaimed: true,
          claimedAt: now,
        },
      });
    });

    return {
      seasonNumber: unclaimedRecord.season.seasonNumber,
      gemsAwarded: reward.gems,
      goldAwarded: reward.gold,
      endingLeague,
      titleAwarded: reward.title,
      claimedAt: now.toISOString(),
    };
  }

  /**
   * Dev Fast-Forward Simulator:
   * Finalizes the active season, archives player season standings, executes trophy soft-resets,
   * marks current season ENDED, and spins up the subsequent active season.
   */
  async simulateEndSeason(): Promise<SeasonSummary> {
    const currentSeason = await this.getOrCreateCurrentSeason();
    const now = new Date();

    // 1. Finalize all active season records with ending trophies and ending league
    const allRecords = await this.prisma.playerSeasonRecord.findMany({
      where: { seasonId: currentSeason.id },
      include: { player: true },
    });

    for (const record of allRecords) {
      const finalTrophies = record.player.trophies;
      const finalLeague = resolveLeagueFromTrophies(finalTrophies);
      await this.prisma.playerSeasonRecord.update({
        where: { id: record.id },
        data: {
          endingTrophies: finalTrophies,
          endingLeague: finalLeague as PrismaTrophyLeague,
          peakTrophies: Math.max(record.peakTrophies, finalTrophies),
        },
      });

      // Execute trophy soft-reset for high-tier players
      const resetTrophies = calculateTrophySoftReset(finalTrophies);
      if (resetTrophies !== finalTrophies) {
        await this.prisma.player.update({
          where: { id: record.playerId },
          data: { trophies: resetTrophies },
        });
      }
    }

    // 2. Mark current season as ENDED
    await this.prisma.season.update({
      where: { id: currentSeason.id },
      data: {
        status: SeasonStatus.ENDED,
        endsAt: now,
      },
    });

    // 3. Spin up the next active season
    const nextSeasonNumber = currentSeason.seasonNumber + 1;
    const nextEndsAt = new Date(now.getTime() + SEASON_DURATION_MS);
    const nextSeason = await this.prisma.season.create({
      data: {
        seasonNumber: nextSeasonNumber,
        name: getSeasonName(nextSeasonNumber),
        status: SeasonStatus.ACTIVE,
        startsAt: now,
        endsAt: nextEndsAt,
      },
    });

    return {
      id: nextSeason.id,
      seasonNumber: nextSeason.seasonNumber,
      name: nextSeason.name,
      status: 'ACTIVE',
      startsAt: nextSeason.startsAt.toISOString(),
      endsAt: nextSeason.endsAt.toISOString(),
      timeRemainingSeconds: Math.floor(SEASON_DURATION_MS / 1000),
    };
  }
}
