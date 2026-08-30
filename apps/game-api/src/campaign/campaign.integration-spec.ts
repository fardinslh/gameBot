import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AnalyticsService } from '../analytics/analytics.service';
import { ArmyService } from '../army/army.service';
import { EconomyService } from '../economy/economy.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import type { DevelopmentPlayerContext } from '../player/player-context.service';
import { RaidCandidateSelector } from '../raid/raid.matchmaking';
import { RaidRateLimiter } from '../raid/raid-rate-limiter.service';
import { RaidService } from '../raid/raid.service';
import { SystemOpponentService } from '../raid/system-opponent.service';
import { CAMPAIGN_EXTERNAL_IDS, CAMPAIGN_STAGES } from './campaign.config';
import { CampaignError } from './campaign.errors';
import { CampaignNpcService } from './campaign-npc.service';
import { CampaignService } from './campaign.service';

const prisma = new PrismaService();
const analytics = new AnalyticsService(prisma);
const notifications = new NotificationService(prisma);
const economy = new EconomyService(prisma, notifications, analytics);
const army = new ArmyService(prisma, economy, analytics);
const systems = new SystemOpponentService(prisma, economy);
const raids = new RaidService(prisma, economy, systems, new RaidCandidateSelector(), new RaidRateLimiter(), notifications, analytics, army);
const npcs = new CampaignNpcService(prisma, economy);
const campaign = new CampaignService(prisma, economy, npcs, raids, army, analytics);
const testExternalIds: string[] = [];

function context(prefix = 'campaign-test'): DevelopmentPlayerContext {
  const externalUserId = `${prefix}-${randomUUID()}`;
  testExternalIds.push(externalUserId);
  return { platform: 'WEB', externalUserId };
}
function key(): string { return randomUUID(); }

async function identity(player: DevelopmentPlayerContext): Promise<{ playerId: string; kingdomId: string }> {
  const account = await prisma.platformAccount.findUniqueOrThrow({
    where: { platform_externalUserId: { platform: 'WEB', externalUserId: player.externalUserId } },
    include: { player: { include: { kingdom: true } } },
  });
  return { playerId: account.playerId, kingdomId: account.player.kingdom!.id };
}

async function code(operation: Promise<unknown>): Promise<string> {
  try { await operation; return 'NO_ERROR'; }
  catch (error) {
    if (!(error instanceof CampaignError)) throw error;
    return (error.getResponse() as { code: string }).code;
  }
}

describe.sequential('Retention 04 authoritative Campaign integration', () => {
  beforeAll(async () => prisma.$connect());
  afterAll(async () => {
    const accounts = await prisma.platformAccount.findMany({
      where: { platform: 'WEB', externalUserId: { in: testExternalIds } },
      select: { playerId: true },
    });
    const playerIds = accounts.map((account) => account.playerId);
    await prisma.battle.deleteMany({ where: { attackerPlayerId: { in: playerIds }, type: 'CAMPAIGN' } });
    await prisma.player.deleteMany({ where: { id: { in: playerIds } } });
    await prisma.$disconnect();
  });

  it('bootstraps exactly nine durable Campaign NPCs idempotently and keeps them out of Raid search', async () => {
    await npcs.ensure();
    await new CampaignNpcService(prisma, economy).ensure();
    const accounts = await prisma.platformAccount.findMany({
      where: { platform: 'WEB', externalUserId: { in: [...CAMPAIGN_EXTERNAL_IDS] } },
      include: { player: { include: { armyFormation: { include: { slots: true } }, heroes: true, troops: true } } },
    });
    expect(accounts).toHaveLength(9);
    expect(new Set(accounts.map((account) => account.playerId))).toHaveLength(9);
    for (const account of accounts) {
      expect(account.player).toMatchObject({ isSystemOpponent: true, systemOpponentKind: 'CAMPAIGN' });
      expect(account.player.armyFormation?.slots).toHaveLength(3);
      expect(account.player.heroes).toHaveLength(3);
      expect(account.player.troops).toHaveLength(3);
    }
    const offer = await raids.search(context('campaign-exclusion'));
    const opponent = await prisma.player.findUniqueOrThrow({ where: { id: offer.offer.opponent.id } });
    expect(opponent.systemOpponentKind).toBe('RAID');
  }, 60_000);

  it('authors stage availability from Castle and prior clears', async () => {
    const player = context('campaign-gates');
    const state = await campaign.get(player);
    expect(state.chapter.stages.map((stage) => stage.status)).toEqual([
      'AVAILABLE', 'LOCKED', 'LOCKED', 'LOCKED', 'LOCKED', 'LOCKED', 'LOCKED', 'LOCKED', 'LOCKED',
    ]);
    expect(state.chapter.stages[3]).toMatchObject({ lockReason: 'CASTLE', requiredCastleLevel: 2 });
    expect(await code(campaign.start(player, 'UNKNOWN', key()))).toBe('CAMPAIGN_STAGE_NOT_FOUND');
    expect(await code(campaign.start(player, 'FRONTIER_02', key()))).toBe('CAMPAIGN_STAGE_LOCKED');

    const ids = await identity(player);
    await prisma.playerCampaignStage.createMany({ data: CAMPAIGN_STAGES.slice(0, 3).map((stage) => ({ playerId: ids.playerId, stageKey: stage.key, bestStars: 1, attempts: 1, firstClearedAt: new Date(), lastPlayedAt: new Date() })) });
    expect(await code(campaign.start(player, 'FRONTIER_04', key()))).toBe('CAMPAIGN_CASTLE_REQUIRED');
    await prisma.building.update({ where: { kingdomId_type: { kingdomId: ids.kingdomId, type: 'CASTLE' } }, data: { level: 2 } });
    const unlocked = await campaign.get(player);
    expect(unlocked.chapter.stages[3]).toMatchObject({ status: 'AVAILABLE', lockReason: null });
  }, 60_000);

  it('persists Battle v2, derives stars, grants first clear once, and creates no PvP side effects', async () => {
    const player = context('campaign-battle');
    await campaign.get(player);
    const ids = await identity(player);
    const troopsBefore = await prisma.playerTroop.findMany({ where: { playerId: ids.playerId }, orderBy: { troopType: 'asc' } });
    const trophiesBefore = (await prisma.player.findUniqueOrThrow({ where: { id: ids.playerId } })).trophies;
    const requestKey = key();
    const first = await campaign.start(player, 'FRONTIER_01', requestKey);
    expect(await campaign.start(player, 'FRONTIER_01', requestKey)).toEqual(first);
    expect(first.battle).toMatchObject({ type: 'CAMPAIGN', rulesVersion: 2, attacker: { trophyDelta: 0 }, defender: { trophyDelta: 0 } });
    expect(first.battle.loot).toEqual({ GOLD: '0', FOOD: '0', WOOD: '0', STONE: '0' });
    expect(first.attemptStars).toBeGreaterThanOrEqual(1);
    expect(first.attemptStars).toBeLessThanOrEqual(3);
    expect(first.firstClearRewardGranted).toBe(true);
    expect(first.firstClearRewards).toEqual([{ resource: 'GOLD', amount: '800' }, { resource: 'FOOD', amount: '400' }]);
    expect(first.campaign.chapter.stages[1].status).toBe('AVAILABLE');

    const persisted = await prisma.battle.findUniqueOrThrow({ where: { id: first.battle.id }, include: { armySquadSnapshots: true, events: true } });
    expect(persisted).toMatchObject({ type: 'CAMPAIGN', campaignStageKey: 'FRONTIER_01', rulesVersion: 2, attackerTrophyDelta: 0, defenderTrophyDelta: 0 });
    expect(persisted.armySquadSnapshots).toHaveLength(6);
    expect(persisted.events.length).toBeGreaterThan(2);
    expect(await prisma.revengeTarget.count({ where: { sourceBattleId: first.battle.id } })).toBe(0);
    expect(await prisma.notification.count({ where: { OR: [{ sourceKey: { contains: first.battle.id } }, { playerId: ids.playerId }] } })).toBe(0);
    expect(await prisma.raidMatchOffer.count({ where: { attackerPlayerId: ids.playerId } })).toBe(0);
    expect(await raids.history(player)).toEqual({ battles: [] });
    expect((await prisma.player.findUniqueOrThrow({ where: { id: ids.playerId } })).trophies).toBe(trophiesBefore);
    expect(await prisma.playerTroop.findMany({ where: { playerId: ids.playerId }, orderBy: { troopType: 'asc' } })).toEqual(troopsBefore);

    const ledger = await prisma.economyTransaction.findMany({ where: { playerId: ids.playerId, referenceId: 'campaign-stage:FRONTIER_01' } });
    expect(ledger).toHaveLength(2);
    expect(ledger.every((row) => row.reason === 'CAMPAIGN_REWARD' && row.resourceType !== 'GEMS')).toBe(true);
    const replay = await campaign.start(player, 'FRONTIER_01', key());
    expect(replay.firstClearRewardGranted).toBe(false);
    expect(replay.firstClearRewards).toEqual([]);
    expect(await prisma.economyTransaction.count({ where: { playerId: ids.playerId, referenceId: 'campaign-stage:FRONTIER_01' } })).toBe(2);
    expect((await prisma.playerCampaignStage.findUniqueOrThrow({ where: { playerId_stageKey: { playerId: ids.playerId, stageKey: 'FRONTIER_01' } } })).attempts).toBe(2);
    expect(await prisma.analyticsEvent.count({ where: { playerId: ids.playerId, eventName: { startsWith: 'raid_' } } })).toBe(0);
  }, 60_000);

  it('claims 9-star rewards once under different-key concurrency with no Gems', async () => {
    const player = context('campaign-stars');
    await campaign.get(player);
    const ids = await identity(player);
    await prisma.playerCampaignStage.createMany({ data: CAMPAIGN_STAGES.slice(0, 3).map((stage) => ({ playerId: ids.playerId, stageKey: stage.key, bestStars: 3, attempts: 1, firstClearedAt: new Date(), lastPlayedAt: new Date() })) });
    expect(await code(campaign.claim(player, '18', key()))).toBe('CAMPAIGN_REWARD_LOCKED');
    const attempts = await Promise.allSettled([campaign.claim(player, '9', key()), campaign.claim(player, '9', key())]);
    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(1);
    expect(await prisma.campaignRewardClaim.count({ where: { playerId: ids.playerId, chapterKey: 'BROKEN_FRONTIER', milestoneStars: 9 } })).toBe(1);
    const ledger = await prisma.economyTransaction.findMany({ where: { playerId: ids.playerId, reason: 'CAMPAIGN_STAR_REWARD' } });
    expect(ledger).toHaveLength(2);
    expect(ledger.every((row) => row.resourceType !== 'GEMS' && row.balanceAfter - row.balanceBefore === row.delta)).toBe(true);
    expect(await code(campaign.claim(player, '9', key()))).toBe('CAMPAIGN_REWARD_ALREADY_CLAIMED');
  }, 60_000);

  it('replays same-key concurrent starts and permits different attempts while granting first clear once', async () => {
    const sameKeyPlayer = context('campaign-same-key');
    await campaign.get(sameKeyPlayer);
    const requestKey = key();
    const [sameA, sameB] = await Promise.all([
      campaign.start(sameKeyPlayer, 'FRONTIER_01', requestKey),
      campaign.start(sameKeyPlayer, 'FRONTIER_01', requestKey),
    ]);
    expect(sameA.battle.id).toBe(sameB.battle.id);

    const differentKeyPlayer = context('campaign-different-key');
    await campaign.get(differentKeyPlayer);
    const ids = await identity(differentKeyPlayer);
    const [attemptA, attemptB] = await Promise.all([
      campaign.start(differentKeyPlayer, 'FRONTIER_01', key()),
      campaign.start(differentKeyPlayer, 'FRONTIER_01', key()),
    ]);
    expect(attemptA.battle.id).not.toBe(attemptB.battle.id);
    expect([attemptA.firstClearRewardGranted, attemptB.firstClearRewardGranted].filter(Boolean)).toHaveLength(1);
    expect(await prisma.economyTransaction.count({ where: { playerId: ids.playerId, referenceId: 'campaign-stage:FRONTIER_01' } })).toBe(2);
    expect((await prisma.playerCampaignStage.findUniqueOrThrow({ where: { playerId_stageKey: { playerId: ids.playerId, stageKey: 'FRONTIER_01' } } })).attempts).toBe(2);
  }, 60_000);
});
