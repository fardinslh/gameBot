import { randomUUID } from 'node:crypto';
import { EconomyTransactionReason } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AnalyticsService } from '../analytics/analytics.service';
import { ArmyService } from '../army/army.service';
import { EconomyService } from '../economy/economy.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import type { DevelopmentPlayerContext } from '../player/player-context.service';
import { SHOP_CATALOG } from './shop.config';
import { ShopError } from './shop.errors';
import { ShopService } from './shop.service';

const prisma = new PrismaService();
const analytics = new AnalyticsService(prisma);
const economy = new EconomyService(prisma, new NotificationService(prisma), analytics);
const army = new ArmyService(prisma, economy, analytics);
const shop = new ShopService(prisma, economy, army, analytics);
const externalIds: string[] = [];

function context(label = 'shop-test'): DevelopmentPlayerContext {
  const externalUserId = `${label}-${randomUUID()}`;
  externalIds.push(externalUserId);
  return { platform: 'WEB', externalUserId };
}
function key(): string { return randomUUID(); }
async function code(operation: Promise<unknown>): Promise<string> {
  try { await operation; return 'NO_ERROR'; }
  catch (error) {
    if (!(error instanceof ShopError)) throw error;
    return (error.getResponse() as { code: string }).code;
  }
}
async function identity(player: DevelopmentPlayerContext) {
  const account = await prisma.platformAccount.findUniqueOrThrow({
    where: { platform_externalUserId: { platform: 'WEB', externalUserId: player.externalUserId } },
    include: { player: { include: { kingdom: true } } },
  });
  return { playerId: account.playerId, kingdomId: account.player.kingdom!.id };
}
async function setGems(kingdomId: string, amount: bigint): Promise<void> {
  await prisma.resourceBalance.update({ where: { kingdomId_resource: { kingdomId, resource: 'GEMS' } }, data: { amount } });
}

describe.sequential('Retention 05 Shop and Gem economy', () => {
  beforeAll(async () => prisma.$connect());
  afterAll(async () => {
    const accounts = await prisma.platformAccount.findMany({
      where: { platform: 'WEB', externalUserId: { in: externalIds } }, select: { playerId: true },
    });
    await prisma.player.deleteMany({ where: { id: { in: accounts.map((item) => item.playerId) } } });
    await prisma.$disconnect();
  });

  it('keeps starter Gems at 120 and exposes no Gem storage capacity', async () => {
    const player = context();
    const kingdom = await economy.getKingdom(player);
    const state = await shop.getState(player);
    expect(kingdom.balances.GEMS).toBe('120');
    expect(kingdom.storageCapacities.GEMS).toBeUndefined();
    expect(state.gemBalance).toBe('120');
    expect(state.cosmetics.map((item) => [item.itemKey, item.priceGems])).toEqual([
      ['PROFILE_CREST_FOREST', 40], ['PROFILE_CREST_CRIMSON', 70], ['PROFILE_CREST_ROYAL', 120],
    ]);
  });

  it('allows Gem rewards above the former 500 threshold while capped resources stay capped', async () => {
    const player = context();
    const initial = await economy.getKingdom(player);
    const ids = await identity(player);
    await setGems(ids.kingdomId, 499n);
    await prisma.resourceBalance.update({
      where: { kingdomId_resource: { kingdomId: ids.kingdomId, resource: 'GEMS' } },
      data: { amount: { increment: 5n } },
    });
    const refreshed = await economy.getKingdom(player);
    expect(refreshed.balances.GEMS).toBe('504');
    expect(refreshed.storageCapacities.GEMS).toBeUndefined();
    expect(refreshed.storageCapacities.GOLD).toBe(initial.storageCapacities.GOLD);
  });

  it('buys, ledgers, owns, equips, persists, replays, and returns to Default exactly', async () => {
    const player = context();
    const state = await shop.getState(player);
    const ids = await identity(player);
    const requestKey = key();
    const first = await shop.purchase(player, 'PROFILE_CREST_FOREST', undefined, requestKey);
    const replay = await shop.purchase(player, 'PROFILE_CREST_FOREST', undefined, requestKey);
    expect(replay).toEqual(first);
    expect(BigInt(state.gemBalance) - BigInt(first.gemBalance)).toBe(40n);
    expect(await prisma.shopPurchase.count({ where: { playerId: ids.playerId, itemKey: 'PROFILE_CREST_FOREST' } })).toBe(1);
    expect(await prisma.playerEntitlement.count({ where: { playerId: ids.playerId, entitlementKey: 'PROFILE_CREST_FOREST' } })).toBe(1);
    const ledger = await prisma.economyTransaction.findFirstOrThrow({ where: { referenceId: first.purchase.id } });
    expect(ledger).toMatchObject({ reason: EconomyTransactionReason.SHOP_GEM_SPEND, delta: -40n, balanceBefore: 120n, balanceAfter: 80n });
    expect(await code(shop.purchase(player, 'PROFILE_CREST_FOREST', undefined, key()))).toBe('SHOP_ITEM_ALREADY_OWNED');
    expect((await shop.equipProfileCrest(player, 'PROFILE_CREST_FOREST')).equippedProfileCrest).toBe('PROFILE_CREST_FOREST');
    expect((await shop.getState(player)).equippedProfileCrest).toBe('PROFILE_CREST_FOREST');
    expect((await shop.equipProfileCrest(player, 'DEFAULT')).equippedProfileCrest).toBe('DEFAULT');
  });

  it('rejects unknown, malformed, targeted cosmetic, and unowned equip intents without charge', async () => {
    const player = context();
    const state = await shop.getState(player);
    const ids = await identity(player);
    expect(await code(shop.purchase(player, 'UNKNOWN' as never, undefined, key()))).toBe('SHOP_ITEM_NOT_FOUND');
    expect(await code(shop.purchase(player, 'PROFILE_CREST_FOREST', 'fake-target', key()))).toBe('SHOP_INVALID_PURCHASE');
    expect(await code(shop.equipProfileCrest(player, 'PROFILE_CREST_ROYAL'))).toBe('SHOP_ENTITLEMENT_REQUIRED');
    expect(await code(shop.purchase(player, 'PROFILE_CREST_FOREST', undefined, 'short'))).toBe('INVALID_IDEMPOTENCY_KEY');
    expect((await shop.getState(player)).gemBalance).toBe(state.gemBalance);
    expect(await prisma.shopPurchase.count({ where: { playerId: ids.playerId } })).toBe(0);
  });

  it('rejects a disabled catalog item without charging or granting it', async () => {
    const player = context();
    const initial = await shop.getState(player);
    const ids = await identity(player);
    const forest = SHOP_CATALOG.find((item) => item.key === 'PROFILE_CREST_FOREST')!;
    const mutableForest = forest as { enabled: boolean };
    mutableForest.enabled = false;
    try {
      expect(await code(shop.purchase(player, forest.key, undefined, key()))).toBe('SHOP_ITEM_DISABLED');
    } finally {
      mutableForest.enabled = true;
    }
    expect((await shop.getState(player)).gemBalance).toBe(initial.gemBalance);
    expect(await prisma.shopPurchase.count({ where: { playerId: ids.playerId } })).toBe(0);
    expect(await prisma.playerEntitlement.count({ where: { playerId: ids.playerId } })).toBe(0);
  });

  it('atomically rejects insufficient Gems for every fulfillment type', async () => {
    const player = context();
    const kingdom = await economy.getKingdom(player);
    const ids = await identity(player);
    await setGems(ids.kingdomId, 0n);
    expect(await code(shop.purchase(player, 'PROFILE_CREST_FOREST', undefined, key()))).toBe('INSUFFICIENT_GEMS');
    const farm = kingdom.buildings.find((building) => building.type === 'FARM')!;
    const upgrade = await economy.upgrade(player, farm.id, key());
    expect(await code(shop.purchase(player, 'BUILDING_FINISH', upgrade.building.activeUpgrade!.id, key()))).toBe('INSUFFICIENT_GEMS');
    const training = await army.train(player, 'INFANTRY', 1, key());
    expect(await code(shop.purchase(player, 'TROOP_TRAINING_FINISH', training.training!.id, key()))).toBe('INSUFFICIENT_GEMS');
    expect(await prisma.shopPurchase.count({ where: { playerId: ids.playerId } })).toBe(0);
    expect(await prisma.playerEntitlement.count({ where: { playerId: ids.playerId } })).toBe(0);
  });

  it('serializes simultaneous permanent purchases to one charge and one entitlement', async () => {
    const player = context();
    await shop.getState(player);
    const ids = await identity(player);
    const results = await Promise.allSettled([
      shop.purchase(player, 'PROFILE_CREST_FOREST', undefined, key()),
      shop.purchase(player, 'PROFILE_CREST_FOREST', undefined, key()),
    ]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect((await shop.getState(player)).gemBalance).toBe('80');
    expect(await prisma.shopPurchase.count({ where: { playerId: ids.playerId } })).toBe(1);
    expect(await prisma.playerEntitlement.count({ where: { playerId: ids.playerId } })).toBe(1);
  });

  it('finishes a real Building Upgrade once with server price and normal notification', async () => {
    const player = context();
    const kingdom = await economy.getKingdom(player);
    const ids = await identity(player);
    const farm = kingdom.buildings.find((building) => building.type === 'FARM')!;
    const started = await economy.upgrade(player, farm.id, key());
    const upgradeId = started.building.activeUpgrade!.id;
    await prisma.buildingUpgrade.update({ where: { id: upgradeId }, data: { completesAt: new Date(Date.now() + 61_000) } });
    const offer = (await shop.getState(player)).convenience.buildingFinishes.find((item) => item.targetId === upgradeId)!;
    expect(offer.priceGems).toBe(2);
    const result = await shop.purchase(player, 'BUILDING_FINISH', upgradeId, key());
    expect(result.target).toMatchObject({ type: 'BUILDING_UPGRADE', id: upgradeId, buildingId: farm.id, level: 2, status: 'COMPLETED' });
    expect((await economy.getKingdom(player)).buildings.find((item) => item.id === farm.id)?.level).toBe(2);
    expect(await prisma.notification.count({ where: { sourceKey: `UPGRADE_COMPLETE:${upgradeId}` } })).toBe(1);
    expect(await prisma.economyTransaction.count({ where: { playerId: ids.playerId, reason: 'SHOP_GEM_SPEND', referenceId: result.purchase.id } })).toBe(1);
  });

  it('handles Building finish concurrency and natural-completion races without double charge', async () => {
    const player = context();
    const kingdom = await economy.getKingdom(player);
    const ids = await identity(player);
    const mine = kingdom.buildings.find((building) => building.type === 'MINE')!;
    const started = await economy.upgrade(player, mine.id, key());
    const upgradeId = started.building.activeUpgrade!.id;
    await prisma.buildingUpgrade.update({ where: { id: upgradeId }, data: { completesAt: new Date(Date.now() + 61_000) } });
    const before = BigInt((await shop.getState(player)).gemBalance);
    const results = await Promise.allSettled([
      shop.purchase(player, 'BUILDING_FINISH', upgradeId, key()),
      shop.purchase(player, 'BUILDING_FINISH', upgradeId, key()),
    ]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(before - BigInt((await shop.getState(player)).gemBalance)).toBe(2n);
    expect(await prisma.shopPurchase.count({ where: { playerId: ids.playerId, targetId: upgradeId } })).toBe(1);

    const lumber = (await economy.getKingdom(player)).buildings.find((building) => building.type === 'LUMBER_MILL')!;
    const natural = await economy.upgrade(player, lumber.id, key());
    const naturalId = natural.building.activeUpgrade!.id;
    await prisma.buildingUpgrade.update({ where: { id: naturalId }, data: { completesAt: new Date(Date.now() - 1_000) } });
    const gemsBeforeNatural = (await shop.getState(player)).gemBalance;
    expect(await code(shop.purchase(player, 'BUILDING_FINISH', naturalId, key()))).toBe('SHOP_TARGET_ALREADY_COMPLETE');
    expect((await shop.getState(player)).gemBalance).toBe(gemsBeforeNatural);
    expect(await prisma.shopPurchase.count({ where: { targetId: naturalId } })).toBe(0);
  });

  it('rejects cross-player Building and training targets', async () => {
    const owner = context('shop-owner');
    const stranger = context('shop-stranger');
    const kingdom = await economy.getKingdom(owner);
    await shop.getState(stranger);
    const farm = kingdom.buildings.find((building) => building.type === 'FARM')!;
    const upgrade = await economy.upgrade(owner, farm.id, key());
    const training = await army.train(owner, 'INFANTRY', 1, key());
    expect(await code(shop.purchase(stranger, 'BUILDING_FINISH', upgrade.building.activeUpgrade!.id, key()))).toBe('SHOP_TARGET_NOT_OWNER');
    expect(await code(shop.purchase(stranger, 'TROOP_TRAINING_FINISH', training.training!.id, key()))).toBe('SHOP_TARGET_NOT_OWNER');
  });

  it('finishes troop training exactly once and preserves Army power under cosmetic equip', async () => {
    const player = context();
    const initialArmy = await army.getArmy(player);
    const ids = await identity(player);
    const training = await army.train(player, 'CAVALRY', 1, key());
    const orderId = training.training!.id;
    await prisma.troopTrainingOrder.update({ where: { id: orderId }, data: { completesAt: new Date(Date.now() + 31_000) } });
    expect((await shop.getState(player)).convenience.troopTrainingFinish?.priceGems).toBe(2);
    const results = await Promise.allSettled([
      shop.purchase(player, 'TROOP_TRAINING_FINISH', orderId, key()),
      shop.purchase(player, 'TROOP_TRAINING_FINISH', orderId, key()),
    ]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect((await army.getArmy(player)).troops.find((troop) => troop.type === 'CAVALRY')?.readyCount).toBe(11);
    expect(await prisma.shopPurchase.count({ where: { playerId: ids.playerId, targetId: orderId } })).toBe(1);
    await shop.purchase(player, 'PROFILE_CREST_FOREST', undefined, key());
    await shop.equipProfileCrest(player, 'PROFILE_CREST_FOREST');
    expect((await army.getArmy(player)).power).toBe(initialArmy.power);
  });

  it('rolls back Gem debit, purchase, and ledger if target fulfillment fails', async () => {
    const player = context();
    const kingdom = await economy.getKingdom(player);
    const ids = await identity(player);
    const farm = kingdom.buildings.find((building) => building.type === 'FARM')!;
    const started = await economy.upgrade(player, farm.id, key());
    const upgradeId = started.building.activeUpgrade!.id;
    await prisma.buildingUpgrade.update({ where: { id: upgradeId }, data: { completesAt: new Date(Date.now() + 61_000) } });
    const before = (await shop.getState(player)).gemBalance;
    const spy = vi.spyOn(economy, 'completeUpgradeInTransaction').mockResolvedValueOnce(null);
    expect(await code(shop.purchase(player, 'BUILDING_FINISH', upgradeId, key()))).toBe('SHOP_TARGET_ALREADY_COMPLETE');
    spy.mockRestore();
    expect((await shop.getState(player)).gemBalance).toBe(before);
    expect(await prisma.shopPurchase.count({ where: { playerId: ids.playerId, targetId: upgradeId } })).toBe(0);
    expect(await prisma.economyTransaction.count({ where: { playerId: ids.playerId, reason: 'SHOP_GEM_SPEND' } })).toBe(0);
  });
});
