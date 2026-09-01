import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AnalyticsService } from '../analytics/analytics.service';
import { ArmyService } from '../army/army.service';
import { EconomyService } from '../economy/economy.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import type { DevelopmentPlayerContext } from '../player/player-context.service';
import { EngagementService } from './engagement.service';
import { RetentionClock } from './retention-clock.service';
import { RetentionMetricsService } from './retention-metrics.service';
import { RetentionService } from './retention.service';

const prisma = new PrismaService();
const analytics = new AnalyticsService(prisma);
const economy = new EconomyService(prisma, new NotificationService(prisma), analytics);
const metrics = new RetentionMetricsService();
const retention = new RetentionService(prisma, economy, metrics, analytics, new RetentionClock());
const army = new ArmyService(prisma, economy, analytics);
const engagement = new EngagementService(prisma, economy, army, retention, metrics, analytics);

function context(): DevelopmentPlayerContext {
  return { platform: 'WEB', externalUserId: `engagement-test-${randomUUID()}` };
}

async function identity(player: DevelopmentPlayerContext): Promise<{ playerId: string; kingdomId: string }> {
  const account = await prisma.platformAccount.findUniqueOrThrow({
    where: { platform_externalUserId: { platform: 'WEB', externalUserId: player.externalUserId } },
    include: { player: { include: { kingdom: true } } },
  });
  return { playerId: account.playerId, kingdomId: account.player.kingdom!.id };
}

async function completeFirstLoop(player: DevelopmentPlayerContext): Promise<void> {
  await engagement.getOverview(player);
  const ids = await identity(player);
  await prisma.onboardingProgress.upsert({
    where: { playerId: ids.playerId },
    create: { playerId: ids.playerId, status: 'COMPLETED', currentStep: 'COMPLETE', completedAt: new Date() },
    update: { status: 'COMPLETED', currentStep: 'COMPLETE', completedAt: new Date() },
  });
  await prisma.building.updateMany({ where: { kingdomId: ids.kingdomId, type: 'CASTLE' }, data: { level: 2 } });
  await prisma.economyRequest.createMany({ data: [1, 2].map(() => ({ playerId: ids.playerId, idempotencyKey: randomUUID(), action: 'COLLECT', response: {} })) });
  const defender = await prisma.player.create({ data: { displayName: 'Engagement defender' } });
  for (let index = 0; index < 2; index += 1) {
    const id = randomUUID();
    await prisma.battle.create({ data: {
      id, type: 'RAID', status: 'REWARDED', attackerPlayerId: ids.playerId, defenderPlayerId: defender.id,
      winnerPlayerId: ids.playerId, result: 'ATTACKER_WIN', seed: id, rulesVersion: 1, durationMs: 8_000,
      attackerTrophyBefore: 1000, defenderTrophyBefore: 1000, attackerTrophyDelta: 1, defenderTrophyDelta: -1,
      loot: { GOLD: '10', FOOD: '0', WOOD: '0', STONE: '0' }, startedAt: new Date(), resolvedAt: new Date(),
    } });
  }
}

describe.sequential('Phase A engagement cohesion', () => {
  beforeAll(async () => prisma.$connect());
  afterAll(async () => {
    const accounts = await prisma.platformAccount.findMany({ where: { platform: 'WEB', externalUserId: { startsWith: 'engagement-test-' } }, select: { playerId: true } });
    const playerIds = accounts.map((item) => item.playerId);
    await prisma.battle.deleteMany({ where: { OR: [{ attackerPlayerId: { in: playerIds } }, { defenderPlayerId: { in: playerIds } }] } });
    await prisma.player.deleteMany({ where: { id: { in: playerIds } } });
    await prisma.player.deleteMany({ where: { displayName: 'Engagement defender', platformAccounts: { none: {} } } });
    await prisma.$disconnect();
  });

  it('derives Royal Decree tasks from existing authoritative facts and settles once', async () => {
    const player = context();
    await completeFirstLoop(player);
    const ready = await engagement.getOverview(player);
    expect(ready.royalDecree).toMatchObject({ available: true, claimable: true, claimed: false });
    expect(ready.royalDecree.tasks.every((task) => task.completed)).toBe(true);

    const requestKey = randomUUID();
    const claimed = await engagement.claimRoyalDecree(player, requestKey);
    expect(await engagement.claimRoyalDecree(player, requestKey)).toEqual(claimed);
    expect(claimed.engagement.royalDecree.claimed).toBe(true);
    const ids = await identity(player);
    expect(await prisma.economyTransaction.count({ where: { playerId: ids.playerId, reason: 'ROYAL_DECREE_REWARD' } })).toBe(3);
  });

  it('shows one idempotent return summary only after a meaningful absence', async () => {
    const player = context();
    await engagement.getOverview(player);
    const ids = await identity(player);
    const lastSeenAt = new Date(Date.now() - 3_600_000);
    await prisma.playerEngagementState.create({ data: { playerId: ids.playerId, lastSeenAt } });
    const farm = await prisma.building.findFirstOrThrow({ where: { kingdomId: ids.kingdomId, type: 'FARM' } });
    await prisma.buildingUpgrade.create({ data: { buildingId: farm.id, fromLevel: 1, toLevel: 2, status: 'COMPLETED', startedAt: lastSeenAt, completesAt: new Date(), completedAt: new Date() } });
    const first = await engagement.openSession(player, randomUUID());
    expect(first.returnSummary?.awaySeconds).toBeGreaterThanOrEqual(3_599);
    expect(first.returnSummary?.completedUpgrades).toContainEqual({ buildingType: 'FARM', fromLevel: 1, toLevel: 2 });
    const immediate = await engagement.openSession(player, randomUUID());
    expect(immediate.returnSummary).toBeNull();
  });
});
