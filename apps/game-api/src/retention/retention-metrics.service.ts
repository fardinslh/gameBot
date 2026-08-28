import { Injectable } from '@nestjs/common';
import { EconomyAction, EconomyTransactionReason, Prisma } from '@prisma/client';
import type { RetentionMetric } from '@crown-and-coin/shared';

type Tx = Prisma.TransactionClient;
export type RetentionMetricValues = Record<RetentionMetric, bigint>;

interface MetricRange { startsAt: Date; endsAt: Date; }

@Injectable()
export class RetentionMetricsService {
  async resolve(tx: Tx, playerId: string, range?: MetricRange): Promise<RetentionMetricValues> {
    const createdAt = range ? { gte: range.startsAt, lt: range.endsAt } : undefined;
    const completedAt = range ? { gte: range.startsAt, lt: range.endsAt } : { not: null as null };
    const resolvedAt = range ? { gte: range.startsAt, lt: range.endsAt } : undefined;
    const [
      collectCount,
      collectedResources,
      upgradesStarted,
      upgradesCompleted,
      buildings,
      heroUpgrades,
      raids,
      raidWins,
      revenges,
      player,
      battles,
    ] = await Promise.all([
      tx.economyRequest.count({ where: { playerId, action: EconomyAction.COLLECT, createdAt } }),
      tx.economyTransaction.aggregate({
        where: { playerId, reason: EconomyTransactionReason.OFFLINE_PRODUCTION, createdAt },
        _sum: { delta: true },
      }),
      tx.buildingUpgrade.count({ where: { building: { kingdom: { playerId } }, startedAt: createdAt } }),
      tx.buildingUpgrade.count({ where: { building: { kingdom: { playerId } }, status: 'COMPLETED', completedAt } }),
      tx.building.findMany({ where: { kingdom: { playerId } }, select: { type: true, level: true } }),
      tx.economyRequest.count({ where: { playerId, action: EconomyAction.HERO_UPGRADE, createdAt } }),
      tx.battle.count({ where: { attackerPlayerId: playerId, type: 'RAID', resolvedAt } }),
      tx.battle.count({ where: { attackerPlayerId: playerId, type: 'RAID', winnerPlayerId: playerId, resolvedAt } }),
      tx.battle.count({ where: { attackerPlayerId: playerId, type: 'REVENGE', resolvedAt } }),
      tx.player.findUniqueOrThrow({ where: { id: playerId }, select: { trophies: true } }),
      tx.battle.findMany({
        where: { OR: [{ attackerPlayerId: playerId }, { defenderPlayerId: playerId }] },
        select: {
          attackerPlayerId: true,
          attackerTrophyBefore: true,
          attackerTrophyDelta: true,
          defenderTrophyBefore: true,
          defenderTrophyDelta: true,
        },
      }),
    ]);

    const trophyPeak = battles.reduce((peak, battle) => Math.max(
      peak,
      battle.attackerPlayerId === playerId
        ? battle.attackerTrophyBefore + battle.attackerTrophyDelta
        : battle.defenderTrophyBefore + battle.defenderTrophyDelta,
    ), player.trophies);
    const castleLevel = buildings.find((building) => building.type === 'CASTLE')?.level ?? 1;
    const totalBuildingLevels = buildings.reduce((total, building) => total + building.level, 0);

    return {
      COLLECT_COUNT: BigInt(collectCount),
      COLLECT_RESOURCE_TOTAL: collectedResources._sum.delta ?? 0n,
      BUILDING_UPGRADE_STARTED: BigInt(upgradesStarted),
      BUILDING_UPGRADE_COMPLETED: BigInt(upgradesCompleted),
      CASTLE_LEVEL_REACHED: BigInt(castleLevel),
      BUILDING_LEVEL_TOTAL: BigInt(totalBuildingLevels),
      HERO_UPGRADE_COUNT: BigInt(heroUpgrades),
      RAID_STARTED: BigInt(raids),
      RAID_COMPLETED: BigInt(raids),
      RAID_WON: BigInt(raidWins),
      REVENGE_COMPLETED: BigInt(revenges),
      TROPHY_REACHED: BigInt(trophyPeak),
    };
  }
}
