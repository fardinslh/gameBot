import { randomUUID } from 'node:crypto';
import { EconomyTransactionReason } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EconomyService } from '../economy/economy.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import type { DevelopmentPlayerContext } from '../player/player-context.service';
import { RaidError } from './raid.errors';
import { RaidFixtureService } from './raid-fixture.service';
import { RaidRateLimiter } from './raid-rate-limiter.service';
import { RaidService } from './raid.service';

const prisma = new PrismaService();
const notifications = new NotificationService(prisma);
const economy = new EconomyService(prisma, notifications);
const fixtures = new RaidFixtureService(prisma, economy);
const raids = new RaidService(prisma, economy, fixtures, new RaidRateLimiter(), notifications);

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

  it('creates a defender inbox, structured notifications, and one available Revenge target for an eligible Raid', async () => {
    const attackerContext = context('revenge-source-attacker');
    const defenderContext = context('revenge-source-defender');
    const attacker = await player(attackerContext);
    const defender = await player(defenderContext);
    await prisma.playerHero.updateMany({ where: { playerId: attacker.id }, data: { level: 20 } });
    await prisma.resourceBalance.updateMany({ where: { kingdomId: defender.kingdomId, resource: { not: 'GEMS' } }, data: { amount: 100_000n } });
    const source = await raids.start(attackerContext, await offer(attacker.id, defender.id), randomUUID());
    expect(source.result).toBe('ATTACKER_WIN');

    const target = await prisma.revengeTarget.findUniqueOrThrow({ where: { sourceBattleId: source.id } });
    expect(target).toMatchObject({ playerId: defender.id, targetPlayerId: attacker.id, status: 'AVAILABLE' });
    const rows = await prisma.notification.findMany({ where: { playerId: defender.id }, orderBy: { type: 'asc' } });
    expect(rows.map((row) => row.type).sort()).toEqual(['PLAYER_RAIDED', 'REVENGE_AVAILABLE']);
    expect(rows.find((row) => row.type === 'PLAYER_RAIDED')?.payload).toMatchObject({ battleId: source.id, defenseResult: 'DEFENSE_LOSS' });
    expect(rows.find((row) => row.type === 'PLAYER_RAIDED')?.deepLinkIntent).toEqual({ screen: 'INBOX', battleId: source.id });
    expect(rows.find((row) => row.type === 'REVENGE_AVAILABLE')?.deepLinkIntent).toEqual({ screen: 'REVENGE', revengeTargetId: target.id });

    const inbox = await raids.inbox(defenderContext);
    expect(inbox.unreadCount).toBe(1);
    expect(inbox.entries[0]).toMatchObject({ battleId: source.id, defenseResult: 'DEFENSE_LOSS', revengeStatus: 'AVAILABLE', revengeTargetId: target.id });
    expect(Object.values(inbox.entries[0].lootLost).some((amount) => BigInt(amount) > 0n)).toBe(true);
    const preview = await raids.revengePreview(defenderContext, target.id);
    expect(preview.target.id).toBe(attacker.id);
    expect(preview.ownTeam.heroes).toHaveLength(3);
    expect(preview.status).toBe('AVAILABLE');
    await raids.markInboxRead(defenderContext);
    expect((await raids.inbox(defenderContext)).unreadCount).toBe(0);
    await raids.history(defenderContext);
    expect(await prisma.notification.count({ where: { playerId: defender.id } })).toBe(2);
  });

  it('starts one idempotent REVENGE with the Phase 05 replay and never creates a revenge chain', async () => {
    const attackerContext = context('revenge-loop-attacker');
    const defenderContext = context('revenge-loop-defender');
    const attacker = await player(attackerContext);
    const defender = await player(defenderContext);
    await prisma.playerHero.updateMany({ where: { playerId: attacker.id }, data: { level: 20 } });
    const source = await raids.start(attackerContext, await offer(attacker.id, defender.id), randomUUID());
    expect(source.result).toBe('ATTACKER_WIN');
    const target = await prisma.revengeTarget.findUniqueOrThrow({ where: { sourceBattleId: source.id } });
    const requestKey = randomUUID();
    const first = await raids.startRevenge(defenderContext, target.id, requestKey);
    const replay = await raids.startRevenge(defenderContext, target.id, requestKey);
    expect(replay).toEqual(first);
    expect(first.type).toBe('REVENGE');
    expect(first.events.length).toBeGreaterThan(0);
    expect(first.teams.attacker).toHaveLength(3);
    expect(await prisma.battle.count({ where: { revengeTargetId: target.id } })).toBe(1);
    expect(await prisma.revengeTarget.count({ where: { sourceBattleId: first.id } })).toBe(0);
    expect((await prisma.revengeTarget.findUniqueOrThrow({ where: { id: target.id } })).status).toBe('USED');
    expect(await prisma.economyRequest.count({ where: { playerId: defender.id, idempotencyKey: requestKey, action: 'REVENGE_START' } })).toBe(1);
    expect(await code(raids.startRevenge(defenderContext, target.id, randomUUID()))).toBe('REVENGE_ALREADY_USED');
  });

  it('rejects expired and foreign Revenge targets', async () => {
    const attackerContext = context('revenge-guard-attacker');
    const defenderContext = context('revenge-guard-defender');
    const foreignContext = context('revenge-guard-foreign');
    const attacker = await player(attackerContext);
    const defender = await player(defenderContext);
    await player(foreignContext);
    await prisma.playerHero.updateMany({ where: { playerId: attacker.id }, data: { level: 20 } });
    const source = await raids.start(attackerContext, await offer(attacker.id, defender.id), randomUUID());
    const target = await prisma.revengeTarget.findUniqueOrThrow({ where: { sourceBattleId: source.id } });
    expect(await code(raids.startRevenge(foreignContext, target.id, randomUUID()))).toBe('REVENGE_NOT_OWNER');
    await prisma.revengeTarget.update({ where: { id: target.id }, data: { expiresAt: new Date(Date.now() - 1_000) } });
    expect(await code(raids.startRevenge(defenderContext, target.id, randomUUID()))).toBe('REVENGE_EXPIRED');
    expect((await prisma.revengeTarget.findUniqueOrThrow({ where: { id: target.id } })).status).toBe('EXPIRED');
  });

  it('serializes simultaneous Revenge starts and settles only one Battle', async () => {
    const attackerContext = context('revenge-concurrent-attacker');
    const defenderContext = context('revenge-concurrent-defender');
    const attacker = await player(attackerContext);
    const defender = await player(defenderContext);
    await prisma.playerHero.updateMany({ where: { playerId: attacker.id }, data: { level: 20 } });
    const source = await raids.start(attackerContext, await offer(attacker.id, defender.id), randomUUID());
    const target = await prisma.revengeTarget.findUniqueOrThrow({ where: { sourceBattleId: source.id } });
    const outcomes = await Promise.allSettled([
      raids.startRevenge(defenderContext, target.id, randomUUID()),
      raids.startRevenge(defenderContext, target.id, randomUUID()),
    ]);
    expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await prisma.battle.count({ where: { revengeTargetId: target.id } })).toBe(1);
  });

  it('serializes a normal Raid and Revenge against the same target without corrupting resources', async () => {
    const targetContext = context('mixed-lock-target');
    const revengePlayerContext = context('mixed-lock-revenge');
    const normalAttackerContext = context('mixed-lock-normal');
    const targetPlayer = await player(targetContext);
    const revengePlayer = await player(revengePlayerContext);
    const normalAttacker = await player(normalAttackerContext);

    await prisma.playerHero.updateMany({ where: { playerId: targetPlayer.id }, data: { level: 20 } });
    const source = await raids.start(targetContext, await offer(targetPlayer.id, revengePlayer.id), randomUUID());
    expect(source.result).toBe('ATTACKER_WIN');
    const revengeTarget = await prisma.revengeTarget.findUniqueOrThrow({ where: { sourceBattleId: source.id } });

    await prisma.playerHero.updateMany({ where: { playerId: { in: [revengePlayer.id, normalAttacker.id] } }, data: { level: 20 } });
    await prisma.resourceBalance.updateMany({ where: { kingdomId: targetPlayer.kingdomId, resource: { not: 'GEMS' } }, data: { amount: 100_000n } });
    const normalOffer = await offer(normalAttacker.id, targetPlayer.id);
    const outcomes = await Promise.all([
      raids.start(normalAttackerContext, normalOffer, randomUUID()),
      raids.startRevenge(revengePlayerContext, revengeTarget.id, randomUUID()),
    ]);

    expect(outcomes.map((battle) => battle.type).sort()).toEqual(['RAID', 'REVENGE']);
    const balances = await prisma.resourceBalance.findMany({ where: { kingdomId: targetPlayer.kingdomId } });
    expect(balances.every((balance) => balance.amount >= 0n)).toBe(true);
    const transactions = await prisma.economyTransaction.findMany({
      where: { referenceId: { in: outcomes.map((battle) => battle.id) }, reason: { in: [EconomyTransactionReason.RAID_REWARD, EconomyTransactionReason.RAID_LOSS] } },
    });
    expect(transactions.every((row) => row.balanceAfter >= 0n && row.balanceAfter - row.balanceBefore === row.delta)).toBe(true);
  });
});
