import { Injectable, Logger } from '@nestjs/common';
import {
  EconomyAction,
  EconomyTransactionReason,
  Platform,
  Prisma,
  ResourceType as PrismaResourceType,
  RetentionCadence as PrismaRetentionCadence,
} from '@prisma/client';
import type {
  DailyReturnDayState,
  ResourceAmounts,
  RetentionAchievementFamilyState,
  RetentionCadence,
  RetentionClaimResponse,
  RetentionMissionState,
  RetentionRewardItem,
  RetentionStateResponse,
} from '@crown-and-coin/shared';
import type { DevelopmentPlayerContext } from '../player/player-context.service';
import { EconomyService } from '../economy/economy.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import {
  ACHIEVEMENTS,
  achievementDefinition,
  DAILY_COMPLETION_REWARDS,
  DAILY_MISSION_COUNT,
  DAILY_MISSIONS,
  DAILY_RETURN_REWARDS,
  missionDefinition,
  type RewardDefinition,
  WEEKLY_MISSION_COUNT,
  WEEKLY_MISSIONS,
} from './retention.config';
import { RetentionError } from './retention.errors';
import { RetentionMetricsService, type RetentionMetricValues } from './retention-metrics.service';
import { dailyPeriod, deterministicSelection, weeklyPeriod, type RetentionPeriod } from './retention-periods';
import { RetentionClock } from './retention-clock.service';

type Tx = Prisma.TransactionClient;
type MissionRow = Awaited<ReturnType<Tx['retentionMissionInstance']['findMany']>>[number];

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly economy: EconomyService,
    private readonly metrics: RetentionMetricsService,
    private readonly analytics: AnalyticsService,
    private readonly clock: RetentionClock,
  ) {}

  async getState(context: DevelopmentPlayerContext): Promise<RetentionStateResponse> {
    await this.economy.getKingdom(context);
    return this.withPlayerTransaction(context, async (tx, playerId, kingdomId) => this.buildState(tx, playerId, kingdomId, this.clock.now()));
  }

  async claimMission(context: DevelopmentPlayerContext, missionId: string, key?: string): Promise<RetentionClaimResponse> {
    return this.claim(context, key, EconomyAction.MISSION_CLAIM, async (tx, playerId, kingdomId, now) => {
      await this.ensureCurrentMissions(tx, playerId, now);
      const mission = await tx.retentionMissionInstance.findUnique({ where: { id: missionId } });
      if (!mission) throw new RetentionError('MISSION_NOT_FOUND', 'Mission does not exist.');
      if (mission.playerId !== playerId) throw new RetentionError('MISSION_NOT_OWNER', 'Mission belongs to another player.');
      const period = mission.cadence === PrismaRetentionCadence.DAILY ? dailyPeriod(now) : weeklyPeriod(now);
      if (mission.periodKey !== period.key) throw new RetentionError('MISSION_EXPIRED', 'Mission period has ended.');
      if (mission.claimedAt) throw new RetentionError('MISSION_ALREADY_CLAIMED', 'Mission reward was already claimed.');
      const definition = missionDefinition(mission.definitionKey);
      if (!definition) throw new RetentionError('MISSION_NOT_FOUND', 'Mission content is unavailable.');
      const values = await this.metrics.resolve(tx, playerId, period);
      if (values[definition.metric] < mission.target) throw new RetentionError('MISSION_INCOMPLETE', 'Mission is not complete.');
      const claimed = await tx.retentionMissionInstance.updateMany({ where: { id: mission.id, claimedAt: null }, data: { claimedAt: now } });
      if (claimed.count !== 1) throw new RetentionError('MISSION_ALREADY_CLAIMED', 'Mission reward was already claimed.');
      const rewards = this.readRewards(mission.rewards);
      const reason = mission.cadence === PrismaRetentionCadence.DAILY
        ? EconomyTransactionReason.MISSION_REWARD
        : EconomyTransactionReason.WEEKLY_MISSION_REWARD;
      await this.grantRewards(tx, playerId, kingdomId, rewards, reason, `mission:${mission.id}`);
      await this.analytics.recordServer(tx, {
        playerId,
        eventName: mission.cadence === PrismaRetentionCadence.DAILY ? 'daily_mission_claimed' : 'weekly_mission_claimed',
        dedupeKey: `retention_mission_claimed:${mission.id}`,
        properties: { missionKey: mission.definitionKey, periodKey: mission.periodKey, rewardSummary: this.rewardSummary(rewards) },
        occurredAt: now,
      });
      return { rewards };
    });
  }

  async claimDailyBonus(context: DevelopmentPlayerContext, key?: string): Promise<RetentionClaimResponse> {
    return this.claim(context, key, EconomyAction.DAILY_BONUS_CLAIM, async (tx, playerId, kingdomId, now) => {
      const daily = dailyPeriod(now);
      await this.ensureCurrentMissions(tx, playerId, now);
      const missions = await tx.retentionMissionInstance.findMany({ where: { playerId, cadence: 'DAILY', periodKey: daily.key } });
      const values = await this.metrics.resolve(tx, playerId, daily);
      if (!this.allMissionsComplete(missions, values)) throw new RetentionError('DAILY_BONUS_INCOMPLETE', 'Complete all Daily Missions first.');
      const existing = await tx.retentionDailyBonusClaim.findUnique({ where: { playerId_periodKey: { playerId, periodKey: daily.key } } });
      if (existing) throw new RetentionError('DAILY_BONUS_ALREADY_CLAIMED', 'Daily completion reward was already claimed.');
      const rewards = this.presentRewards(DAILY_COMPLETION_REWARDS);
      const claim = await tx.retentionDailyBonusClaim.create({ data: { playerId, periodKey: daily.key, rewards: rewards as unknown as Prisma.InputJsonValue } });
      await this.grantRewards(tx, playerId, kingdomId, rewards, EconomyTransactionReason.DAILY_COMPLETION_REWARD, `daily-bonus:${claim.id}`);
      await this.analytics.recordServer(tx, {
        playerId, eventName: 'daily_all_completed', dedupeKey: `daily_all_completed:${playerId}:${daily.key}`,
        properties: { periodKey: daily.key, rewardSummary: this.rewardSummary(rewards) }, occurredAt: now,
      });
      return { rewards };
    });
  }

  async claimAchievement(context: DevelopmentPlayerContext, achievementKey: string, tierNumber: number, key?: string): Promise<RetentionClaimResponse> {
    return this.claim(context, key, EconomyAction.ACHIEVEMENT_CLAIM, async (tx, playerId, kingdomId, now) => {
      const definition = achievementDefinition(achievementKey);
      const tier = definition?.tiers.find((item) => item.tier === tierNumber);
      if (!definition || !tier) throw new RetentionError('ACHIEVEMENT_NOT_FOUND', 'Achievement tier does not exist.');
      const existing = await tx.retentionAchievementClaim.findUnique({
        where: { playerId_achievementKey_tier: { playerId, achievementKey, tier: tierNumber } },
      });
      if (existing) throw new RetentionError('ACHIEVEMENT_ALREADY_CLAIMED', 'Achievement reward was already claimed.');
      const previousClaims = await tx.retentionAchievementClaim.count({
        where: { playerId, achievementKey, tier: { lt: tierNumber } },
      });
      if (previousClaims !== tierNumber - 1) throw new RetentionError('ACHIEVEMENT_TIER_OUT_OF_ORDER', 'Claim earlier Achievement tiers first.');
      const values = await this.metrics.resolve(tx, playerId);
      if (values[definition.metric] < tier.target) throw new RetentionError('ACHIEVEMENT_INCOMPLETE', 'Achievement tier is not complete.');
      const rewards = this.presentRewards(tier.rewards);
      const claim = await tx.retentionAchievementClaim.create({
        data: { playerId, achievementKey, tier: tierNumber, target: tier.target, rewards: rewards as unknown as Prisma.InputJsonValue },
      });
      await this.grantRewards(tx, playerId, kingdomId, rewards, EconomyTransactionReason.ACHIEVEMENT_REWARD, `achievement:${claim.id}`);
      await this.analytics.recordServer(tx, {
        playerId, eventName: 'achievement_claimed', dedupeKey: `achievement_claimed:${claim.id}`,
        properties: { achievementKey, tier: tierNumber, rewardSummary: this.rewardSummary(rewards) }, occurredAt: now,
      });
      return { rewards };
    });
  }

  async claimDailyReturn(context: DevelopmentPlayerContext, key?: string): Promise<RetentionClaimResponse> {
    return this.claim(context, key, EconomyAction.DAILY_RETURN_CLAIM, async (tx, playerId, kingdomId, now) => {
      const daily = dailyPeriod(now);
      const existing = await tx.dailyReturnClaim.findUnique({ where: { playerId_periodKey: { playerId, periodKey: daily.key } } });
      if (existing) throw new RetentionError('DAILY_RETURN_ALREADY_CLAIMED', 'Daily Return reward was already claimed today.');
      const priorClaims = await tx.dailyReturnClaim.count({ where: { playerId } });
      const dayIndex = priorClaims % DAILY_RETURN_REWARDS.length + 1;
      const rewards = this.presentRewards(DAILY_RETURN_REWARDS[dayIndex - 1].rewards);
      const claim = await tx.dailyReturnClaim.create({ data: { playerId, periodKey: daily.key, dayIndex, rewards: rewards as unknown as Prisma.InputJsonValue, claimedAt: now } });
      await this.grantRewards(tx, playerId, kingdomId, rewards, EconomyTransactionReason.DAILY_RETURN_REWARD, `daily-return:${claim.id}`);
      await this.analytics.recordServer(tx, {
        playerId, eventName: 'daily_return_claimed', dedupeKey: `daily_return_claimed:${claim.id}`,
        properties: { periodKey: daily.key, dayIndex, rewardSummary: this.rewardSummary(rewards) }, occurredAt: now,
      });
      return { rewards };
    });
  }

  private async claim(
    context: DevelopmentPlayerContext,
    keyValue: string | undefined,
    action: EconomyAction,
    operation: (tx: Tx, playerId: string, kingdomId: string, now: Date) => Promise<{ rewards: RetentionRewardItem[] }>,
  ): Promise<RetentionClaimResponse> {
    const key = this.validateKey(keyValue);
    await this.economy.getKingdom(context);
    return this.withPlayerTransaction(context, async (tx, playerId, kingdomId) => {
      const previous = await tx.economyRequest.findUnique({ where: { playerId_idempotencyKey_action: { playerId, idempotencyKey: key, action } } });
      if (previous) return previous.response as unknown as RetentionClaimResponse;
      const now = this.clock.now();
      const { rewards } = await operation(tx, playerId, kingdomId, now);
      const response: RetentionClaimResponse = {
        granted: rewards,
        balances: await this.loadBalances(tx, kingdomId),
        retention: await this.buildState(tx, playerId, kingdomId, now),
      };
      await tx.economyRequest.create({ data: { playerId, idempotencyKey: key, action, response: response as unknown as Prisma.InputJsonValue } });
      return response;
    });
  }

  private async buildState(tx: Tx, playerId: string, kingdomId: string, now: Date): Promise<RetentionStateResponse> {
    const daily = dailyPeriod(now);
    const weekly = weeklyPeriod(now);
    await this.ensureCurrentMissions(tx, playerId, now);
    const [dailyRows, weeklyRows, dailyValues, weeklyValues, lifetimeValues, dailyBonus, achievementClaims, returnClaims] = await Promise.all([
      tx.retentionMissionInstance.findMany({ where: { playerId, cadence: 'DAILY', periodKey: daily.key }, orderBy: { createdAt: 'asc' } }),
      tx.retentionMissionInstance.findMany({ where: { playerId, cadence: 'WEEKLY', periodKey: weekly.key }, orderBy: { createdAt: 'asc' } }),
      this.metrics.resolve(tx, playerId, daily),
      this.metrics.resolve(tx, playerId, weekly),
      this.metrics.resolve(tx, playerId),
      tx.retentionDailyBonusClaim.findUnique({ where: { playerId_periodKey: { playerId, periodKey: daily.key } } }),
      tx.retentionAchievementClaim.findMany({ where: { playerId } }),
      tx.dailyReturnClaim.findMany({ where: { playerId }, orderBy: { claimedAt: 'asc' } }),
    ]);
    const dailyMissions = dailyRows.map((mission) => this.presentMission(mission, dailyValues));
    const weeklyMissions = weeklyRows.map((mission) => this.presentMission(mission, weeklyValues));
    const achievements = this.presentAchievements(lifetimeValues, achievementClaims);
    const completedDaily = dailyMissions.filter((mission) => mission.completed).length;
    await this.recordCompletionAnalytics(tx, playerId, daily, weekly, dailyMissions, weeklyMissions, achievements, returnClaims, now);

    return {
      serverTime: now.toISOString(),
      dailyResetAt: daily.endsAt.toISOString(),
      weeklyResetAt: weekly.endsAt.toISOString(),
      dailyReturn: this.presentDailyReturn(returnClaims, daily, now),
      daily: {
        periodKey: daily.key,
        missions: dailyMissions,
        completedCount: completedDaily,
        completionBonus: {
          completedCount: completedDaily,
          requiredCount: DAILY_MISSION_COUNT,
          eligible: completedDaily === DAILY_MISSION_COUNT,
          claimed: Boolean(dailyBonus),
          rewards: this.presentRewards(DAILY_COMPLETION_REWARDS),
        },
      },
      weekly: { periodKey: weekly.key, missions: weeklyMissions, completedCount: weeklyMissions.filter((mission) => mission.completed).length },
      achievements: { families: achievements },
    };
  }

  private async ensureCurrentMissions(tx: Tx, playerId: string, now: Date): Promise<void> {
    const daily = dailyPeriod(now);
    const weekly = weeklyPeriod(now);
    const dailyDefinitions = deterministicSelection(DAILY_MISSIONS.filter((item) => item.enabled), DAILY_MISSION_COUNT, playerId, daily.key);
    const weeklyDefinitions = deterministicSelection(WEEKLY_MISSIONS.filter((item) => item.enabled), WEEKLY_MISSION_COUNT, playerId, weekly.key);
    await tx.retentionMissionInstance.createMany({
      data: [
        ...dailyDefinitions.map((definition) => ({ playerId, cadence: PrismaRetentionCadence.DAILY, periodKey: daily.key, definitionKey: definition.key, target: definition.target, rewards: this.presentRewards(definition.rewards) as unknown as Prisma.InputJsonValue })),
        ...weeklyDefinitions.map((definition) => ({ playerId, cadence: PrismaRetentionCadence.WEEKLY, periodKey: weekly.key, definitionKey: definition.key, target: definition.target, rewards: this.presentRewards(definition.rewards) as unknown as Prisma.InputJsonValue })),
      ],
      skipDuplicates: true,
    });
  }

  private presentMission(mission: MissionRow, values: RetentionMetricValues): RetentionMissionState {
    const definition = missionDefinition(mission.definitionKey);
    if (!definition) throw new Error(`Missing retention mission definition ${mission.definitionKey}`);
    const progress = values[definition.metric] > mission.target ? mission.target : values[definition.metric];
    return {
      id: mission.id,
      key: mission.definitionKey,
      cadence: mission.cadence as RetentionCadence,
      metric: definition.metric,
      target: mission.target.toString(),
      progress: progress.toString(),
      completed: progress >= mission.target,
      claimed: Boolean(mission.claimedAt),
      rewards: this.readRewards(mission.rewards),
    };
  }

  private presentAchievements(
    values: RetentionMetricValues,
    claims: Array<{ achievementKey: string; tier: number }>,
  ): RetentionAchievementFamilyState[] {
    const claimed = new Set(claims.map((claim) => `${claim.achievementKey}:${claim.tier}`));
    return ACHIEVEMENTS.filter((definition) => definition.enabled).sort((a, b) => a.sortOrder - b.sortOrder).map((definition) => {
      const progress = values[definition.metric];
      const firstUnclaimed = definition.tiers.find((item) => !claimed.has(`${definition.key}:${item.tier}`));
      const tiers = definition.tiers.map((item) => ({
        tier: item.tier,
        target: item.target.toString(),
        completed: progress >= item.target,
        claimed: claimed.has(`${definition.key}:${item.tier}`),
        claimable: item.tier === firstUnclaimed?.tier && progress >= item.target,
        rewards: this.presentRewards(item.rewards),
      }));
      return { key: definition.key, metric: definition.metric, progress: progress.toString(), tiers, currentTier: tiers.find((item) => item.tier === firstUnclaimed?.tier) ?? null };
    });
  }

  private presentDailyReturn(
    claims: Array<{ periodKey: string; dayIndex: number; claimedAt: Date }>,
    daily: RetentionPeriod,
    now: Date,
  ): RetentionStateResponse['dailyReturn'] {
    const today = claims.find((claim) => claim.periodKey === daily.key);
    const completedInCycle = claims.length % DAILY_RETURN_REWARDS.length;
    const currentDay = completedInCycle + 1;
    const cycle: DailyReturnDayState[] = DAILY_RETURN_REWARDS.map((definition) => ({
      dayIndex: definition.dayIndex,
      rewards: this.presentRewards(definition.rewards),
      status: definition.dayIndex <= completedInCycle ? 'CLAIMED' : !today && definition.dayIndex === currentDay ? 'TODAY' : 'UPCOMING',
    }));
    return {
      currentDay,
      canClaimToday: !today,
      lastClaimAt: claims.at(-1)?.claimedAt.toISOString() ?? null,
      nextClaimAt: daily.endsAt.toISOString(),
      cycle,
    };
  }

  private async recordCompletionAnalytics(
    tx: Tx,
    playerId: string,
    daily: RetentionPeriod,
    weekly: RetentionPeriod,
    dailyMissions: RetentionMissionState[],
    weeklyMissions: RetentionMissionState[],
    achievements: RetentionAchievementFamilyState[],
    returnClaims: Array<{ periodKey: string }>,
    now: Date,
  ): Promise<void> {
    if (!returnClaims.some((claim) => claim.periodKey === daily.key)) {
      await this.analytics.recordServer(tx, { playerId, eventName: 'daily_return_available', dedupeKey: `daily_return_available:${playerId}:${daily.key}`, properties: { periodKey: daily.key }, occurredAt: now });
    }
    for (const mission of dailyMissions.filter((item) => item.completed)) {
      await this.analytics.recordServer(tx, { playerId, eventName: 'daily_mission_completed', dedupeKey: `daily_mission_completed:${mission.id}`, properties: { missionKey: mission.key, periodKey: daily.key }, occurredAt: now });
    }
    for (const mission of weeklyMissions.filter((item) => item.completed)) {
      await this.analytics.recordServer(tx, { playerId, eventName: 'weekly_mission_completed', dedupeKey: `weekly_mission_completed:${mission.id}`, properties: { missionKey: mission.key, periodKey: weekly.key }, occurredAt: now });
    }
    for (const family of achievements) {
      for (const tier of family.tiers.filter((item) => item.completed)) {
        await this.analytics.recordServer(tx, { playerId, eventName: 'achievement_completed', dedupeKey: `achievement_completed:${playerId}:${family.key}:${tier.tier}`, properties: { achievementKey: family.key, tier: tier.tier }, occurredAt: now });
      }
    }
  }

  private allMissionsComplete(missions: MissionRow[], values: RetentionMetricValues): boolean {
    return missions.length === DAILY_MISSION_COUNT && missions.every((mission) => {
      const definition = missionDefinition(mission.definitionKey);
      return definition ? values[definition.metric] >= mission.target : false;
    });
  }

  private async grantRewards(
    tx: Tx,
    playerId: string,
    kingdomId: string,
    rewards: RetentionRewardItem[],
    reason: EconomyTransactionReason,
    referenceId: string,
  ): Promise<void> {
    const balances = await tx.resourceBalance.findMany({ where: { kingdomId } });
    for (const reward of rewards) {
      const amount = BigInt(reward.amount);
      const balance = balances.find((item) => item.resource === reward.resource);
      if (!balance || amount <= 0n) throw new Error(`Invalid retention reward ${reward.resource}:${reward.amount}`);
      const balanceAfter = balance.amount + amount;
      await tx.resourceBalance.update({ where: { id: balance.id }, data: { amount: balanceAfter } });
      await tx.economyTransaction.create({ data: {
        playerId, kingdomId, balanceId: balance.id, resourceType: reward.resource as PrismaResourceType,
        delta: amount, balanceBefore: balance.amount, balanceAfter, reason, referenceId,
      } });
      balance.amount = balanceAfter;
    }
  }

  private async loadBalances(tx: Tx, kingdomId: string): Promise<ResourceAmounts> {
    const result: ResourceAmounts = { GOLD: '0', FOOD: '0', WOOD: '0', STONE: '0', GEMS: '0' };
    for (const row of await tx.resourceBalance.findMany({ where: { kingdomId } })) result[row.resource] = row.amount.toString();
    return result;
  }

  private presentRewards(rewards: readonly RewardDefinition[]): RetentionRewardItem[] {
    return rewards.map((reward) => ({ resource: reward.resource, amount: reward.amount.toString() }));
  }

  private readRewards(value: Prisma.JsonValue): RetentionRewardItem[] {
    if (!Array.isArray(value)) throw new Error('Stored retention rewards are invalid.');
    return value.map((item) => {
      if (!item || Array.isArray(item) || typeof item !== 'object') throw new Error('Stored retention reward is invalid.');
      const resource = item.resource;
      const amount = item.amount;
      if (typeof resource !== 'string' || typeof amount !== 'string') throw new Error('Stored retention reward is invalid.');
      return { resource: resource as RetentionRewardItem['resource'], amount };
    });
  }

  private rewardSummary(rewards: RetentionRewardItem[]): string {
    return rewards.map((reward) => `${reward.resource}:${reward.amount}`).join(',');
  }

  private validateKey(value?: string): string {
    const key = value?.trim();
    if (!key || key.length < 8 || key.length > 100) throw new RetentionError('INVALID_IDEMPOTENCY_KEY', 'A valid Idempotency-Key header is required.');
    return key;
  }

  private async withPlayerTransaction<T>(context: DevelopmentPlayerContext, operation: (tx: Tx, playerId: string, kingdomId: string) => Promise<T>): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT 1 AS acquired FROM pg_advisory_xact_lock(hashtext(${`${context.platform}:${context.externalUserId}`}))`;
          const account = await tx.platformAccount.findUniqueOrThrow({
            where: { platform_externalUserId: { platform: Platform.WEB, externalUserId: context.externalUserId } },
            include: { player: { include: { kingdom: true } } },
          });
          if (account.player.isSystemOpponent || !account.player.kingdom) throw new RetentionError('MISSION_NOT_OWNER', 'Player is not eligible for retention rewards.');
          return operation(tx, account.playerId, account.player.kingdom.id);
        }, { maxWait: 5_000, timeout: 30_000 });
      } catch (error) {
        if (this.retryable(error) && attempt < 3) continue;
        if (this.retryable(error)) throw new RetentionError('RETENTION_CONFLICT', 'Retention state is busy. Please retry.');
        throw error;
      }
    }
    throw new RetentionError('RETENTION_CONFLICT', 'Retention state is busy. Please retry.');
  }

  private retryable(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2034' || error.code === 'P2002');
  }
}
