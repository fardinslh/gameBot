import { Injectable, Logger } from '@nestjs/common';
import {
  EconomyAction,
  EconomyTransactionReason,
  Platform,
  Prisma,
  ResourceType as PrismaResourceType,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type {
  ArmyFormationSlotState,
  CampaignBattleStartResponse,
  CampaignResponse,
  CampaignRewardClaimResponse,
  CampaignRewardItem,
  CampaignStageKey,
  CampaignStageState,
  CampaignStageStatus,
  ResourceAmounts,
} from '@crown-and-coin/shared';
import { AnalyticsService } from '../analytics/analytics.service';
import { ArmyService } from '../army/army.service';
import { ArmyError } from '../army/army.errors';
import { EconomyService } from '../economy/economy.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import type { DevelopmentPlayerContext } from '../player/player-context.service';
import { RaidService } from '../raid/raid.service';
import {
  CAMPAIGN_CHAPTER_KEY,
  CAMPAIGN_CHAPTER_TITLE,
  CAMPAIGN_STAGE_BY_KEY,
  CAMPAIGN_STAGES,
  CAMPAIGN_STAR_REWARDS,
  type CampaignRewardDefinition,
  type CampaignStageDefinition,
} from './campaign.config';
import { CampaignError } from './campaign.errors';
import { CampaignNpcService } from './campaign-npc.service';

type Tx = Prisma.TransactionClient;

@Injectable()
export class CampaignService {
  private readonly logger = new Logger(CampaignService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly economy: EconomyService,
    private readonly npcs: CampaignNpcService,
    private readonly raids: RaidService,
    private readonly army: ArmyService,
    private readonly analytics: AnalyticsService,
  ) {}

  async get(context: DevelopmentPlayerContext): Promise<CampaignResponse> {
    await Promise.all([this.economy.getKingdom(context), this.npcs.ensure()]);
    const identity = await this.identity(context);
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const response = await this.buildResponse(tx, identity.playerId, identity.kingdomId, now);
      const day = now.toISOString().slice(0, 10);
      await this.analytics.recordServer(tx, {
        playerId: identity.playerId,
        eventName: 'campaign_opened',
        dedupeKey: `campaign_opened:${identity.playerId}:${day}`,
        properties: { chapterKey: CAMPAIGN_CHAPTER_KEY },
        occurredAt: now,
      });
      return response;
    });
  }

  async start(
    context: DevelopmentPlayerContext,
    rawStageKey: string,
    idempotencyKey?: string,
  ): Promise<CampaignBattleStartResponse> {
    const key = this.validateKey(idempotencyKey);
    const stage = this.stage(rawStageKey);
    await Promise.all([this.economy.getKingdom(context), this.npcs.ensure()]);
    const npcIds = await this.npcs.playerIdsByStage();
    const defenderPlayerId = npcIds.get(stage.key);
    if (!defenderPlayerId) throw new CampaignError('CAMPAIGN_CONFLICT', 'Campaign opponent is unavailable.');

    return this.withPlayerTransaction(context, async (tx, playerId, kingdomId) => {
      const previous = await tx.economyRequest.findUnique({
        where: { playerId_idempotencyKey_action: { playerId, idempotencyKey: key, action: EconomyAction.CAMPAIGN_START } },
      });
      if (previous) return previous.response as unknown as CampaignBattleStartResponse;

      const now = new Date();
      const progress = await tx.playerCampaignStage.findMany({ where: { playerId } });
      const castleLevel = await this.castleLevel(tx, kingdomId);
      this.assertAvailable(stage, progress, castleLevel);
      const npc = await tx.player.findUnique({
        where: { id: defenderPlayerId },
        select: { isSystemOpponent: true, systemOpponentKind: true },
      });
      if (!npc?.isSystemOpponent || npc.systemOpponentKind !== 'CAMPAIGN') {
        throw new CampaignError('CAMPAIGN_CONFLICT', 'Campaign opponent classification is invalid.');
      }
      try {
        await this.army.loadBattleArmy(tx, playerId, 'ATTACKER', now);
      } catch (error) {
        if (!(error instanceof ArmyError)) throw error;
        throw new CampaignError('CAMPAIGN_INVALID_ARMY', 'Prepare three battle-ready Army squads.');
      }

      let battle;
      try {
        battle = await this.raids.resolveCampaignBattle(tx, {
          attackerPlayerId: playerId,
          defenderPlayerId,
          stageKey: stage.key,
          snapshotTime: now,
        });
      } catch (error) {
        if (error instanceof ArmyError) throw new CampaignError('CAMPAIGN_INVALID_ARMY', 'Prepare three battle-ready Army squads.');
        throw error;
      }

      const existing = progress.find((row) => row.stageKey === stage.key);
      const attemptStars = this.attemptStars(battle);
      const bestStars = Math.max(existing?.bestStars ?? 0, attemptStars);
      const won = battle.result === 'ATTACKER_WIN';
      const firstClearRewardGranted = won && !existing?.firstClearedAt;
      await tx.playerCampaignStage.upsert({
        where: { playerId_stageKey: { playerId, stageKey: stage.key } },
        create: {
          playerId,
          stageKey: stage.key,
          bestStars,
          attempts: 1,
          firstClearedAt: won ? now : null,
          lastPlayedAt: now,
        },
        update: {
          bestStars,
          attempts: { increment: 1 },
          firstClearedAt: existing?.firstClearedAt ?? (won ? now : null),
          lastPlayedAt: now,
        },
      });
      const granted = firstClearRewardGranted ? this.presentRewards(stage.firstClearRewards) : [];
      if (firstClearRewardGranted) {
        await this.grantRewards(tx, playerId, kingdomId, stage.firstClearRewards, EconomyTransactionReason.CAMPAIGN_REWARD, `campaign-stage:${stage.key}`);
      }

      await this.recordBattleAnalytics(tx, playerId, stage, battle.id, battle.result, attemptStars, existing?.bestStars ?? 0, now);
      const campaign = await this.buildResponse(tx, playerId, kingdomId, now);
      if (campaign.chapter.completed) {
        await this.analytics.recordServer(tx, {
          playerId,
          eventName: 'campaign_chapter_completed',
          dedupeKey: `campaign_chapter_completed:${playerId}:${CAMPAIGN_CHAPTER_KEY}`,
          properties: { chapterKey: CAMPAIGN_CHAPTER_KEY, totalStars: campaign.chapter.totalStars },
          occurredAt: now,
        });
      }
      const response: CampaignBattleStartResponse = {
        campaign,
        battle: { ...battle, balances: campaign.balances },
        stageKey: stage.key,
        attemptStars,
        bestStars,
        firstClearRewardGranted,
        firstClearRewards: granted,
      };
      await tx.economyRequest.create({
        data: { playerId, idempotencyKey: key, action: EconomyAction.CAMPAIGN_START, response: response as unknown as Prisma.InputJsonValue },
      });
      this.logger.log(`campaign-stage battle=${battle.id} player=${playerId} stage=${stage.key} stars=${attemptStars}`);
      return response;
    });
  }

  async claim(
    context: DevelopmentPlayerContext,
    rawMilestoneStars: string,
    idempotencyKey?: string,
  ): Promise<CampaignRewardClaimResponse> {
    const key = this.validateKey(idempotencyKey);
    const milestoneStars = Number(rawMilestoneStars);
    const definition = CAMPAIGN_STAR_REWARDS.find((reward) => reward.stars === milestoneStars);
    if (!definition) throw new CampaignError('CAMPAIGN_REWARD_LOCKED', 'This Campaign star reward does not exist.');
    await Promise.all([this.economy.getKingdom(context), this.npcs.ensure()]);

    return this.withPlayerTransaction(context, async (tx, playerId, kingdomId) => {
      const previous = await tx.economyRequest.findUnique({
        where: { playerId_idempotencyKey_action: { playerId, idempotencyKey: key, action: EconomyAction.CAMPAIGN_STAR_REWARD } },
      });
      if (previous) return previous.response as unknown as CampaignRewardClaimResponse;
      const existing = await tx.campaignRewardClaim.findUnique({
        where: { playerId_chapterKey_milestoneStars: { playerId, chapterKey: CAMPAIGN_CHAPTER_KEY, milestoneStars } },
      });
      if (existing) throw new CampaignError('CAMPAIGN_REWARD_ALREADY_CLAIMED', 'This Campaign star reward was already claimed.');
      const totalStars = (await tx.playerCampaignStage.findMany({ where: { playerId }, select: { bestStars: true } }))
        .reduce((total, row) => total + row.bestStars, 0);
      if (totalStars < milestoneStars) throw new CampaignError('CAMPAIGN_REWARD_LOCKED', 'Earn more Campaign stars before claiming this reward.');

      const now = new Date();
      const claimId = randomUUID();
      await tx.campaignRewardClaim.create({
        data: { id: claimId, playerId, chapterKey: CAMPAIGN_CHAPTER_KEY, milestoneStars, claimedAt: now },
      });
      await this.grantRewards(tx, playerId, kingdomId, definition.rewards, EconomyTransactionReason.CAMPAIGN_STAR_REWARD, `campaign-stars:${claimId}`);
      await this.analytics.recordServer(tx, {
        playerId,
        eventName: 'campaign_star_reward_claimed',
        dedupeKey: `campaign_star_reward_claimed:${claimId}`,
        properties: { chapterKey: CAMPAIGN_CHAPTER_KEY, milestoneStars },
        occurredAt: now,
      });
      const response: CampaignRewardClaimResponse = {
        campaign: await this.buildResponse(tx, playerId, kingdomId, now),
        granted: this.presentRewards(definition.rewards),
      };
      await tx.economyRequest.create({
        data: { playerId, idempotencyKey: key, action: EconomyAction.CAMPAIGN_STAR_REWARD, response: response as unknown as Prisma.InputJsonValue },
      });
      return response;
    });
  }

  private async buildResponse(tx: Tx, playerId: string, kingdomId: string, now: Date): Promise<CampaignResponse> {
    const [progress, claims, castleLevel, balances, npcIds] = await Promise.all([
      tx.playerCampaignStage.findMany({ where: { playerId } }),
      tx.campaignRewardClaim.findMany({ where: { playerId, chapterKey: CAMPAIGN_CHAPTER_KEY } }),
      this.castleLevel(tx, kingdomId),
      this.loadBalances(tx, kingdomId),
      this.campaignNpcIds(tx),
    ]);
    const stages: CampaignStageState[] = [];
    for (const definition of CAMPAIGN_STAGES) {
      const row = progress.find((item) => item.stageKey === definition.key);
      const { status, lockReason } = this.stageStatus(definition, progress, castleLevel);
      const npcId = npcIds.get(definition.key);
      if (!npcId) throw new CampaignError('CAMPAIGN_CONFLICT', `Campaign opponent ${definition.key} is unavailable.`);
      let army;
      try {
        army = await this.army.loadBattleArmy(tx, npcId, 'DEFENDER', now);
      } catch (error) {
        if (!(error instanceof ArmyError)) throw error;
        throw new CampaignError('CAMPAIGN_CONFLICT', `Campaign opponent ${definition.key} has an invalid Army.`);
      }
      const presentedArmy: ArmyFormationSlotState[] = army.map((squad) => ({
        slot: squad.slot,
        troopType: squad.troopType,
        unitCount: squad.initialUnitCount,
        squadPower: squad.squadPower,
        commander: {
          playerHeroId: squad.commanderPlayerHeroId,
          key: squad.commanderKey,
          level: squad.commanderLevel,
          power: squad.commanderPower,
          portraitAsset: squad.commanderPortraitAsset,
        },
      }));
      stages.push({
        key: definition.key,
        index: definition.index,
        title: definition.title,
        status,
        requiredCastleLevel: definition.requiredCastleLevel,
        lockReason,
        bestStars: row?.bestStars ?? 0,
        attempts: row?.attempts ?? 0,
        firstClearedAt: row?.firstClearedAt?.toISOString() ?? null,
        isBoss: definition.isBoss,
        enemy: {
          displayName: definition.enemyName,
          castleLevel: definition.castleLevel,
          power: presentedArmy.reduce((total, squad) => total + squad.squadPower, 0),
          army: presentedArmy,
        },
        firstClearRewards: this.presentRewards(definition.firstClearRewards),
      });
    }
    const totalStars = progress.reduce((total, row) => total + row.bestStars, 0);
    return {
      serverTime: now.toISOString(),
      balances,
      chapter: {
        key: CAMPAIGN_CHAPTER_KEY,
        title: CAMPAIGN_CHAPTER_TITLE,
        totalStars,
        maximumStars: 27,
        completed: progress.filter((row) => row.bestStars > 0).length === CAMPAIGN_STAGES.length,
        stages,
        starRewards: CAMPAIGN_STAR_REWARDS.map((reward) => {
          const claim = claims.find((item) => item.milestoneStars === reward.stars);
          return {
            stars: reward.stars,
            status: claim ? 'CLAIMED' as const : totalStars >= reward.stars ? 'CLAIMABLE' as const : 'LOCKED' as const,
            rewards: this.presentRewards(reward.rewards),
            claimedAt: claim?.claimedAt.toISOString() ?? null,
          };
        }),
      },
    };
  }

  private async campaignNpcIds(tx: Tx): Promise<Map<CampaignStageKey, string>> {
    const accounts = await tx.platformAccount.findMany({
      where: { platform: Platform.WEB, externalUserId: { in: CAMPAIGN_STAGES.map((stage) => stage.externalId) } },
      select: { playerId: true, externalUserId: true },
    });
    const stageByExternal = new Map(CAMPAIGN_STAGES.map((stage) => [stage.externalId, stage.key]));
    return new Map(accounts.flatMap((account) => {
      const stageKey = stageByExternal.get(account.externalUserId);
      return stageKey ? [[stageKey, account.playerId] as const] : [];
    }));
  }

  private stageStatus(
    stage: CampaignStageDefinition,
    progress: { stageKey: string; bestStars: number }[],
    castleLevel: number,
  ): { status: CampaignStageStatus; lockReason: 'CASTLE' | 'PREVIOUS_STAGE' | null } {
    const own = progress.find((row) => row.stageKey === stage.key);
    if (own && own.bestStars > 0) return { status: 'CLEARED', lockReason: null };
    if (castleLevel < stage.requiredCastleLevel) return { status: 'LOCKED', lockReason: 'CASTLE' };
    const previous = CAMPAIGN_STAGES[stage.index - 2];
    if (previous && !progress.some((row) => row.stageKey === previous.key && row.bestStars > 0)) {
      return { status: 'LOCKED', lockReason: 'PREVIOUS_STAGE' };
    }
    return { status: 'AVAILABLE', lockReason: null };
  }

  private assertAvailable(stage: CampaignStageDefinition, progress: { stageKey: string; bestStars: number }[], castleLevel: number): void {
    const state = this.stageStatus(stage, progress, castleLevel);
    if (state.status !== 'LOCKED') return;
    if (state.lockReason === 'CASTLE') {
      throw new CampaignError('CAMPAIGN_CASTLE_REQUIRED', `Castle Level ${stage.requiredCastleLevel} is required.`);
    }
    throw new CampaignError('CAMPAIGN_STAGE_LOCKED', 'Clear the previous Campaign stage first.');
  }

  private attemptStars(battle: Extract<CampaignBattleStartResponse['battle'], { rulesVersion: 2 }>): number {
    if (battle.result !== 'ATTACKER_WIN') return 0;
    const remaining = new Map(battle.armies.attacker.map((squad) => [squad.slot, squad.initialUnitCount]));
    for (const event of battle.events) {
      if (event.type === 'DAMAGE' && event.targetSide === 'ATTACKER' && event.targetSlot && event.remainingUnits != null) {
        remaining.set(event.targetSlot, event.remainingUnits);
      }
    }
    return [...remaining.values()].filter((units) => units > 0).length;
  }

  private async recordBattleAnalytics(
    tx: Tx,
    playerId: string,
    stage: CampaignStageDefinition,
    battleId: string,
    result: 'ATTACKER_WIN' | 'DEFENDER_WIN',
    attemptStars: number,
    previousBest: number,
    now: Date,
  ): Promise<void> {
    await this.analytics.recordServer(tx, {
      playerId,
      eventName: 'campaign_stage_started',
      dedupeKey: `campaign_stage_started:${battleId}`,
      properties: { chapterKey: CAMPAIGN_CHAPTER_KEY, stageKey: stage.key, stageIndex: stage.index },
      occurredAt: now,
    });
    const eventName = result === 'ATTACKER_WIN' ? 'campaign_stage_won' : 'campaign_stage_lost';
    await this.analytics.recordServer(tx, {
      playerId,
      eventName,
      dedupeKey: `${eventName}:${battleId}`,
      properties: { chapterKey: CAMPAIGN_CHAPTER_KEY, stageKey: stage.key, attemptStars },
      occurredAt: now,
    });
    if (attemptStars > previousBest) {
      await this.analytics.recordServer(tx, {
        playerId,
        eventName: 'campaign_star_improved',
        dedupeKey: `campaign_star_improved:${battleId}`,
        properties: { chapterKey: CAMPAIGN_CHAPTER_KEY, stageKey: stage.key, previousBest, bestStars: attemptStars },
        occurredAt: now,
      });
    }
  }

  private async grantRewards(
    tx: Tx,
    playerId: string,
    kingdomId: string,
    rewards: readonly CampaignRewardDefinition[],
    reason: EconomyTransactionReason,
    referenceId: string,
  ): Promise<void> {
    const balances = await tx.resourceBalance.findMany({ where: { kingdomId } });
    for (const reward of rewards) {
      const balance = balances.find((row) => row.resource === reward.resource);
      if (!balance || reward.amount <= 0n || reward.resource === 'GEMS') throw new Error('Invalid Campaign reward configuration.');
      const balanceAfter = balance.amount + reward.amount;
      await tx.resourceBalance.update({ where: { id: balance.id }, data: { amount: balanceAfter } });
      await tx.economyTransaction.create({ data: {
        playerId,
        kingdomId,
        balanceId: balance.id,
        resourceType: reward.resource as PrismaResourceType,
        delta: reward.amount,
        balanceBefore: balance.amount,
        balanceAfter,
        reason,
        referenceId,
      } });
      balance.amount = balanceAfter;
    }
  }

  private presentRewards(rewards: readonly CampaignRewardDefinition[]): CampaignRewardItem[] {
    return rewards.map((reward) => ({ resource: reward.resource, amount: reward.amount.toString() }));
  }

  private async loadBalances(tx: Tx, kingdomId: string): Promise<ResourceAmounts> {
    const result: ResourceAmounts = { GOLD: '0', FOOD: '0', WOOD: '0', STONE: '0', GEMS: '0' };
    for (const row of await tx.resourceBalance.findMany({ where: { kingdomId } })) result[row.resource] = row.amount.toString();
    return result;
  }

  private async castleLevel(tx: Tx, kingdomId: string): Promise<number> {
    return (await tx.building.findUniqueOrThrow({ where: { kingdomId_type: { kingdomId, type: 'CASTLE' } }, select: { level: true } })).level;
  }

  private stage(value: string): CampaignStageDefinition {
    const stage = CAMPAIGN_STAGE_BY_KEY.get(value as CampaignStageKey);
    if (!stage) throw new CampaignError('CAMPAIGN_STAGE_NOT_FOUND', 'This Campaign stage does not exist.');
    return stage;
  }

  private validateKey(value?: string): string {
    const key = value?.trim();
    if (!key || key.length < 8 || key.length > 100) throw new CampaignError('INVALID_IDEMPOTENCY_KEY', 'A valid Idempotency-Key header is required.');
    return key;
  }

  private async identity(context: DevelopmentPlayerContext): Promise<{ playerId: string; kingdomId: string }> {
    const account = await this.prisma.platformAccount.findUniqueOrThrow({
      where: { platform_externalUserId: { platform: Platform.WEB, externalUserId: context.externalUserId } },
      include: { player: { include: { kingdom: true } } },
    });
    if (account.player.isSystemOpponent || !account.player.kingdom) throw new CampaignError('CAMPAIGN_CONFLICT', 'Player is not eligible for Campaign.');
    return { playerId: account.playerId, kingdomId: account.player.kingdom.id };
  }

  private async withPlayerTransaction<T>(
    context: DevelopmentPlayerContext,
    operation: (tx: Tx, playerId: string, kingdomId: string) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT 1 AS acquired FROM pg_advisory_xact_lock(hashtext(${`${context.platform}:${context.externalUserId}`}))`;
          const account = await tx.platformAccount.findUniqueOrThrow({
            where: { platform_externalUserId: { platform: Platform.WEB, externalUserId: context.externalUserId } },
            include: { player: { include: { kingdom: true } } },
          });
          if (account.player.isSystemOpponent || !account.player.kingdom) throw new CampaignError('CAMPAIGN_CONFLICT', 'Player is not eligible for Campaign.');
          return operation(tx, account.playerId, account.player.kingdom.id);
        }, { maxWait: 5_000, timeout: 30_000 });
      } catch (error) {
        if (this.retryable(error) && attempt < 3) continue;
        if (this.retryable(error)) throw new CampaignError('CAMPAIGN_CONFLICT', 'Campaign state is busy. Please retry.');
        throw error;
      }
    }
    throw new CampaignError('CAMPAIGN_CONFLICT', 'Campaign state is busy. Please retry.');
  }

  private retryable(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2034' || error.code === 'P2002');
  }
}
