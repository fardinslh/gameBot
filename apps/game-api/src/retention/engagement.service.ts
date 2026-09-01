import { Injectable } from '@nestjs/common';
import {
  EconomyAction,
  EconomyTransactionReason,
  Platform,
  Prisma,
  ResourceType as PrismaResourceType,
} from '@prisma/client';
import type {
  EngagementGoalState,
  EngagementOverviewResponse,
  EngagementProgressCue,
  EngagementReturnSummary,
  EngagementSessionResponse,
  KingdomBuildingState,
  KingdomBuildingType,
  ResourceAmounts,
  RetentionStateResponse,
  RoyalDecreeClaimResponse,
  RoyalDecreeState,
  RoyalDecreeTaskState,
} from '@crown-and-coin/shared';
import { randomUUID } from 'node:crypto';
import { EconomyService } from '../economy/economy.service';
import { ArmyService } from '../army/army.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import type { DevelopmentPlayerContext } from '../player/player-context.service';
import { EngagementError } from './engagement.errors';
import { RETURN_SUMMARY_MIN_AWAY_SECONDS, ROYAL_DECREE_REWARDS, ROYAL_DECREE_TARGETS } from './engagement.config';
import { RetentionMetricsService } from './retention-metrics.service';
import { RetentionService } from './retention.service';

type Tx = Prisma.TransactionClient;

@Injectable()
export class EngagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly economy: EconomyService,
    private readonly army: ArmyService,
    private readonly retention: RetentionService,
    private readonly metrics: RetentionMetricsService,
    private readonly analytics: AnalyticsService,
  ) {}

  async getOverview(context: DevelopmentPlayerContext): Promise<EngagementOverviewResponse> {
    const kingdom = await this.economy.getKingdom(context);
    await this.army.getArmy(context);
    const retention = await this.retention.getState(context);
    return this.prisma.$transaction(async (tx) => {
      const identity = await this.identity(tx, context);
      return this.buildOverview(tx, identity.playerId, kingdom.buildings, retention, new Date());
    });
  }

  async openSession(context: DevelopmentPlayerContext, keyValue?: string): Promise<EngagementSessionResponse> {
    const key = this.validateKey(keyValue);
    const kingdom = await this.economy.getKingdom(context);
    await this.army.getArmy(context);
    const retention = await this.retention.getState(context);
    return this.withPlayerTransaction(context, async (tx, playerId, kingdomId) => {
      const previous = await tx.economyRequest.findUnique({
        where: { playerId_idempotencyKey_action: { playerId, idempotencyKey: key, action: EconomyAction.ENGAGEMENT_SESSION } },
      });
      if (previous) return previous.response as unknown as EngagementSessionResponse;
      const now = new Date();
      const state = await tx.playerEngagementState.findUnique({ where: { playerId } });
      const overview = await this.buildOverview(tx, playerId, kingdom.buildings, retention, now);
      const returnSummary = state ? await this.buildReturnSummary(tx, playerId, kingdom.buildings, retention, overview.royalDecree.claimable, state.lastSeenAt, now) : null;
      await tx.playerEngagementState.upsert({
        where: { playerId },
        create: { playerId, lastSeenAt: now },
        update: { lastSeenAt: now },
      });
      const response: EngagementSessionResponse = { ...overview, returnSummary };
      await tx.economyRequest.create({
        data: { playerId, idempotencyKey: key, action: EconomyAction.ENGAGEMENT_SESSION, response: response as unknown as Prisma.InputJsonValue },
      });
      return response;
    });
  }

  async heartbeat(context: DevelopmentPlayerContext): Promise<{ serverTime: string }> {
    return this.withPlayerTransaction(context, async (tx, playerId) => {
      const now = new Date();
      await tx.playerEngagementState.upsert({
        where: { playerId },
        create: { playerId, lastSeenAt: now },
        update: { lastSeenAt: now },
      });
      return { serverTime: now.toISOString() };
    });
  }

  async claimRoyalDecree(context: DevelopmentPlayerContext, keyValue?: string): Promise<RoyalDecreeClaimResponse> {
    const key = this.validateKey(keyValue);
    const kingdom = await this.economy.getKingdom(context);
    await this.army.getArmy(context);
    const retention = await this.retention.getState(context);
    return this.withPlayerTransaction(context, async (tx, playerId, kingdomId) => {
      const previous = await tx.economyRequest.findUnique({
        where: { playerId_idempotencyKey_action: { playerId, idempotencyKey: key, action: EconomyAction.ROYAL_DECREE_CLAIM } },
      });
      if (previous) return previous.response as unknown as RoyalDecreeClaimResponse;
      const now = new Date();
      const overview = await this.buildOverview(tx, playerId, kingdom.buildings, retention, now);
      if (!overview.royalDecree.available) throw new EngagementError('ROYAL_DECREE_LOCKED', 'Royal Decree unlocks after onboarding.');
      if (overview.royalDecree.claimed) throw new EngagementError('ROYAL_DECREE_ALREADY_CLAIMED', 'Royal Decree reward was already claimed.');
      if (!overview.royalDecree.claimable) throw new EngagementError('ROYAL_DECREE_INCOMPLETE', 'Royal Decree tasks are incomplete.');

      const referenceId = `royal-decree:${randomUUID()}`;
      const balances = await tx.resourceBalance.findMany({ where: { kingdomId } });
      for (const reward of ROYAL_DECREE_REWARDS) {
        const balance = balances.find((item) => item.resource === reward.resource);
        const amount = BigInt(reward.amount);
        if (!balance) throw new Error(`Missing ${reward.resource} balance`);
        const balanceAfter = balance.amount + amount;
        await tx.resourceBalance.update({ where: { id: balance.id }, data: { amount: balanceAfter } });
        await tx.economyTransaction.create({ data: {
          playerId, kingdomId, balanceId: balance.id, resourceType: reward.resource as PrismaResourceType,
          delta: amount, balanceBefore: balance.amount, balanceAfter,
          reason: EconomyTransactionReason.ROYAL_DECREE_REWARD, referenceId,
        } });
        balance.amount = balanceAfter;
      }
      await tx.playerEngagementState.upsert({
        where: { playerId },
        create: { playerId, lastSeenAt: now, royalDecreeClaimedAt: now },
        update: { royalDecreeClaimedAt: now },
      });
      await this.analytics.recordServer(tx, {
        playerId,
        eventName: 'royal_decree_claimed',
        dedupeKey: `royal_decree_claimed:${playerId}`,
        properties: { rewardSummary: ROYAL_DECREE_REWARDS.map((item) => `${item.resource}:${item.amount}`).join(',') },
        occurredAt: now,
      });
      const refreshed = await this.buildOverview(tx, playerId, kingdom.buildings, retention, now);
      const response: RoyalDecreeClaimResponse = {
        granted: ROYAL_DECREE_REWARDS,
        balances: this.presentBalances(balances),
        engagement: refreshed,
      };
      await tx.economyRequest.create({
        data: { playerId, idempotencyKey: key, action: EconomyAction.ROYAL_DECREE_CLAIM, response: response as unknown as Prisma.InputJsonValue },
      });
      return response;
    });
  }

  private async buildOverview(
    tx: Tx,
    playerId: string,
    buildings: KingdomBuildingState[],
    retention: RetentionStateResponse,
    now: Date,
  ): Promise<EngagementOverviewResponse> {
    const [values, onboarding, engagement] = await Promise.all([
      this.metrics.resolve(tx, playerId),
      tx.onboardingProgress.findUnique({ where: { playerId } }),
      tx.playerEngagementState.findUnique({ where: { playerId } }),
    ]);
    const decree = this.presentDecree(
      onboarding?.status === 'COMPLETED' || values.RAID_COMPLETED > 0n,
      Boolean(engagement?.royalDecreeClaimedAt),
      values.CASTLE_LEVEL_REACHED,
      values.COLLECT_COUNT,
      values.RAID_COMPLETED,
    );
    const progress = this.selectProgress(retention);
    return {
      serverTime: now.toISOString(),
      nextGoal: this.selectGoal(buildings, retention, decree, values.RAID_WON),
      progress,
      royalDecree: decree,
      affordableBuildingType: buildings.find((building) => building.unlocked && building.upgradeAvailability === 'CAN_UPGRADE')?.type ?? null,
    };
  }

  private presentDecree(available: boolean, claimed: boolean, castle: bigint, collects: bigint, raids: bigint): RoyalDecreeState {
    const tasks: RoyalDecreeTaskState[] = [
      this.task('CASTLE_LEVEL', castle, ROYAL_DECREE_TARGETS.castleLevel),
      this.task('COLLECT_RESOURCES', collects, ROYAL_DECREE_TARGETS.collectCount),
      this.task('COMPLETE_RAIDS', raids, ROYAL_DECREE_TARGETS.raidCount),
    ];
    return { available, claimed, claimable: available && !claimed && tasks.every((task) => task.completed), tasks, rewards: ROYAL_DECREE_REWARDS };
  }

  private task(key: RoyalDecreeTaskState['key'], current: bigint, target: bigint): RoyalDecreeTaskState {
    const capped = current > target ? target : current;
    return { key, current: capped.toString(), target: target.toString(), completed: current >= target };
  }

  private selectProgress(retention: RetentionStateResponse): EngagementProgressCue[] {
    const mission = [...retention.daily.missions]
      .filter((item) => !item.claimed)
      .sort((a, b) => Number(b.progress) / Number(b.target) - Number(a.progress) / Number(a.target))[0];
    const achievement = retention.achievements.families
      .filter((item) => item.currentTier)
      .sort((a, b) => Number(b.progress) / Number(b.currentTier!.target) - Number(a.progress) / Number(a.currentTier!.target))[0];
    return [
      mission ? { source: 'DAILY_MISSION' as const, key: mission.key, current: mission.progress, target: mission.target, claimable: mission.completed } : null,
      achievement?.currentTier ? {
        source: 'ACHIEVEMENT' as const,
        key: achievement.key,
        current: BigInt(achievement.progress) > BigInt(achievement.currentTier.target) ? achievement.currentTier.target : achievement.progress,
        target: achievement.currentTier.target,
        claimable: achievement.currentTier.claimable,
      } : null,
    ].filter((item): item is EngagementProgressCue => item !== null);
  }

  private selectGoal(
    buildings: KingdomBuildingState[],
    retention: RetentionStateResponse,
    decree: RoyalDecreeState,
    raidWins: bigint,
  ): EngagementGoalState {
    if (retention.dailyReturn.canClaimToday || retention.daily.missions.some((item) => item.completed && !item.claimed)
      || retention.achievements.families.some((item) => item.currentTier?.claimable)) {
      return this.goal('CLAIM_REWARD', 'RETENTION', 0n, 1n);
    }
    if (decree.available && !decree.claimed) {
      const next = decree.tasks.find((task) => !task.completed);
      if (!next) return this.goal('ROYAL_DECREE', 'KINGDOM', 3n, 3n);
      if (next.key === 'CASTLE_LEVEL') return this.goal('UPGRADE_BUILDING', 'KINGDOM', BigInt(next.current), BigInt(next.target), 'CASTLE');
      if (next.key === 'COLLECT_RESOURCES') return this.goal('COLLECT_RESOURCES', 'KINGDOM', BigInt(next.current), BigInt(next.target));
      return this.goal('WIN_RAID', 'RAID', BigInt(next.current), BigInt(next.target));
    }
    const active = buildings.find((building) => building.activeUpgrade);
    if (active?.activeUpgrade) return { ...this.goal('UPGRADE_IN_PROGRESS', 'KINGDOM', 0n, 1n, active.type), readyAt: active.activeUpgrade.finishAt };
    const affordable = buildings.find((building) => building.unlocked && building.upgradeAvailability === 'CAN_UPGRADE');
    if (affordable) return this.goal('UPGRADE_BUILDING', 'KINGDOM', BigInt(affordable.level), BigInt(affordable.nextLevel ?? affordable.level), affordable.type);
    return this.goal('WIN_RAID', 'RAID', raidWins, raidWins + 1n);
  }

  private goal(kind: EngagementGoalState['kind'], section: EngagementGoalState['section'], current: bigint, target: bigint, buildingType: EngagementGoalState['buildingType'] = null): EngagementGoalState {
    return { kind, section, current: current.toString(), target: target.toString(), buildingType, readyAt: null };
  }

  private async buildReturnSummary(
    tx: Tx,
    playerId: string,
    buildings: KingdomBuildingState[],
    retention: RetentionStateResponse,
    decreeRewardReady: boolean,
    lastSeenAt: Date,
    now: Date,
  ): Promise<EngagementReturnSummary | null> {
    const awaySeconds = Math.max(0, Math.floor((now.getTime() - lastSeenAt.getTime()) / 1_000));
    if (awaySeconds < RETURN_SUMMARY_MIN_AWAY_SECONDS) return null;
    const [upgrades, training, revengeCount] = await Promise.all([
      tx.buildingUpgrade.findMany({
        where: { building: { kingdom: { playerId } }, status: 'COMPLETED', completedAt: { gt: lastSeenAt, lte: now } },
        select: { fromLevel: true, toLevel: true, building: { select: { type: true } } },
        orderBy: { completedAt: 'asc' },
      }),
      tx.troopTrainingOrder.findMany({
        where: { playerId, status: 'COMPLETED', completedAt: { gt: lastSeenAt, lte: now } },
        select: { troopType: true, quantity: true },
        orderBy: { completedAt: 'asc' },
      }),
      tx.revengeTarget.count({ where: { playerId, status: 'AVAILABLE', expiresAt: { gt: now } } }),
    ]);
    const resourcesReady: ResourceAmounts = { GOLD: '0', FOOD: '0', WOOD: '0', STONE: '0', GEMS: '0' };
    for (const building of buildings) if (building.resource) resourcesReady[building.resource] = (BigInt(resourcesReady[building.resource]) + BigInt(building.collectable)).toString();
    const availableRewardCount = Number(retention.dailyReturn.canClaimToday)
      + retention.daily.missions.filter((item) => item.completed && !item.claimed).length
      + retention.weekly.missions.filter((item) => item.completed && !item.claimed).length
      + Number(retention.daily.completionBonus.eligible && !retention.daily.completionBonus.claimed)
      + retention.achievements.families.filter((item) => item.currentTier?.claimable).length
      + Number(decreeRewardReady);
    const hasValue = Object.values(resourcesReady).some((value) => BigInt(value) > 0n)
      || upgrades.length > 0 || training.length > 0 || availableRewardCount > 0 || revengeCount > 0;
    if (!hasValue) return null;
    return {
      awaySeconds,
      resourcesReady,
      completedUpgrades: upgrades.map((item) => ({ buildingType: item.building.type as KingdomBuildingType, fromLevel: item.fromLevel, toLevel: item.toLevel })),
      completedTraining: training,
      availableRewardCount,
      revengeCount,
    };
  }

  private async identity(tx: Tx, context: DevelopmentPlayerContext): Promise<{ playerId: string; kingdomId: string }> {
    const account = await tx.platformAccount.findUniqueOrThrow({
      where: { platform_externalUserId: { platform: Platform.WEB, externalUserId: context.externalUserId } },
      include: { player: { include: { kingdom: true } } },
    });
    if (!account.player.kingdom || account.player.isSystemOpponent) throw new EngagementError('ENGAGEMENT_CONFLICT', 'Player is not eligible for engagement state.');
    return { playerId: account.playerId, kingdomId: account.player.kingdom.id };
  }

  private async withPlayerTransaction<T>(context: DevelopmentPlayerContext, operation: (tx: Tx, playerId: string, kingdomId: string) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1 AS acquired FROM pg_advisory_xact_lock(hashtext(${`${context.platform}:${context.externalUserId}`}))`;
        const identity = await this.identity(tx, context);
        return operation(tx, identity.playerId, identity.kingdomId);
      }, { maxWait: 5_000, timeout: 30_000 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2034' || error.code === 'P2002')) {
        throw new EngagementError('ENGAGEMENT_CONFLICT', 'Engagement state is busy. Please retry.');
      }
      throw error;
    }
  }

  private presentBalances(rows: Array<{ resource: PrismaResourceType; amount: bigint }>): ResourceAmounts {
    const result: ResourceAmounts = { GOLD: '0', FOOD: '0', WOOD: '0', STONE: '0', GEMS: '0' };
    for (const row of rows) result[row.resource] = row.amount.toString();
    return result;
  }

  private validateKey(value?: string): string {
    const key = value?.trim();
    if (!key || key.length < 8 || key.length > 100) throw new EngagementError('INVALID_IDEMPOTENCY_KEY', 'A valid Idempotency-Key header is required.');
    return key;
  }
}
