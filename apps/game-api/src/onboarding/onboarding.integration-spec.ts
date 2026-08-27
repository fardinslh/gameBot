import { AnalyticsSource, OnboardingStatus, OnboardingStep, Platform } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AnalyticsService } from '../analytics/analytics.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { OnboardingService } from './onboarding.service';
import { AdvisorTipsService } from './advisor-tips.service';

describe('onboarding integration', () => {
  const prisma = new PrismaService();
  const analytics = new AnalyticsService(prisma);
  const onboarding = new OnboardingService(prisma, analytics);
  const advisorTips = new AdvisorTipsService(prisma);
  const playerIds: string[] = [];

  beforeAll(() => prisma.$connect());
  afterAll(async () => {
    await prisma.advisorTipProgress.deleteMany({ where: { playerId: { in: playerIds } } });
    await prisma.analyticsEvent.deleteMany({ where: { playerId: { in: playerIds } } });
    await prisma.onboardingProgress.deleteMany({ where: { playerId: { in: playerIds } } });
    await prisma.player.deleteMany({ where: { id: { in: playerIds } } });
    await prisma.$disconnect();
  });

  async function player(system = false) {
    const created = await prisma.player.create({ data: { isSystemOpponent: system } });
    playerIds.push(created.id);
    return created;
  }

  it('persists the welcome, Collect, Upgrade, and standard Raid progression across reads', async () => {
    const owner = await player();
    expect(await onboarding.get(owner.id)).toMatchObject({ status: 'NOT_STARTED', currentStep: 'WELCOME' });
    expect(await onboarding.start(owner.id)).toMatchObject({ status: 'IN_PROGRESS', currentStep: 'COLLECT' });
    await prisma.$transaction((tx) => onboarding.advanceAfterCollect(tx, owner.id, new Date()));
    expect(await new OnboardingService(prisma, analytics).get(owner.id)).toMatchObject({ status: 'IN_PROGRESS', currentStep: 'UPGRADE' });
    await prisma.$transaction((tx) => onboarding.advanceAfterUpgrade(tx, owner.id, new Date()));
    expect(await onboarding.get(owner.id)).toMatchObject({ status: 'IN_PROGRESS', currentStep: 'RAID' });
    await prisma.$transaction((tx) => onboarding.completeAfterStandardRaid(tx, owner.id, randomUUID(), new Date()));
    await prisma.$transaction((tx) => onboarding.completeAfterStandardRaid(tx, owner.id, randomUUID(), new Date()));
    expect(await onboarding.get(owner.id)).toMatchObject({ status: 'COMPLETED', currentStep: 'COMPLETE' });
    expect(await prisma.analyticsEvent.count({ where: { playerId: owner.id, eventName: 'onboarding_completed' } })).toBe(1);
  });

  it('keeps skip durable without fabricating activation or later progress', async () => {
    const owner = await player();
    expect(await onboarding.skip(owner.id)).toMatchObject({ status: 'SKIPPED', currentStep: 'COMPLETE' });
    await prisma.$transaction((tx) => onboarding.advanceAfterCollect(tx, owner.id, new Date()));
    await prisma.$transaction((tx) => onboarding.completeAfterStandardRaid(tx, owner.id, randomUUID(), new Date()));
    expect(await onboarding.get(owner.id)).toMatchObject({ status: 'SKIPPED', currentStep: 'COMPLETE' });
    expect(await prisma.analyticsEvent.count({ where: { playerId: owner.id, eventName: { in: ['onboarding_completed', 'first_raid_completed'] } } })).toBe(0);
  });

  it('reconciles historical first milestones without inventing missing history', async () => {
    const collectOwner = await player();
    const upgradeOwner = await player();
    const raidOwner = await player();
    const noneOwner = await player();
    await prisma.analyticsEvent.createMany({ data: [
      { playerId: collectOwner.id, source: AnalyticsSource.SERVER, eventName: 'first_collect', platform: Platform.WEB, properties: {} },
      { playerId: upgradeOwner.id, source: AnalyticsSource.SERVER, eventName: 'first_upgrade', platform: Platform.WEB, properties: {} },
      { playerId: raidOwner.id, source: AnalyticsSource.SERVER, eventName: 'first_raid_completed', platform: Platform.WEB, properties: {} },
    ] });
    expect(await onboarding.get(collectOwner.id)).toMatchObject({ status: 'IN_PROGRESS', currentStep: 'UPGRADE' });
    expect(await onboarding.get(upgradeOwner.id)).toMatchObject({ status: 'IN_PROGRESS', currentStep: 'RAID' });
    expect(await onboarding.get(raidOwner.id)).toMatchObject({ status: 'COMPLETED', currentStep: 'COMPLETE' });
    expect(await onboarding.get(noneOwner.id)).toMatchObject({ status: 'NOT_STARTED', currentStep: 'WELCOME' });
  });

  it('never enrolls system opponents', async () => {
    const system = await player(true);
    expect(await onboarding.get(system.id)).toMatchObject({ status: OnboardingStatus.SKIPPED, currentStep: OnboardingStep.COMPLETE });
    expect(await prisma.onboardingProgress.count({ where: { playerId: system.id } })).toBe(0);
  });

  it('persists each contextual advisor introduction once and remains idempotent', async () => {
    const owner = await player();
    expect(await advisorTips.get(owner.id)).toEqual({ seen: [] });
    await advisorTips.dismiss(owner.id, 'HEROES_INTRO');
    await advisorTips.dismiss(owner.id, 'HEROES_INTRO');
    await advisorTips.dismiss(owner.id, 'CASTLE_PROGRESSION');
    expect((await new AdvisorTipsService(prisma).get(owner.id)).seen.sort()).toEqual(['CASTLE_PROGRESSION', 'HEROES_INTRO']);
    expect(await prisma.advisorTipProgress.count({ where: { playerId: owner.id } })).toBe(2);
  });
});
