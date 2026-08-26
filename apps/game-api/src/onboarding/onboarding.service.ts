import { Injectable } from '@nestjs/common';
import {
  OnboardingStatus,
  OnboardingStep,
  Prisma,
} from '@prisma/client';
import type { OnboardingStateResponse } from '@crown-and-coin/shared';
import { AnalyticsService } from '../analytics/analytics.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';

type Tx = Prisma.TransactionClient | PrismaService;

const STEP_RANK: Record<OnboardingStep, number> = {
  WELCOME: 0,
  COLLECT: 1,
  UPGRADE: 2,
  RAID: 3,
  COMPLETE: 4,
};

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
  ) {}

  async get(playerId: string): Promise<OnboardingStateResponse> {
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const state = await this.reconcile(tx, playerId, now);
      return this.present(state, now);
    });
  }

  async start(playerId: string): Promise<OnboardingStateResponse> {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, playerId);
      const now = new Date();
      const reconciled = await this.reconcile(tx, playerId, now);
      if (reconciled.status !== OnboardingStatus.NOT_STARTED) return this.present(reconciled, now);
      const state = await tx.onboardingProgress.upsert({
        where: { playerId },
        create: { playerId, status: OnboardingStatus.IN_PROGRESS, currentStep: OnboardingStep.COLLECT, startedAt: now },
        update: { status: OnboardingStatus.IN_PROGRESS, currentStep: OnboardingStep.COLLECT, startedAt: now },
      });
      return this.present(state, now);
    });
  }

  async skip(playerId: string): Promise<OnboardingStateResponse> {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, playerId);
      const now = new Date();
      const reconciled = await this.reconcile(tx, playerId, now);
      if (reconciled.status === OnboardingStatus.COMPLETED || reconciled.status === OnboardingStatus.SKIPPED) {
        return this.present(reconciled, now);
      }
      const state = await tx.onboardingProgress.upsert({
        where: { playerId },
        create: { playerId, status: OnboardingStatus.SKIPPED, currentStep: OnboardingStep.COMPLETE, skippedAt: now },
        update: { status: OnboardingStatus.SKIPPED, currentStep: OnboardingStep.COMPLETE, skippedAt: now },
      });
      return this.present(state, now);
    });
  }

  advanceAfterCollect(tx: Prisma.TransactionClient, playerId: string, occurredAt: Date): Promise<void> {
    return this.advance(tx, playerId, OnboardingStep.UPGRADE, occurredAt);
  }

  advanceAfterUpgrade(tx: Prisma.TransactionClient, playerId: string, occurredAt: Date): Promise<void> {
    return this.advance(tx, playerId, OnboardingStep.RAID, occurredAt);
  }

  completeAfterStandardRaid(tx: Prisma.TransactionClient, playerId: string, battleId: string, occurredAt: Date): Promise<void> {
    return this.advance(tx, playerId, OnboardingStep.COMPLETE, occurredAt, battleId);
  }

  private async advance(
    tx: Prisma.TransactionClient,
    playerId: string,
    target: OnboardingStep,
    occurredAt: Date,
    battleId?: string,
  ): Promise<void> {
    const player = await tx.player.findUniqueOrThrow({ where: { id: playerId }, select: { isSystemOpponent: true } });
    if (player.isSystemOpponent) return;
    const current = await tx.onboardingProgress.findUnique({ where: { playerId } });
    if (current?.status === OnboardingStatus.SKIPPED || current?.status === OnboardingStatus.COMPLETED) return;
    if (current && STEP_RANK[current.currentStep] >= STEP_RANK[target]) return;

    const completed = target === OnboardingStep.COMPLETE;
    await tx.onboardingProgress.upsert({
      where: { playerId },
      create: {
        playerId,
        status: completed ? OnboardingStatus.COMPLETED : OnboardingStatus.IN_PROGRESS,
        currentStep: target,
        startedAt: occurredAt,
        completedAt: completed ? occurredAt : null,
      },
      update: {
        status: completed ? OnboardingStatus.COMPLETED : OnboardingStatus.IN_PROGRESS,
        currentStep: target,
        startedAt: current?.startedAt ?? occurredAt,
        completedAt: completed ? occurredAt : current?.completedAt,
      },
    });
    if (completed) {
      await this.analytics.recordServer(tx, {
        playerId,
        eventName: 'onboarding_completed',
        dedupeKey: `onboarding_completed:${playerId}`,
        properties: battleId ? { battleId } : {},
        occurredAt,
      });
    }
  }

  private async reconcile(tx: Prisma.TransactionClient, playerId: string, now: Date) {
    const player = await tx.player.findUniqueOrThrow({ where: { id: playerId }, select: { isSystemOpponent: true } });
    const existing = await tx.onboardingProgress.findUnique({ where: { playerId } });
    if (player.isSystemOpponent) {
      return existing ?? {
        id: '', playerId, status: OnboardingStatus.SKIPPED, currentStep: OnboardingStep.COMPLETE,
        startedAt: null, completedAt: null, skippedAt: now, createdAt: now, updatedAt: now,
      };
    }
    if (existing?.status === OnboardingStatus.SKIPPED || existing?.status === OnboardingStatus.COMPLETED) return existing;

    const milestones = await tx.analyticsEvent.findMany({
      where: { playerId, eventName: { in: ['first_raid_completed', 'first_upgrade', 'first_collect'] } },
      orderBy: { occurredAt: 'asc' },
      select: { eventName: true, occurredAt: true },
    });
    if (milestones.length === 0) return existing ?? {
      id: '', playerId, status: OnboardingStatus.NOT_STARTED, currentStep: OnboardingStep.WELCOME,
      startedAt: null, completedAt: null, skippedAt: null, createdAt: now, updatedAt: now,
    };

    const raid = milestones.find((item) => item.eventName === 'first_raid_completed');
    const upgrade = milestones.find((item) => item.eventName === 'first_upgrade');
    const collect = milestones.find((item) => item.eventName === 'first_collect');
    const milestone = raid ?? upgrade ?? collect!;
    const target = raid
      ? OnboardingStep.COMPLETE
      : upgrade
        ? OnboardingStep.RAID
        : OnboardingStep.UPGRADE;
    if (existing && STEP_RANK[existing.currentStep] >= STEP_RANK[target]) return existing;
    const completed = target === OnboardingStep.COMPLETE;
    const state = await tx.onboardingProgress.upsert({
      where: { playerId },
      create: {
        playerId,
        status: completed ? OnboardingStatus.COMPLETED : OnboardingStatus.IN_PROGRESS,
        currentStep: target,
        startedAt: milestone.occurredAt,
        completedAt: completed ? milestone.occurredAt : null,
      },
      update: {
        status: completed ? OnboardingStatus.COMPLETED : OnboardingStatus.IN_PROGRESS,
        currentStep: target,
        startedAt: existing?.startedAt ?? milestone.occurredAt,
        completedAt: completed ? milestone.occurredAt : existing?.completedAt,
      },
    });
    if (completed) {
      await this.analytics.recordServer(tx, {
        playerId,
        eventName: 'onboarding_completed',
        dedupeKey: `onboarding_completed:${playerId}`,
        properties: { reconciled: true },
        occurredAt: milestone.occurredAt,
      });
    }
    return state;
  }

  private present(state: {
    status: OnboardingStatus;
    currentStep: OnboardingStep;
    startedAt: Date | null;
    completedAt: Date | null;
    skippedAt: Date | null;
  }, now: Date): OnboardingStateResponse {
    return {
      status: state.status,
      currentStep: state.currentStep,
      startedAt: state.startedAt?.toISOString() ?? null,
      completedAt: state.completedAt?.toISOString() ?? null,
      skippedAt: state.skippedAt?.toISOString() ?? null,
      serverTime: now.toISOString(),
    };
  }

  private lock(tx: Prisma.TransactionClient, playerId: string): Promise<unknown> {
    return tx.$queryRaw`SELECT 1 AS acquired FROM pg_advisory_xact_lock(hashtext(${`onboarding:${playerId}`}))`;
  }
}
