import { randomUUID } from 'node:crypto';
import { EconomyTransactionReason } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EconomyService } from '../economy/economy.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import type { DevelopmentPlayerContext } from '../player/player-context.service';
import { RaidError } from './raid.errors';
import { RaidFixtureService } from './raid-fixture.service';
import { RaidRateLimiter } from './raid-rate-limiter.service';
import { RaidService } from './raid.service';

const prisma = new PrismaService();
const economy = new EconomyService(prisma);
const fixtures = new RaidFixtureService(prisma, economy);
const raids = new RaidService(prisma, economy, fixtures, new RaidRateLimiter());

function context(prefix = 'raid'): DevelopmentPlayerContext {
  return { platform: 'WEB', externalUserId: `${prefix}-${randomUUID()}` };
}

async function player(contextValue: DevelopmentPlayerContext) {
  const kingdom = await economy.getKingdom(contextValue);
  return { id: kingdom.player.id, kingdomId: kingdom.kingdom.id };
}

async function offer(attackerId: string, defenderId: string, expired = false): Promise<string> {
  const row = await prisma.raidMatchOffer.create({
    data: {
      attackerPlayerId: attackerId, defenderPlayerId: defenderId, attackerPower: 1, defenderPower: 1,
      potentialLoot: { GOLD: '0', FOOD: '0', WOOD: '0', STONE: '0' },
      expiresAt: new Date(Date.now() + (expired ? -1_000 : 180_000)),
    },
  });
  return row.id;
}

async function code(operation: Promise<unknown>): Promise<string> {
  try { await operation; return 'NO_ERROR'; }
  catch (error) {
    if (!(error instanceof RaidError)) throw error;
    return (error.getResponse() as { code: string }).code;
  }
}

describe.sequential('authoritative Raid integration', () => {
  beforeAll(async () => prisma.$connect());
  afterAll(async () => prisma.$disconnect());

  it('creates owned offers, excludes self, and avoids an immediate repeat when population allows', async () => {
    const attacker = context('matchmaking');
    const first = await raids.search(attacker);
    const second = await raids.search(attacker);
    expect(first.offer.opponent.id).not.toBe(first.player.id);
    expect(first.offer.id).not.toBe(second.offer.id);
    expect(first.offer.opponent.id).not.toBe(second.offer.opponent.id);
    const persisted = await prisma.raidMatchOffer.findUniqueOrThrow({ where: { id: first.offer.id } });
    expect(persisted.attackerPlayerId).toBe(first.player.id);
    expect(persisted.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects expired and foreign offers without creating a Battle', async () => {
    const ownerContext = context('offer-owner');
    const strangerContext = context('offer-stranger');
    const defenderContext = context('offer-defender');
    const owner = await player(ownerContext);
    const stranger = await player(strangerContext);
    const defender = await player(defenderContext);
    const expiredId = await offer(owner.id, defender.id, true);
    const foreignId = await offer(owner.id, defender.id);
    expect(await code(raids.start(ownerContext, expiredId, randomUUID()))).toBe('MATCH_OFFER_EXPIRED');
    expect(await code(raids.start(strangerContext, foreignId, randomUUID()))).toBe('MATCH_OFFER_NOT_OWNER');
    expect(await prisma.battle.count({ where: { matchOfferId: { in: [expiredId, foreignId] } } })).toBe(0);
    expect(stranger.id).not.toBe(owner.id);
    await expect(offer(owner.id, owner.id)).rejects.toBeTruthy();
  });

  it('rejects an invalid three-Hero team and rolls the attempted settlement back', async () => {
    const attackerContext = context('invalid-team');
    const defenderContext = context('valid-defender');
    const attacker = await player(attackerContext);
    const defender = await player(defenderContext);
    const team = await prisma.raidTeam.findUniqueOrThrow({ where: { playerId: attacker.id }, include: { slots: true } });
    const foreignHero = await prisma.playerHero.findFirstOrThrow({ where: { playerId: defender.id } });
    await prisma.raidTeamSlot.update({ where: { id: team.slots[2].id }, data: { playerHeroId: foreignHero.id } });
    const offerId = await offer(attacker.id, defender.id);
    const trophiesBefore = (await prisma.player.findUniqueOrThrow({ where: { id: attacker.id } })).trophies;
    expect(await code(raids.start(attackerContext, offerId, randomUUID()))).toBe('INVALID_RAID_TEAM');
    expect(await prisma.battle.count({ where: { matchOfferId: offerId } })).toBe(0);
    expect((await prisma.player.findUniqueOrThrow({ where: { id: attacker.id } })).trophies).toBe(trophiesBefore);
  });

  it('settles one Battle exactly once and authorizes replay access', async () => {
    const attackerContext = context('idempotent-attacker');
    const defenderContext = context('idempotent-defender');
    const unrelatedContext = context('unrelated');
    const attacker = await player(attackerContext);
    const defender = await player(defenderContext);
    await player(unrelatedContext);
    await prisma.playerHero.updateMany({ where: { playerId: attacker.id }, data: { level: 12 } });
    const offerId = await offer(attacker.id, defender.id);
    const requestKey = randomUUID();
    const first = await raids.start(attackerContext, offerId, requestKey);
    const replay = await raids.start(attackerContext, offerId, requestKey);
    expect(replay).toEqual(first);
    expect(await prisma.battle.count({ where: { matchOfferId: offerId } })).toBe(1);
    expect(await prisma.economyRequest.count({ where: { playerId: attacker.id, idempotencyKey: requestKey, action: 'RAID_START' } })).toBe(1);
    expect(await code(raids.start(attackerContext, offerId, randomUUID()))).toBe('MATCH_OFFER_ALREADY_USED');
    expect(await code(raids.battle(unrelatedContext, first.id))).toBe('BATTLE_NOT_PARTICIPANT');
    expect((await raids.battle(defenderContext, first.id)).id).toBe(first.id);
  });

  it('serializes simultaneous use of one offer', async () => {
    const attackerContext = context('concurrent-offer');
    const defenderContext = context('concurrent-offer-defender');
    const attacker = await player(attackerContext);
    const defender = await player(defenderContext);
    const offerId = await offer(attacker.id, defender.id);
    const outcomes = await Promise.allSettled([
      raids.start(attackerContext, offerId, randomUUID()),
      raids.start(attackerContext, offerId, randomUUID()),
    ]);
    expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await prisma.battle.count({ where: { matchOfferId: offerId } })).toBe(1);
  });

  it('serializes two winning attackers against one defender and reconciles every loot transaction', async () => {
    const firstContext = context('concurrent-attacker-a');
    const secondContext = context('concurrent-attacker-b');
    const defenderContext = context('shared-defender');
    const first = await player(firstContext);
    const second = await player(secondContext);
    const defender = await player(defenderContext);
    await prisma.playerHero.updateMany({ where: { playerId: { in: [first.id, second.id] } }, data: { level: 20 } });
    await prisma.resourceBalance.updateMany({ where: { kingdomId: defender.kingdomId, resource: { not: 'GEMS' } }, data: { amount: 100_000n } });
    const [firstOffer, secondOffer] = await Promise.all([offer(first.id, defender.id), offer(second.id, defender.id)]);
    const results = await Promise.all([
      raids.start(firstContext, firstOffer, randomUUID()),
      raids.start(secondContext, secondOffer, randomUUID()),
    ]);
    expect(results.every((result) => result.result === 'ATTACKER_WIN')).toBe(true);
    const balances = await prisma.resourceBalance.findMany({ where: { kingdomId: defender.kingdomId } });
    expect(balances.every((balance) => balance.amount >= 0n)).toBe(true);
    const transactions = await prisma.economyTransaction.findMany({
      where: { referenceId: { in: results.map((result) => result.id) }, reason: { in: [EconomyTransactionReason.RAID_REWARD, EconomyTransactionReason.RAID_LOSS] } },
    });
    expect(transactions.length).toBeGreaterThan(0);
    expect(transactions.every((transaction) => transaction.balanceAfter - transaction.balanceBefore === transaction.delta && transaction.balanceAfter >= 0n)).toBe(true);
    const net = transactions.reduce((sum, transaction) => sum + transaction.delta, 0n);
    expect(net).toBe(0n);
  });
});
