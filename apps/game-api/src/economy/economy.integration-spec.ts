import { randomUUID } from 'node:crypto';
import { EconomyTransactionReason } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import type { DevelopmentPlayerContext } from '../player/player-context.service';
import { EconomyService } from './economy.service';
import { EconomyError } from './economy.errors';
import { upgradeDurationSeconds } from './economy.config';

const prisma = new PrismaService();
const notifications = new NotificationService(prisma);
const economy = new EconomyService(prisma, notifications);

function context(): DevelopmentPlayerContext {
  return { platform: 'WEB', externalUserId: `test-${randomUUID()}` };
}

function key(): string {
  return randomUUID();
}

async function errorCode(operation: Promise<unknown>): Promise<string> {
  try {
    await operation;
    return 'NO_ERROR';
  } catch (error) {
    if (!(error instanceof EconomyError)) throw error;
    return (error.getResponse() as { code: string }).code;
  }
}

describe.sequential('authoritative economy integration', () => {
  beforeAll(async () => prisma.$connect());
  afterAll(async () => prisma.$disconnect());

  it('bootstraps deterministic balances and required buildings once', async () => {
    const player = context();
    const first = await economy.getKingdom(player);
    const second = await economy.getKingdom(player);
    expect(first.balances).toEqual({ GOLD: '8000', FOOD: '5000', WOOD: '5000', STONE: '3500', GEMS: '120' });
    expect(first.buildings).toHaveLength(9);
    expect(first.progression).toEqual({ level: 1, xp: 0, xpIntoLevel: 0, xpRequiredForNextLevel: 900 });
    expect(first.storageCapacities.GOLD).toBe('10000');
    expect(first.buildings.find((building) => building.type === 'ACADEMY')).toMatchObject({ unlocked: false, unlockCastleLevel: 3 });
    expect(second.kingdom.id).toBe(first.kingdom.id);
    expect(await prisma.kingdom.count({ where: { playerId: first.player.id } })).toBe(1);
  });

  it('exposes exactly the server-authoritative unlock sequence', async () => {
    const player = context();
    const initial = await economy.getKingdom(player);
    const castle = initial.buildings.find((building) => building.type === 'CASTLE')!;
    expect(initial.buildings.filter((building) => building.unlocked).map((building) => building.type).sort()).toEqual([
      'CASTLE', 'FARM', 'GRAND_MARKET', 'LUMBER_MILL', 'MINE',
    ]);
    const expected = new Map([[2, 6], [3, 7], [4, 8], [5, 9]]);
    for (const [level, count] of expected) {
      await prisma.building.update({ where: { id: castle.id }, data: { level } });
      expect((await economy.getKingdom(player)).buildings.filter((building) => building.unlocked)).toHaveLength(count);
    }
  });

  it('backfills missing Phase 07 buildings without changing legacy balances', async () => {
    const player = context();
    const initial = await economy.getKingdom(player);
    const academy = initial.buildings.find((building) => building.type === 'ACADEMY')!;
    await prisma.building.delete({ where: { id: academy.id } });
    const restored = await economy.getKingdom(player);
    expect(restored.buildings).toHaveLength(9);
    expect(restored.buildings.find((building) => building.type === 'ACADEMY')).toMatchObject({ level: 1, unlocked: false });
    expect(restored.balances).toEqual(initial.balances);
  });

  it('collects once, logs exact transactions, and makes an immediate repeat harmless', async () => {
    const player = context();
    const initial = await economy.getKingdom(player);
    await prisma.kingdom.update({ where: { id: initial.kingdom.id }, data: { lastCollectedAt: new Date(Date.now() - 3_600_000) } });
    const collected = await economy.collect(player, key());
    const repeated = await economy.collect(player, key());
    expect(BigInt(collected.gains.FOOD)).toBeGreaterThanOrEqual(500n);
    expect(Object.values(repeated.gains).every((gain) => gain === '0')).toBe(true);
    const transactions = await prisma.economyTransaction.findMany({
      where: { kingdomId: initial.kingdom.id, reason: EconomyTransactionReason.OFFLINE_PRODUCTION },
    });
    expect(transactions).toHaveLength(4);
    for (const transaction of transactions) {
      expect(transaction.balanceAfter - transaction.balanceBefore).toBe(transaction.delta);
      expect(transaction.delta.toString()).toBe(collected.gains[transaction.resourceType]);
    }
  });

  it('serializes simultaneous Collect calls so only one reward window is granted', async () => {
    const player = context();
    const initial = await economy.getKingdom(player);
    await prisma.kingdom.update({ where: { id: initial.kingdom.id }, data: { lastCollectedAt: new Date(Date.now() - 3_600_000) } });
    const [first, second] = await Promise.all([economy.collect(player, key()), economy.collect(player, key())]);
    const totalFood = BigInt(first.gains.FOOD) + BigInt(second.gains.FOOD);
    expect(totalFood).toBeGreaterThanOrEqual(500n);
    expect([first.gains.FOOD, second.gains.FOOD].filter((gain) => gain !== '0')).toHaveLength(1);
  });

  it('replays identical idempotency keys without duplicate rewards', async () => {
    const player = context();
    const initial = await economy.getKingdom(player);
    await prisma.kingdom.update({ where: { id: initial.kingdom.id }, data: { lastCollectedAt: new Date(Date.now() - 3_600_000) } });
    const requestKey = key();
    const first = await economy.collect(player, requestKey);
    const replay = await economy.collect(player, requestKey);
    expect(replay).toEqual(first);
    expect(await prisma.economyRequest.count({ where: { playerId: initial.player.id, idempotencyKey: requestKey } })).toBe(1);
  });

  it('starts one upgrade, deducts exact costs, logs charges, and rejects a second start', async () => {
    const player = context();
    const initial = await economy.getKingdom(player);
    const farm = initial.buildings.find((building) => building.type === 'FARM')!;
    const upgraded = await economy.upgrade(player, farm.id, key());
    expect(upgraded.building.activeUpgrade?.toLevel).toBe(2);
    for (const cost of farm.upgradeCost) {
      expect(BigInt(initial.balances[cost.resource]) - BigInt(upgraded.balances[cost.resource])).toBe(BigInt(cost.amount));
    }
    const charges = await prisma.economyTransaction.findMany({
      where: { referenceId: upgraded.building.activeUpgrade!.id, reason: EconomyTransactionReason.BUILDING_UPGRADE },
    });
    expect(charges).toHaveLength(farm.upgradeCost.length);
    expect(charges.every((charge) => charge.delta < 0n && charge.balanceAfter >= 0n)).toBe(true);
    expect(await errorCode(economy.upgrade(player, farm.id, key()))).toBe('UPGRADE_ALREADY_ACTIVE');
  });

  it('serializes simultaneous Upgrade calls and deducts resources only once', async () => {
    const player = context();
    const initial = await economy.getKingdom(player);
    const farm = initial.buildings.find((building) => building.type === 'FARM')!;
    const results = await Promise.allSettled([
      economy.upgrade(player, farm.id, key()),
      economy.upgrade(player, farm.id, key()),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const current = await economy.getKingdom(player);
    for (const cost of farm.upgradeCost) {
      expect(BigInt(initial.balances[cost.resource]) - BigInt(current.balances[cost.resource])).toBe(BigInt(cost.amount));
    }
    expect(await prisma.buildingUpgrade.count({ where: { buildingId: farm.id, status: 'IN_PROGRESS' } })).toBe(1);
  });

  it('rejects insufficient funds, wrong ownership, Castle gates, and maximum level', async () => {
    const poorPlayer = context();
    const poor = await economy.getKingdom(poorPlayer);
    const poorFarm = poor.buildings.find((building) => building.type === 'FARM')!;
    await prisma.resourceBalance.updateMany({ where: { kingdomId: poor.kingdom.id }, data: { amount: 0n } });
    expect(await errorCode(economy.upgrade(poorPlayer, poorFarm.id, key()))).toBe('INSUFFICIENT_RESOURCES');

    const owner = context();
    const stranger = context();
    const owned = await economy.getKingdom(owner);
    await economy.getKingdom(stranger);
    expect(await errorCode(economy.upgrade(stranger, owned.buildings[0].id, key()))).toBe('NOT_BUILDING_OWNER');

    const gatedPlayer = context();
    const gated = await economy.getKingdom(gatedPlayer);
    const gatedFarm = gated.buildings.find((building) => building.type === 'FARM')!;
    await prisma.building.update({ where: { id: gatedFarm.id }, data: { level: 3 } });
    expect(await errorCode(economy.upgrade(gatedPlayer, gatedFarm.id, key()))).toBe('CASTLE_LEVEL_REQUIRED');

    const maxPlayer = context();
    const max = await economy.getKingdom(maxPlayer);
    const maxFarm = max.buildings.find((building) => building.type === 'FARM')!;
    await prisma.building.update({ where: { id: maxFarm.id }, data: { level: 20 } });
    expect(await errorCode(economy.upgrade(maxPlayer, maxFarm.id, key()))).toBe('MAX_LEVEL');
  });

  it('does not complete early, completes after finishAt, and reconciles idempotently', async () => {
    const player = context();
    const initial = await economy.getKingdom(player);
    const farm = initial.buildings.find((building) => building.type === 'FARM')!;
    const started = await economy.upgrade(player, farm.id, key());
    const before = await economy.getKingdom(player);
    expect(before.buildings.find((building) => building.id === farm.id)?.level).toBe(1);
    await prisma.buildingUpgrade.update({
      where: { id: started.building.activeUpgrade!.id },
      data: { completesAt: new Date(Date.now() - 1_000) },
    });
    const completed = await economy.getKingdom(player);
    const repeated = await economy.getKingdom(player);
    expect(completed.buildings.find((building) => building.id === farm.id)?.level).toBe(2);
    expect(repeated.buildings.find((building) => building.id === farm.id)?.level).toBe(2);
    expect(await prisma.buildingUpgrade.count({ where: { id: started.building.activeUpgrade!.id, status: 'COMPLETED' } })).toBe(1);
    const created = await prisma.notification.findMany({
      where: { playerId: initial.player.id, sourceKey: `UPGRADE_COMPLETE:${started.building.activeUpgrade!.id}` },
    });
    expect(created).toHaveLength(1);
    expect(created[0].type).toBe('UPGRADE_COMPLETE');
    expect(created[0].payload).toMatchObject({ buildingId: farm.id, buildingType: 'FARM', level: 2 });
    expect(created[0].deepLinkIntent).toEqual({ screen: 'BUILDING', buildingId: farm.id });
  });

  it('collects a completed building upgrade explicitly and rejects an early collection', async () => {
    const player = context();
    const initial = await economy.getKingdom(player);
    const farm = initial.buildings.find((building) => building.type === 'FARM')!;
    const started = await economy.upgrade(player, farm.id, key());
    expect(started.building.remainingSeconds).toBeGreaterThan(0);
    expect(await errorCode(economy.collectCompletedUpgrade(player, farm.id, key()))).toBe('UPGRADE_NOT_READY');
    await prisma.buildingUpgrade.update({
      where: { id: started.building.activeUpgrade!.id },
      data: { completesAt: new Date(Date.now() - 1_000) },
    });
    const completed = await economy.collectCompletedUpgrade(player, farm.id, key());
    expect(completed.building.level).toBe(2);
    expect(completed.building.nextLevel).toBe(3);
    expect(completed.building.upgradeFinishedAt).not.toBeNull();
  });

  it('caps collected production at the Castle-derived storage limit', async () => {
    const player = context();
    const initial = await economy.getKingdom(player);
    await prisma.resourceBalance.updateMany({
      where: { kingdomId: initial.kingdom.id, resource: 'FOOD' },
      data: { amount: 9_900n },
    });
    await prisma.kingdom.update({ where: { id: initial.kingdom.id }, data: { lastCollectedAt: new Date(Date.now() - 3_600_000) } });
    const collected = await economy.collect(player, key());
    expect(collected.gains.FOOD).toBe('100');
    expect(collected.balances.FOOD).toBe('10000');
  });

  it('applies the Academy bonus to offline production before the storage cap', async () => {
    const player = context();
    const initial = await economy.getKingdom(player);
    await prisma.building.updateMany({ where: { kingdomId: initial.kingdom.id, type: 'CASTLE' }, data: { level: 3 } });
    await prisma.building.updateMany({ where: { kingdomId: initial.kingdom.id, type: 'ACADEMY' }, data: { level: 2 } });
    await prisma.resourceBalance.updateMany({ where: { kingdomId: initial.kingdom.id, resource: { not: 'GEMS' } }, data: { amount: 0n } });
    await prisma.kingdom.update({ where: { id: initial.kingdom.id }, data: { lastCollectedAt: new Date(Date.now() - 3_600_000) } });
    const state = await economy.getKingdom(player);
    expect(state.buildings.find((building) => building.type === 'ACADEMY')?.effects).toEqual([
      { type: 'PRODUCTION_BONUS', valueBps: 100, nextLevelValueBps: 200 },
    ]);
    const collected = await economy.collect(player, key());
    expect(BigInt(collected.gains.FOOD)).toBeGreaterThanOrEqual(505n);
    expect(BigInt(collected.gains.WOOD)).toBeGreaterThanOrEqual(424n);
    expect(collected.gains.GEMS).toBe('0');
  });

  it('uses Workshop speed only when starting an upgrade and never rewrites its finish timestamp', async () => {
    const player = context();
    const initial = await economy.getKingdom(player);
    const farm = initial.buildings.find((building) => building.type === 'FARM')!;
    await prisma.building.updateMany({ where: { kingdomId: initial.kingdom.id, type: 'CASTLE' }, data: { level: 4 } });
    await prisma.building.update({ where: { id: farm.id }, data: { level: 10 } });
    await prisma.building.updateMany({ where: { kingdomId: initial.kingdom.id, type: 'WORKSHOP' }, data: { level: 16 } });
    await prisma.resourceBalance.updateMany({ where: { kingdomId: initial.kingdom.id }, data: { amount: 10_000_000n } });
    const before = await economy.getKingdom(player);
    const discountedDuration = before.buildings.find((building) => building.id === farm.id)!.upgradeDurationSeconds!;
    expect(discountedDuration).toBeLessThan(upgradeDurationSeconds('FARM', 10));
    const started = await economy.upgrade(player, farm.id, key());
    const immutableFinish = started.building.activeUpgrade!.finishAt;
    await prisma.building.updateMany({ where: { kingdomId: initial.kingdom.id, type: 'WORKSHOP' }, data: { level: 1 } });
    const refreshed = await economy.getKingdom(player);
    expect(refreshed.buildings.find((building) => building.id === farm.id)?.activeUpgrade?.finishAt).toBe(immutableFinish);
  });
});
