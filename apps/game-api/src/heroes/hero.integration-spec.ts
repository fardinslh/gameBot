import { randomUUID } from 'node:crypto';
import { EconomyTransactionReason } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EconomyService } from '../economy/economy.service';
import { NotificationService } from '../notifications/notification.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import type { DevelopmentPlayerContext } from '../player/player-context.service';
import { HeroError } from './hero.errors';
import { HeroService } from './hero.service';
import { AnalyticsService } from '../analytics/analytics.service';

const prisma = new PrismaService();
const analytics = new AnalyticsService(prisma);
const economy = new EconomyService(prisma, new NotificationService(prisma), analytics);
const heroes = new HeroService(prisma, economy, analytics);
const testExternalUserIds: string[] = [];

function context(): DevelopmentPlayerContext {
  const externalUserId = `hero-test-${randomUUID()}`;
  testExternalUserIds.push(externalUserId);
  return { platform: 'WEB', externalUserId };
}

function key(): string {
  return randomUUID();
}

async function errorCode(operation: Promise<unknown>): Promise<string> {
  try {
    await operation;
    return 'NO_ERROR';
  } catch (error) {
    if (!(error instanceof HeroError)) throw error;
    return (error.getResponse() as { code: string }).code;
  }
}

describe.sequential('server-authoritative Hero system', () => {
  beforeAll(async () => prisma.$connect());
  afterAll(async () => {
    await prisma.analyticsEvent.deleteMany({ where: { player: { platformAccounts: { some: { externalUserId: { in: testExternalUserIds } } } } } });
    await prisma.$disconnect();
  });

  it('grants starter Heroes during the first Kingdom bootstrap', async () => {
    const player = context();
    const kingdom = await economy.getKingdom(player);
    expect(await prisma.playerHero.count({ where: { playerId: kingdom.player.id } })).toBe(3);
    expect(await prisma.raidTeamSlot.count({ where: { raidTeam: { playerId: kingdom.player.id } } })).toBe(3);
  });

  it('grants the three starter Heroes and starter team exactly once', async () => {
    const player = context();
    const first = await heroes.getHeroes(player);
    const repeated = await heroes.getHeroes(player);
    expect(first.heroes.map((hero) => hero.key)).toEqual(['KNIGHT', 'RANGER', 'MAGE']);
    expect(first.team.slots.map((slot) => slot.playerHeroId)).toEqual(first.heroes.map((hero) => hero.id));
    expect(repeated.heroes.map((hero) => hero.id)).toEqual(first.heroes.map((hero) => hero.id));

    const account = await prisma.platformAccount.findUniqueOrThrow({
      where: { platform_externalUserId: { platform: 'WEB', externalUserId: player.externalUserId } },
    });
    expect(await prisma.playerHero.count({ where: { playerId: account.playerId } })).toBe(3);
    expect(await prisma.raidTeamSlot.count({ where: { raidTeam: { playerId: account.playerId } } })).toBe(3);
  });

  it('backfills a missing starter without changing Phase 03 economy state', async () => {
    const player = context();
    const kingdom = await economy.getKingdom(player);
    const farm = kingdom.buildings.find((building) => building.type === 'FARM')!;
    await prisma.building.update({ where: { id: farm.id }, data: { level: 3 } });
    const beforeTransactions = await prisma.economyTransaction.count({ where: { playerId: kingdom.player.id } });
    const initial = await heroes.getHeroes(player);
    const mage = initial.heroes.find((hero) => hero.key === 'MAGE')!;
    await prisma.playerHero.delete({ where: { id: mage.id } });

    const repaired = await heroes.getHeroes(player);
    const afterKingdom = await economy.getKingdom(player);
    expect(repaired.heroes).toHaveLength(3);
    expect(repaired.heroes.map((hero) => hero.key)).toContain('MAGE');
    expect(repaired.team.slots).toHaveLength(3);
    expect(afterKingdom.buildings.find((building) => building.id === farm.id)?.level).toBe(3);
    expect(afterKingdom.balances).toEqual(kingdom.balances);
    expect(await prisma.economyTransaction.count({ where: { playerId: kingdom.player.id } })).toBe(beforeTransactions);
  });

  it('upgrades once, deducts Gold once, logs the economy transaction, and replays the same key', async () => {
    const player = context();
    const initial = await heroes.getHeroes(player);
    const knight = initial.heroes.find((hero) => hero.key === 'KNIGHT')!;
    const idempotencyKey = key();
    const [first, replay] = await Promise.all([
      heroes.upgrade(player, knight.id, idempotencyKey),
      heroes.upgrade(player, knight.id, idempotencyKey),
    ]);
    expect(first).toEqual(replay);
    expect(first.hero.level).toBe(2);
    expect(BigInt(initial.balances.GOLD) - BigInt(first.balances.GOLD)).toBe(300n);

    const account = await prisma.platformAccount.findUniqueOrThrow({
      where: { platform_externalUserId: { platform: 'WEB', externalUserId: player.externalUserId } },
    });
    const charges = await prisma.economyTransaction.findMany({
      where: { playerId: account.playerId, reason: EconomyTransactionReason.HERO_UPGRADE },
    });
    expect(charges).toHaveLength(1);
    expect(charges[0]).toMatchObject({ delta: -300n, balanceBefore: 8_000n, balanceAfter: 7_700n });
    expect(await prisma.economyRequest.count({ where: { playerId: account.playerId, action: 'HERO_UPGRADE' } })).toBe(1);
  });

  it('uses the same Blacksmith discount for display, affordability, charge, ledger, and replay', async () => {
    const player = context();
    const kingdom = await economy.getKingdom(player);
    await prisma.building.updateMany({ where: { kingdomId: kingdom.kingdom.id, type: 'CASTLE' }, data: { level: 5 } });
    await prisma.building.updateMany({ where: { kingdomId: kingdom.kingdom.id, type: 'BLACKSMITH' }, data: { level: 6 } });
    const roster = await heroes.getHeroes(player);
    const knight = roster.heroes.find((hero) => hero.key === 'KNIGHT')!;
    expect(knight.upgradeCost?.gold).toBe('285');
    const requestKey = key();
    const upgraded = await heroes.upgrade(player, knight.id, requestKey);
    const replay = await heroes.upgrade(player, knight.id, requestKey);
    expect(replay).toEqual(upgraded);
    expect(BigInt(roster.balances.GOLD) - BigInt(upgraded.balances.GOLD)).toBe(285n);
    const charges = await prisma.economyTransaction.findMany({
      where: { playerId: kingdom.player.id, reason: EconomyTransactionReason.HERO_UPGRADE },
    });
    expect(charges).toHaveLength(1);
    expect(charges[0].delta).toBe(-285n);
  });

  it('rejects insufficient Gold, maximum level, invalid IDs, and foreign ownership', async () => {
    const poor = context();
    const poorRoster = await heroes.getHeroes(poor);
    const poorKnight = poorRoster.heroes[0];
    const poorKingdom = await economy.getKingdom(poor);
    await prisma.resourceBalance.update({
      where: { kingdomId_resource: { kingdomId: poorKingdom.kingdom.id, resource: 'GOLD' } },
      data: { amount: 0n },
    });
    expect(await errorCode(heroes.upgrade(poor, poorKnight.id, key()))).toBe('HERO_INSUFFICIENT_GOLD');

    const capped = context();
    const cappedRoster = await heroes.getHeroes(capped);
    await prisma.playerHero.update({ where: { id: cappedRoster.heroes[0].id }, data: { level: 20 } });
    expect(await errorCode(heroes.upgrade(capped, cappedRoster.heroes[0].id, key()))).toBe('HERO_MAX_LEVEL');

    const owner = context();
    const stranger = context();
    const owned = await heroes.getHeroes(owner);
    await heroes.getHeroes(stranger);
    expect(await errorCode(heroes.upgrade(stranger, owned.heroes[0].id, key()))).toBe('NOT_HERO_OWNER');
    expect(await errorCode(heroes.upgrade(owner, randomUUID(), key()))).toBe('HERO_NOT_FOUND');
  });

  it('persists exact slot ordering and rejects invalid teams', async () => {
    const player = context();
    const roster = await heroes.getHeroes(player);
    const reordered = [roster.heroes[2].id, roster.heroes[0].id, roster.heroes[1].id];
    const saved = await heroes.saveTeam(player, reordered);
    const reloaded = await heroes.getTeam(player);
    expect(saved.team.slots.map((slot) => slot.playerHeroId)).toEqual(reordered);
    expect(reloaded.team).toEqual(saved.team);
    expect(await errorCode(heroes.saveTeam(player, reordered.slice(0, 2)))).toBe('INVALID_TEAM_SIZE');
    expect(await errorCode(heroes.saveTeam(player, [...reordered, reordered[0]]))).toBe('INVALID_TEAM_SIZE');
    expect(await errorCode(heroes.saveTeam(player, [reordered[0], reordered[0], reordered[2]]))).toBe('DUPLICATE_TEAM_HERO');
    expect(await errorCode(heroes.saveTeam(player, [reordered[0], reordered[1], randomUUID()]))).toBe('INVALID_TEAM_HERO');

    const other = context();
    const otherRoster = await heroes.getHeroes(other);
    expect(await errorCode(heroes.saveTeam(player, [reordered[0], reordered[1], otherRoster.heroes[0].id]))).toBe('INVALID_TEAM_HERO');
  });
});
