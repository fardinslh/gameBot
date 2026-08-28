import { randomUUID } from 'node:crypto';
import { EconomyAction, EconomyTransactionReason } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AnalyticsService } from '../analytics/analytics.service';
import { EconomyService } from '../economy/economy.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import type { DevelopmentPlayerContext } from '../player/player-context.service';
import { RetentionClock } from './retention-clock.service';
import { RetentionError } from './retention.errors';
import { RetentionMetricsService } from './retention-metrics.service';
import { RetentionService } from './retention.service';

class MutableClock extends RetentionClock {
  constructor(private current: Date) { super(); }
  override now(): Date { return new Date(this.current); }
  set(value: string): void { this.current = new Date(value); }
}

const prisma = new PrismaService();
const analytics = new AnalyticsService(prisma);
const economy = new EconomyService(prisma, new NotificationService(prisma), analytics);
const clock = new MutableClock(new Date('2026-08-29T12:00:00.000Z'));
const retention = new RetentionService(prisma, economy, new RetentionMetricsService(), analytics, clock);

function context(): DevelopmentPlayerContext {
  const externalUserId = `retention-test-${randomUUID()}`;
  return { platform: 'WEB', externalUserId };
}

function key(): string { return randomUUID(); }

async function code(operation: Promise<unknown>): Promise<string> {
  try { await operation; return 'NO_ERROR'; }
  catch (error) {
    if (!(error instanceof RetentionError)) throw error;
    return (error.getResponse() as { code: string }).code;
  }
}

async function identity(player: DevelopmentPlayerContext): Promise<{ playerId: string; kingdomId: string }> {
  const account = await prisma.platformAccount.findUniqueOrThrow({
    where: { platform_externalUserId: { platform: 'WEB', externalUserId: player.externalUserId } },
    include: { player: { include: { kingdom: true } } },
  });
  return { playerId: account.playerId, kingdomId: account.player.kingdom!.id };
}

async function seedMetric(player: DevelopmentPlayerContext, metric: string, target: bigint): Promise<void> {
  const ids = await identity(player);
  const now = clock.now();
  if (metric === 'COLLECT_COUNT' || metric === 'HERO_UPGRADE_COUNT') {
    const action = metric === 'COLLECT_COUNT' ? EconomyAction.COLLECT : EconomyAction.HERO_UPGRADE;
    for (let index = 0; index < Number(target); index += 1) {
      await prisma.economyRequest.create({ data: { playerId: ids.playerId, idempotencyKey: key(), action, response: {}, createdAt: now } });
    }
    return;
  }
  if (metric === 'BUILDING_UPGRADE_STARTED' || metric === 'BUILDING_UPGRADE_COMPLETED') {
    const buildings = await prisma.building.findMany({ where: { kingdomId: ids.kingdomId }, take: Number(target) });
    for (let index = 0; index < Number(target); index += 1) {
      const completed = metric === 'BUILDING_UPGRADE_COMPLETED';
      await prisma.buildingUpgrade.create({ data: {
        buildingId: buildings[index % buildings.length].id,
        fromLevel: 1,
        toLevel: 2,
        status: completed ? 'COMPLETED' : 'IN_PROGRESS',
        startedAt: now,
        completesAt: completed ? now : new Date(now.getTime() + 60_000),
        completedAt: completed ? now : null,
      } });
    }
    return;
  }
  if (metric === 'RAID_COMPLETED' || metric === 'RAID_WON') {
    const defender = await prisma.player.create({ data: { displayName: 'Retention defender' } });
    for (let index = 0; index < Number(target); index += 1) {
      const id = randomUUID();
      await prisma.battle.create({ data: {
        id,
        type: 'RAID',
        status: 'REWARDED',
        attackerPlayerId: ids.playerId,
        defenderPlayerId: defender.id,
        winnerPlayerId: metric === 'RAID_WON' ? ids.playerId : defender.id,
        result: metric === 'RAID_WON' ? 'ATTACKER_WIN' : 'DEFENDER_WIN',
        seed: id,
        rulesVersion: 1,
        durationMs: 8_000,
        attackerTrophyBefore: 1000,
        defenderTrophyBefore: 1000,
        attackerTrophyDelta: 0,
        defenderTrophyDelta: 0,
        loot: { GOLD: '0', FOOD: '0', WOOD: '0', STONE: '0' },
        startedAt: now,
        resolvedAt: now,
      } });
    }
    return;
  }
  throw new Error(`Unsupported mission fixture metric ${metric}`);
}

describe.sequential('Retention 02 authoritative integration', () => {
  beforeAll(async () => prisma.$connect());
  afterAll(async () => {
    const accounts = await prisma.platformAccount.findMany({
      where: { platform: 'WEB', externalUserId: { startsWith: 'retention-test-' } },
      select: { playerId: true },
    });
    const playerIds = accounts.map((item) => item.playerId);
    await prisma.battle.deleteMany({
      where: { OR: [{ attackerPlayerId: { in: playerIds } }, { defenderPlayerId: { in: playerIds } }] },
    });
    await prisma.player.deleteMany({ where: { id: { in: playerIds } } });
    await prisma.player.deleteMany({ where: { displayName: 'Retention defender', platformAccounts: { none: {} } } });
    await prisma.$disconnect();
  });

  it('creates stable three-item Daily and Weekly sets using UTC server periods', async () => {
    clock.set('2026-08-29T12:00:00.000Z');
    const player = context();
    const first = await retention.getState(player);
    const repeated = await retention.getState(player);
    expect(first.daily.missions).toHaveLength(3);
    expect(first.weekly.missions).toHaveLength(3);
    expect(repeated.daily.missions.map((item) => item.id)).toEqual(first.daily.missions.map((item) => item.id));
    expect(first.dailyResetAt).toBe('2026-08-30T00:00:00.000Z');
    expect(first.weeklyResetAt).toBe('2026-08-31T00:00:00.000Z');
    expect(first.achievements.families).toHaveLength(9);
    clock.set('2026-08-30T12:00:00.000Z');
    const nextDay = await retention.getState(player);
    expect(nextDay.daily.periodKey).toBe('2026-08-30');
    expect(nextDay.daily.missions.map((item) => item.id)).not.toEqual(first.daily.missions.map((item) => item.id));
  });

  it('tracks, claims, and expires Weekly missions across the Monday UTC boundary', async () => {
    clock.set('2026-08-29T12:00:00.000Z');
    const player = context();
    const initial = await retention.getState(player);
    for (const mission of initial.weekly.missions) await seedMetric(player, mission.metric, BigInt(mission.target));
    const completed = await retention.getState(player);
    expect(completed.weekly.completedCount).toBe(3);

    const mission = completed.weekly.missions[0];
    const requestKey = key();
    const claimed = await retention.claimMission(player, mission.id, requestKey);
    expect(await retention.claimMission(player, mission.id, requestKey)).toEqual(claimed);
    expect(await code(retention.claimMission(player, mission.id, key()))).toBe('MISSION_ALREADY_CLAIMED');

    const expiredMission = completed.weekly.missions[1];
    clock.set('2026-08-31T00:00:01.000Z');
    const nextWeek = await retention.getState(player);
    expect(nextWeek.weekly.periodKey).toBe('2026-08-31');
    expect(nextWeek.weekly.missions.map((item) => item.id)).not.toEqual(initial.weekly.missions.map((item) => item.id));
    expect(await code(retention.claimMission(player, expiredMission.id, key()))).toBe('MISSION_EXPIRED');
  });

  it('derives mission progress from authoritative facts and atomically grants each reward once', async () => {
    clock.set('2026-08-29T12:00:00.000Z');
    const player = context();
    const initial = await retention.getState(player);
    for (const mission of initial.daily.missions) await seedMetric(player, mission.metric, BigInt(mission.target));
    const completed = await retention.getState(player);
    expect(completed.daily.completedCount).toBe(3);
    expect(completed.daily.completionBonus.eligible).toBe(true);

    const mission = completed.daily.missions[0];
    const requestKey = key();
    const claimed = await retention.claimMission(player, mission.id, requestKey);
    const replay = await retention.claimMission(player, mission.id, requestKey);
    expect(replay).toEqual(claimed);
    expect(await code(retention.claimMission(player, mission.id, key()))).toBe('MISSION_ALREADY_CLAIMED');
    const ids = await identity(player);
    const ledger = await prisma.economyTransaction.findMany({ where: { playerId: ids.playerId, referenceId: `mission:${mission.id}` } });
    expect(ledger).toHaveLength(mission.rewards.length);
    expect(ledger.every((row) => row.balanceAfter - row.balanceBefore === row.delta && row.delta > 0n)).toBe(true);

    const bonus = await retention.claimDailyBonus(player, key());
    expect(bonus.granted.some((item) => item.resource === 'GEMS')).toBe(true);
    expect(await code(retention.claimDailyBonus(player, key()))).toBe('DAILY_BONUS_ALREADY_CLAIMED');
  });

  it('rejects incomplete, foreign, and expired mission claims', async () => {
    clock.set('2026-08-29T12:00:00.000Z');
    const owner = context();
    const stranger = context();
    const state = await retention.getState(owner);
    await retention.getState(stranger);
    expect(await code(retention.claimMission(owner, state.daily.missions[0].id, key()))).toBe('MISSION_INCOMPLETE');
    expect(await code(retention.claimMission(stranger, state.daily.missions[0].id, key()))).toBe('MISSION_NOT_OWNER');
    clock.set('2026-08-30T12:00:00.000Z');
    expect(await code(retention.claimMission(owner, state.daily.missions[0].id, key()))).toBe('MISSION_EXPIRED');
  });

  it('reconstructs current-state achievements and enforces ordered exactly-once tier claims', async () => {
    clock.set('2026-08-29T12:00:00.000Z');
    const player = context();
    const initial = await retention.getState(player);
    const ids = await identity(player);
    await prisma.building.updateMany({ where: { kingdomId: ids.kingdomId, type: 'CASTLE' }, data: { level: 5 } });
    const state = await retention.getState(player);
    const ruler = state.achievements.families.find((item) => item.key === 'KINGDOM_RULER')!;
    expect(ruler.progress).toBe('5');
    expect(await code(retention.claimAchievement(player, 'KINGDOM_RULER', 2, key()))).toBe('ACHIEVEMENT_TIER_OUT_OF_ORDER');
    await retention.claimAchievement(player, 'KINGDOM_RULER', 1, key());
    const results = await Promise.allSettled([
      retention.claimAchievement(player, 'KINGDOM_RULER', 2, key()),
      retention.claimAchievement(player, 'KINGDOM_RULER', 2, key()),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.economyTransaction.count({ where: { playerId: ids.playerId, reason: EconomyTransactionReason.ACHIEVEMENT_REWARD } })).toBeGreaterThan(0);
    expect(initial.achievements.families.find((item) => item.key === 'MASTER_BUILDER')?.progress).toBe('9');
  });

  it('allows one Daily Return claim per server day, survives missed days, and wraps after Day 7', async () => {
    const player = context();
    clock.set('2026-08-01T12:00:00.000Z');
    const requestKey = key();
    const first = await retention.claimDailyReturn(player, requestKey);
    expect((await retention.claimDailyReturn(player, requestKey))).toEqual(first);
    expect(await code(retention.claimDailyReturn(player, key()))).toBe('DAILY_RETURN_ALREADY_CLAIMED');

    for (let day = 2; day <= 7; day += 1) {
      clock.set(`2026-08-${String(day * 2 - 1).padStart(2, '0')}T12:00:00.000Z`);
      const claim = await retention.claimDailyReturn(player, key());
      expect(claim.granted.length).toBeGreaterThan(0);
    }
    clock.set('2026-08-16T12:00:00.000Z');
    const wrapped = await retention.getState(player);
    expect(wrapped.dailyReturn.currentDay).toBe(1);
    expect(wrapped.dailyReturn.canClaimToday).toBe(true);
    const ids = await identity(player);
    expect(await prisma.dailyReturnClaim.count({ where: { playerId: ids.playerId } })).toBe(7);
  });

  it('serializes simultaneous Daily Return claims to one settlement', async () => {
    clock.set('2026-08-29T12:00:00.000Z');
    const player = context();
    const results = await Promise.allSettled([retention.claimDailyReturn(player, key()), retention.claimDailyReturn(player, key())]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const ids = await identity(player);
    expect(await prisma.dailyReturnClaim.count({ where: { playerId: ids.playerId } })).toBe(1);
    const rows = await prisma.economyTransaction.findMany({ where: { playerId: ids.playerId, reason: EconomyTransactionReason.DAILY_RETURN_REWARD } });
    expect(rows.every((row) => row.balanceAfter - row.balanceBefore === row.delta)).toBe(true);
  });
});
