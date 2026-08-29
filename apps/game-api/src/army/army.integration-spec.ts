import { randomUUID } from 'node:crypto';
import { EconomyAction, EconomyTransactionReason } from '@prisma/client';
import type { ArmyFormationSlotInput } from '@crown-and-coin/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AnalyticsService } from '../analytics/analytics.service';
import { EconomyService } from '../economy/economy.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import type { DevelopmentPlayerContext } from '../player/player-context.service';
import { ArmyClock } from './army.clock';
import { ArmyError } from './army.errors';
import { ArmyService } from './army.service';

class MutableArmyClock extends ArmyClock {
  constructor(private current: Date) { super(); }
  override now(): Date { return new Date(this.current); }
  set(value: string): void { this.current = new Date(value); }
}

const prisma = new PrismaService();
const analytics = new AnalyticsService(prisma);
const economy = new EconomyService(prisma, new NotificationService(prisma), analytics);
const clock = new MutableArmyClock(new Date('2026-08-29T12:00:00.000Z'));
const army = new ArmyService(prisma, economy, analytics, clock);
const externalIds: string[] = [];

function context(label = 'army-test'): DevelopmentPlayerContext {
  const externalUserId = `${label}-${randomUUID()}`;
  externalIds.push(externalUserId);
  return { platform: 'WEB', externalUserId };
}

function key(): string { return randomUUID(); }

async function code(operation: Promise<unknown>): Promise<string> {
  try { await operation; return 'NO_ERROR'; }
  catch (error) {
    if (!(error instanceof ArmyError)) throw error;
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

function formationFrom(state: Awaited<ReturnType<ArmyService['getArmy']>>): ArmyFormationSlotInput[] {
  return state.formation.slots.map((slot) => ({
    slot: slot.slot,
    troopType: slot.troopType,
    unitCount: slot.unitCount,
    commanderPlayerHeroId: slot.commander.playerHeroId,
  }));
}

describe.sequential('Retention 03A Army and Commander foundation', () => {
  beforeAll(async () => prisma.$connect());
  afterAll(async () => {
    const accounts = await prisma.platformAccount.findMany({
      where: { platform: 'WEB', externalUserId: { in: externalIds } },
      select: { playerId: true },
    });
    await prisma.player.deleteMany({ where: { id: { in: accounts.map((item) => item.playerId) } } });
    await prisma.$disconnect();
  });

  it('bootstraps starter troops and the three-Commander formation exactly once', async () => {
    const player = context();
    const first = await army.getArmy(player);
    const repeated = await army.getArmy(player);
    expect(first.capacity).toEqual({ maximum: 60, ready: 45, training: 0, available: 15 });
    expect(first.troops.map((troop) => [troop.type, troop.readyCount])).toEqual([
      ['INFANTRY', 20], ['ARCHER', 15], ['CAVALRY', 10],
    ]);
    expect(first.formation.slots.map((slot) => [slot.slot, slot.troopType, slot.unitCount, slot.commander.key])).toEqual([
      [1, 'INFANTRY', 20, 'KNIGHT'],
      [2, 'ARCHER', 15, 'RANGER'],
      [3, 'CAVALRY', 10, 'MAGE'],
    ]);
    expect(repeated).toEqual(first);
    const ids = await identity(player);
    expect(await prisma.playerTroop.count({ where: { playerId: ids.playerId } })).toBe(3);
    expect(await prisma.armyFormationSlot.count({ where: { armyFormation: { playerId: ids.playerId } } })).toBe(3);
    expect(await prisma.analyticsEvent.count({ where: { playerId: ids.playerId, eventName: 'army_bootstrapped' } })).toBe(1);
  });

  it('repairs missing Army records for existing human and system Players without duplicating counts', async () => {
    for (const isSystemOpponent of [false, true]) {
      const player = context(isSystemOpponent ? 'army-system-test' : 'army-backfill-test');
      const initial = await army.getArmy(player);
      const ids = await identity(player);
      await prisma.player.update({ where: { id: ids.playerId }, data: { isSystemOpponent } });
      await prisma.playerTroop.delete({
        where: { playerId_troopType: { playerId: ids.playerId, troopType: 'ARCHER' } },
      });
      const repaired = await army.getArmy(player);
      expect(repaired.troops.find((troop) => troop.type === 'ARCHER')?.readyCount).toBe(15);
      expect(repaired.troops.find((troop) => troop.type === 'INFANTRY')?.readyCount).toBe(20);
      expect(repaired.formation).toEqual(initial.formation);
      expect(await prisma.playerTroop.count({ where: { playerId: ids.playerId } })).toBe(3);
    }
  });

  it('charges training once, writes a balanced ledger, and replays one idempotent response', async () => {
    clock.set('2026-08-29T12:00:00.000Z');
    const player = context();
    const requestKey = key();
    const [first, replay] = await Promise.all([
      army.train(player, 'INFANTRY', 5, requestKey),
      army.train(player, 'INFANTRY', 5, requestKey),
    ]);
    expect(replay).toEqual(first);
    expect(first.training).toMatchObject({ troopType: 'INFANTRY', quantity: 5, remainingSeconds: 10 });
    expect(first.capacity).toEqual({ maximum: 60, ready: 45, training: 5, available: 10 });
    expect(first.balances.FOOD).toBe('4900');
    expect(first.balances.GOLD).toBe('7975');

    const ids = await identity(player);
    expect(await prisma.troopTrainingOrder.count({ where: { playerId: ids.playerId } })).toBe(1);
    expect(await prisma.economyRequest.count({ where: { playerId: ids.playerId, action: EconomyAction.TROOP_TRAINING } })).toBe(1);
    const ledger = await prisma.economyTransaction.findMany({
      where: { playerId: ids.playerId, reason: EconomyTransactionReason.TROOP_TRAINING },
    });
    expect(ledger).toHaveLength(2);
    expect(ledger.every((row) => row.balanceAfter - row.balanceBefore === row.delta && row.delta < 0n)).toBe(true);
  });

  it('allows at most one of two simultaneous distinct training requests', async () => {
    clock.set('2026-08-29T13:00:00.000Z');
    const player = context();
    const results = await Promise.allSettled([
      army.train(player, 'INFANTRY', 1, key()),
      army.train(player, 'ARCHER', 1, key()),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    expect(rejected?.reason).toBeInstanceOf(ArmyError);
    expect((rejected!.reason as ArmyError).getResponse()).toMatchObject({ code: 'TRAINING_ALREADY_ACTIVE' });
    const ids = await identity(player);
    expect(await prisma.troopTrainingOrder.count({ where: { playerId: ids.playerId, status: 'IN_PROGRESS' } })).toBe(1);
  });

  it('rejects invalid, unaffordable, and over-capacity training without partial state', async () => {
    const invalid = context();
    expect(await code(army.train(invalid, 'SIEGE', 1, key()))).toBe('INVALID_TROOP_TYPE');
    expect(await code(army.train(invalid, 'INFANTRY', 0, key()))).toBe('INVALID_TRAINING_QUANTITY');
    expect(await code(army.train(invalid, 'INFANTRY', 26, key()))).toBe('INVALID_TRAINING_QUANTITY');

    const poor = context();
    await army.getArmy(poor);
    const poorIds = await identity(poor);
    await prisma.resourceBalance.update({
      where: { kingdomId_resource: { kingdomId: poorIds.kingdomId, resource: 'FOOD' } },
      data: { amount: 0n },
    });
    expect(await code(army.train(poor, 'INFANTRY', 5, key()))).toBe('INSUFFICIENT_RESOURCES');
    expect(await prisma.troopTrainingOrder.count({ where: { playerId: poorIds.playerId } })).toBe(0);
    expect(await prisma.economyTransaction.count({
      where: { playerId: poorIds.playerId, reason: EconomyTransactionReason.TROOP_TRAINING },
    })).toBe(0);

    const full = context();
    await army.getArmy(full);
    const fullIds = await identity(full);
    await prisma.playerTroop.updateMany({ where: { playerId: fullIds.playerId, troopType: 'INFANTRY' }, data: { readyCount: 35 } });
    expect(await code(army.train(full, 'INFANTRY', 1, key()))).toBe('ARMY_CAPACITY_EXCEEDED');
  });

  it('completes at server time exactly once across concurrent reconciliation and restart-like service reuse', async () => {
    clock.set('2026-08-29T14:00:00.000Z');
    const player = context();
    await army.train(player, 'INFANTRY', 5, key());
    clock.set('2026-08-29T14:00:09.999Z');
    expect((await army.getArmy(player)).troops[0].readyCount).toBe(20);
    clock.set('2026-08-29T14:00:10.000Z');
    const restartedService = new ArmyService(prisma, economy, analytics, clock);
    const [first, second] = await Promise.all([army.getArmy(player), restartedService.getArmy(player)]);
    expect(first.troops[0].readyCount).toBe(25);
    expect(second.troops[0].readyCount).toBe(25);
    expect((await army.getArmy(player)).troops[0].readyCount).toBe(25);
    const ids = await identity(player);
    expect(await prisma.troopTrainingOrder.count({ where: { playerId: ids.playerId, status: 'COMPLETED' } })).toBe(1);
    expect(await prisma.analyticsEvent.count({ where: { playerId: ids.playerId, eventName: 'troop_training_completed' } })).toBe(1);
  });

  it('persists valid formations and rejects duplicate, foreign, disabled, invalid, and excessive assignments', async () => {
    const player = context();
    const initial = await army.getArmy(player);
    const reordered = formationFrom(initial).map((slot, index, all) => ({
      ...slot,
      commanderPlayerHeroId: all[(index + 1) % all.length].commanderPlayerHeroId,
    }));
    const saved = await army.saveFormation(player, reordered);
    expect((await army.getArmy(player)).formation).toEqual(saved.formation);

    const duplicate = formationFrom(initial);
    duplicate[1].commanderPlayerHeroId = duplicate[0].commanderPlayerHeroId;
    expect(await code(army.saveFormation(player, duplicate))).toBe('FORMATION_COMMANDER_DUPLICATE');
    expect(await code(army.saveFormation(player, reordered.slice(0, 2)))).toBe('FORMATION_INVALID');
    expect(await code(army.saveFormation(player, reordered.map((slot, index) => ({ ...slot, slot: index === 2 ? 2 : slot.slot }))))).toBe('FORMATION_INVALID');
    expect(await code(army.saveFormation(player, reordered.map((slot, index) => ({ ...slot, unitCount: index === 0 ? 0 : slot.unitCount }))))).toBe('FORMATION_INVALID');
    expect(await code(army.saveFormation(player, reordered.map((slot, index) => ({ ...slot, unitCount: index === 0 ? 21 : slot.unitCount }))))).toBe('FORMATION_TROOP_COUNT_EXCEEDED');

    const other = context();
    const otherState = await army.getArmy(other);
    const foreign = formationFrom(initial);
    foreign[0].commanderPlayerHeroId = otherState.commanders[0].playerHeroId;
    expect(await code(army.saveFormation(player, foreign))).toBe('COMMANDER_NOT_OWNED');

    const mage = initial.commanders.find((commander) => commander.key === 'MAGE')!;
    const mageRow = await prisma.playerHero.findUniqueOrThrow({
      where: { id: mage.playerHeroId },
      include: { heroDefinition: true },
    });
    await prisma.heroDefinition.update({ where: { id: mageRow.heroDefinitionId }, data: { enabled: false } });
    try {
      const alreadyBootstrappedEconomy = { getKingdom: async () => ({}) } as unknown as EconomyService;
      const validationService = new ArmyService(prisma, alreadyBootstrappedEconomy, analytics, clock);
      expect(await code(validationService.saveFormation(player, formationFrom(initial)))).toBe('COMMANDER_DISABLED');
    } finally {
      await prisma.heroDefinition.update({ where: { id: mageRow.heroDefinitionId }, data: { enabled: true } });
    }

    const ids = await identity(player);
    await prisma.playerTroop.updateMany({ where: { playerId: ids.playerId }, data: { readyCount: 30 } });
    const overCapacity = reordered.map((slot) => ({ ...slot, unitCount: 25 }));
    expect(await code(army.saveFormation(player, overCapacity))).toBe('ARMY_CAPACITY_EXCEEDED');
  });

  it('serializes formation save with due training completion under one authoritative lock', async () => {
    clock.set('2026-08-29T15:00:00.000Z');
    const player = context();
    const initial = await army.getArmy(player);
    await army.train(player, 'INFANTRY', 5, key());
    const formation = formationFrom(initial).map((slot) => (
      slot.troopType === 'INFANTRY' ? { ...slot, unitCount: 25 } : slot
    ));
    clock.set('2026-08-29T15:00:10.000Z');
    const [saved, state] = await Promise.all([
      army.saveFormation(player, formation),
      army.getArmy(player),
    ]);
    expect(saved.formation.slots[0].unitCount).toBe(25);
    expect(state.troops.find((troop) => troop.type === 'INFANTRY')?.readyCount).toBe(25);
    expect((await army.getArmy(player)).formation.slots[0].unitCount).toBe(25);
  });
});
