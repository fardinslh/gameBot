import { randomUUID } from 'node:crypto';
import { EconomyTransactionReason } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EconomyService } from '../economy/economy.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import type { DevelopmentPlayerContext } from '../player/player-context.service';
import { RaidError } from './raid.errors';
import { RaidCandidateSelector } from './raid.matchmaking';
import { RaidRateLimiter } from './raid-rate-limiter.service';
import { RaidService } from './raid.service';
import { calculateRaidLoot } from './raid.calculator';
import { SystemOpponentService } from './system-opponent.service';
import { NEW_KINGDOM_SHIELD_MS, REAL_PLAYER_REPEAT_RAID_COOLDOWN_MS } from './raid.config';
import { SYSTEM_OPPONENTS } from './system-opponent.config';

const prisma = new PrismaService();
const notifications = new NotificationService(prisma);
const economy = new EconomyService(prisma, notifications);
const systems = new SystemOpponentService(prisma, economy);
const selector = new RaidCandidateSelector();
const raids = new RaidService(prisma, economy, systems, selector, new RaidRateLimiter(), notifications);

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
    const opponent = await prisma.player.findUniqueOrThrow({
      where: { id: first.offer.opponent.id },
      include: { kingdom: { include: { resourceBalances: true, buildings: { where: { type: 'WATCHTOWER' } } } } },
    });
    const balances = Object.fromEntries(opponent.kingdom!.resourceBalances.filter((row) => row.resource !== 'GEMS').map((row) => [row.resource, row.amount]));
    const watchtowerLevel = opponent.kingdom!.buildings[0]?.level ?? 1;
    expect(first.offer.potentialLoot).toEqual(calculateRaidLoot(balances, Math.min(1_500, Math.max(0, watchtowerLevel - 1) * 100)));
  });

  it('bootstraps exactly 30 durable system opponents idempotently with complete combat teams', async () => {
    await systems.ensure();
    await new SystemOpponentService(prisma, economy).ensure();
    const accounts = await prisma.platformAccount.findMany({
      where: { platform: 'WEB', externalUserId: { in: SYSTEM_OPPONENTS.map((item) => item.externalId) } },
      include: { player: { include: { kingdom: { include: { buildings: true, resourceBalances: true } }, raidTeam: { include: { slots: true } }, heroes: true } } },
    });
    expect(accounts).toHaveLength(30);
    expect(new Set(accounts.map((row) => row.playerId))).toHaveLength(30);
    for (const account of accounts) {
      expect(account.player.isSystemOpponent).toBe(true);
      expect(account.player.kingdom?.buildings.length).toBeGreaterThanOrEqual(9);
      expect(account.player.kingdom?.resourceBalances).toHaveLength(5);
      expect(account.player.heroes).toHaveLength(3);
      expect(account.player.raidTeam?.slots).toHaveLength(3);
    }
  });

  it('keeps a persistent 24-hour shield and gives a fresh player varied system-only offers', async () => {
    const fresh = context('shielded-search');
    const firstOverview = await raids.overview(fresh);
    const secondOverview = await raids.overview(fresh);
    expect(firstOverview.newPlayerProtection.active).toBe(true);
    expect(firstOverview.newPlayerProtection.expiresAt).toBe(secondOverview.newPlayerProtection.expiresAt);
    const opponents = new Set<string>();
    for (let index = 0; index < 6; index += 1) {
      const result = await raids.search(fresh);
      expect(result.offer.opponent.kind).toBe('SYSTEM');
      opponents.add(result.offer.opponent.id);
    }
    expect(opponents.size).toBeGreaterThan(1);
    expect((await raids.overview(fresh)).newPlayerProtection.active).toBe(true);
  });

  it('excludes a shielded real defender and permits safe real matchmaking after expiry', async () => {
    const protectedContext = context('protected-defender');
    const oldAttackerContext = context('old-attacker');
    const protectedPlayer = await player(protectedContext);
    const oldAttacker = await player(oldAttackerContext);
    const exclusiveTrophies = 100_000_000 + Number.parseInt(randomUUID().slice(0, 6), 16);
    await prisma.player.updateMany({ where: { id: { in: [protectedPlayer.id, oldAttacker.id] } }, data: { trophies: exclusiveTrophies } });
    await prisma.player.update({ where: { id: oldAttacker.id }, data: { createdAt: new Date(Date.now() - NEW_KINGDOM_SHIELD_MS - 1_000) } });
    const whileProtected = await raids.search(oldAttackerContext);
    expect(whileProtected.offer.opponent.id).not.toBe(protectedPlayer.id);
    expect(whileProtected.offer.opponent.kind).toBe('SYSTEM');

    await prisma.player.update({ where: { id: protectedPlayer.id }, data: { createdAt: new Date(Date.now() - NEW_KINGDOM_SHIELD_MS - 1_000) } });
    const afterExpiry = await raids.search(oldAttackerContext);
    expect(afterExpiry.offer.opponent.id).toBe(protectedPlayer.id);
    expect(afterExpiry.offer.opponent.kind).toBe('REAL');
  });

  it('blocks repeat farming of a real defender for six hours and allows it after cooldown', async () => {
    const attackerContext = context('anti-farm-attacker');
    const defenderContext = context('anti-farm-defender');
    const attacker = await player(attackerContext);
    const defender = await player(defenderContext);
    const exclusiveTrophies = 200_000_000 + Number.parseInt(randomUUID().slice(0, 6), 16);
    await prisma.player.updateMany({
      where: { id: { in: [attacker.id, defender.id] } },
      data: { createdAt: new Date(Date.now() - NEW_KINGDOM_SHIELD_MS - 1_000), trophies: exclusiveTrophies },
    });
    const battle = await raids.start(attackerContext, await offer(attacker.id, defender.id), randomUUID());
    const duringCooldown = await raids.search(attackerContext);
    expect(duringCooldown.offer.opponent.id).not.toBe(defender.id);
    expect(duringCooldown.offer.opponent.kind).toBe('SYSTEM');
    await prisma.battle.update({ where: { id: battle.id }, data: { createdAt: new Date(Date.now() - REAL_PLAYER_REPEAT_RAID_COOLDOWN_MS - 1_000) } });
    await prisma.player.updateMany({ where: { id: { in: [attacker.id, defender.id] } }, data: { trophies: exclusiveTrophies } });
    const systemPlayerIds = [...(await systems.configuredPlayers()).keys()].slice(0, 8);
    for (const systemPlayerId of systemPlayerIds) await offer(attacker.id, systemPlayerId);
    const afterCooldown = await raids.search(attackerContext);
    expect(afterCooldown.offer.opponent.id).toBe(defender.id);
    expect(afterCooldown.offer.opponent.kind).toBe('REAL');
  });

  it('replenishes a drained system opponent once under concurrency with an exact ledger delta', async () => {
    const configured = (await systems.configuredPlayers()).entries().next().value as [string, (typeof SYSTEM_OPPONENTS)[number]];
    const [systemPlayerId, systemConfig] = configured;
    const systemPlayer = await prisma.player.findUniqueOrThrow({ where: { id: systemPlayerId }, include: { kingdom: { include: { resourceBalances: true } } } });
    const gold = systemPlayer.kingdom!.resourceBalances.find((row) => row.resource === 'GOLD')!;
    const before = systemConfig.tier.resourceThresholds.GOLD - 1n;
    await prisma.resourceBalance.update({ where: { id: gold.id }, data: { amount: before } });
    const ledgerBefore = await prisma.economyTransaction.count({ where: { playerId: systemPlayerId, resourceType: 'GOLD', reason: 'SYSTEM_OPPONENT_REPLENISH' } });
    await Promise.all([
      systems.prepareForOffer(systemPlayerId, systemConfig),
      systems.prepareForOffer(systemPlayerId, systemConfig),
    ]);
    const refreshed = await prisma.resourceBalance.findUniqueOrThrow({ where: { id: gold.id } });
    const ledger = await prisma.economyTransaction.findMany({
      where: { playerId: systemPlayerId, resourceType: 'GOLD', reason: 'SYSTEM_OPPONENT_REPLENISH' },
      orderBy: { createdAt: 'desc' }, take: 1,
    });
    expect(refreshed.amount).toBe(systemConfig.tier.resourceTargets.GOLD);
    expect(await prisma.economyTransaction.count({ where: { playerId: systemPlayerId, resourceType: 'GOLD', reason: 'SYSTEM_OPPONENT_REPLENISH' } })).toBe(ledgerBefore + 1);
    expect(ledger[0]).toMatchObject({ balanceBefore: before, balanceAfter: systemConfig.tier.resourceTargets.GOLD, delta: systemConfig.tier.resourceTargets.GOLD - before });
  });

  it('keeps system trophies stable and creates no defender social or Revenge state', async () => {
    const attackerContext = context('system-social-attacker');
    const attacker = await player(attackerContext);
    await prisma.playerHero.updateMany({ where: { playerId: attacker.id }, data: { level: 20 } });
    const [systemPlayerId] = (await systems.configuredPlayers()).keys();
    const trophiesBefore = (await prisma.player.findUniqueOrThrow({ where: { id: systemPlayerId } })).trophies;
    const battle = await raids.start(attackerContext, await offer(attacker.id, systemPlayerId), randomUUID());
    expect((await prisma.player.findUniqueOrThrow({ where: { id: systemPlayerId } })).trophies).toBe(trophiesBefore);
    expect(battle.defender.trophyDelta).toBe(0);
    expect(await prisma.revengeTarget.count({ where: { sourceBattleId: battle.id } })).toBe(0);
    expect(await prisma.notification.count({ where: { playerId: systemPlayerId, sourceKey: { contains: battle.id } } })).toBe(0);
  });

  it('serializes simultaneous Raids against one system defender without negative resources', async () => {
    const firstContext = context('system-concurrent-a');
    const secondContext = context('system-concurrent-b');
    const first = await player(firstContext);
    const second = await player(secondContext);
    await prisma.playerHero.updateMany({ where: { playerId: { in: [first.id, second.id] } }, data: { level: 20 } });
    const [systemPlayerId, configured] = (await systems.configuredPlayers()).entries().next().value as [string, (typeof SYSTEM_OPPONENTS)[number]];
    await systems.prepareForOffer(systemPlayerId, configured);
    const trophiesBefore = (await prisma.player.findUniqueOrThrow({ where: { id: systemPlayerId } })).trophies;
    const [firstOffer, secondOffer] = await Promise.all([offer(first.id, systemPlayerId), offer(second.id, systemPlayerId)]);
    const battles = await Promise.all([
      raids.start(firstContext, firstOffer, randomUUID()),
      raids.start(secondContext, secondOffer, randomUUID()),
    ]);
    expect(battles).toHaveLength(2);
    expect((await prisma.player.findUniqueOrThrow({ where: { id: systemPlayerId } })).trophies).toBe(trophiesBefore);
    const system = await prisma.player.findUniqueOrThrow({ where: { id: systemPlayerId }, include: { kingdom: { include: { resourceBalances: true } } } });
    expect(system.kingdom!.resourceBalances.every((row) => row.amount >= 0n)).toBe(true);
    const transfers = await prisma.economyTransaction.findMany({
      where: { referenceId: { in: battles.map((battle) => battle.id) }, reason: { in: ['RAID_REWARD', 'RAID_LOSS'] } },
    });
    expect(transfers.every((row) => row.balanceAfter >= 0n && row.balanceAfter - row.balanceBefore === row.delta)).toBe(true);
  });

  it('uses Watchtower protection in authoritative Raid settlement and ledger amounts', async () => {
    const attackerContext = context('watchtower-attacker');
    const defenderContext = context('watchtower-defender');
    const attacker = await player(attackerContext);
    const defender = await player(defenderContext);
    await prisma.playerHero.updateMany({ where: { playerId: attacker.id }, data: { level: 20 } });
    await prisma.building.updateMany({ where: { kingdomId: defender.kingdomId, type: 'WATCHTOWER' }, data: { level: 16 } });
    await prisma.resourceBalance.updateMany({ where: { kingdomId: defender.kingdomId, resource: { not: 'GEMS' } }, data: { amount: 10_000n } });
    const battle = await raids.start(attackerContext, await offer(attacker.id, defender.id), randomUUID());
    expect(battle.result).toBe('ATTACKER_WIN');
    expect(battle.loot).toEqual({ GOLD: '1500', FOOD: '1500', WOOD: '1500', STONE: '1500' });
    const losses = await prisma.economyTransaction.findMany({ where: { referenceId: battle.id, reason: EconomyTransactionReason.RAID_LOSS } });
    expect(Object.fromEntries(losses.map((row) => [row.resourceType, (-row.delta).toString()]))).toEqual(battle.loot);
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
    const revengeDefender = await prisma.player.findUniqueOrThrow({
      where: { id: attacker.id },
      include: { kingdom: { include: { resourceBalances: true, buildings: { where: { type: 'WATCHTOWER' } } } } },
    });
    const revengeBalances = Object.fromEntries(revengeDefender.kingdom!.resourceBalances.filter((row) => row.resource !== 'GEMS').map((row) => [row.resource, row.amount]));
    const revengeWatchtowerLevel = revengeDefender.kingdom!.buildings[0]?.level ?? 1;
    expect(preview.potentialLoot).toEqual(calculateRaidLoot(revengeBalances, Math.min(1_500, Math.max(0, revengeWatchtowerLevel - 1) * 100)));
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
