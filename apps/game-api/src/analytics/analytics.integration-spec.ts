import { AnalyticsSource, Platform } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { AnalyticsService } from './analytics.service';

describe('first-party analytics integration', () => {
  const prisma = new PrismaService();
  const analytics = new AnalyticsService(prisma);
  const playerIds: string[] = [];

  beforeAll(() => prisma.$connect());
  afterAll(async () => {
    await prisma.analyticsEvent.deleteMany({ where: { playerId: { in: playerIds } } });
    await prisma.player.deleteMany({ where: { id: { in: playerIds } } });
    await prisma.$disconnect();
  });

  it('deduplicates client and server events and excludes system opponents', async () => {
    const player = await prisma.player.create({ data: { platformAccounts: { create: { platform: Platform.WEB, externalUserId: `analytics-${randomUUID()}` } } } });
    const system = await prisma.player.create({ data: { isSystemOpponent: true } });
    playerIds.push(player.id, system.id);
    const eventId = randomUUID();
    const input = [{ eventId, eventName: 'app_open' as const, sessionId: randomUUID(), properties: { route: 'kingdom' } }];
    expect((await analytics.ingestClient(player.id, Platform.WEB, input)).accepted).toEqual([eventId]);
    expect((await analytics.ingestClient(player.id, Platform.WEB, input)).duplicates).toEqual([eventId]);
    await analytics.recordServer(prisma, { playerId: player.id, eventName: 'first_collect', dedupeKey: `first_collect:${player.id}` });
    await analytics.recordServer(prisma, { playerId: player.id, eventName: 'first_collect', dedupeKey: `first_collect:${player.id}` });
    await analytics.recordServer(prisma, { playerId: system.id, eventName: 'raid_finished', dedupeKey: `system:${system.id}` });
    const systemClient = await analytics.ingestClient(system.id, Platform.WEB, [{
      eventId: randomUUID(), eventName: 'app_open', sessionId: randomUUID(), properties: {},
    }]);
    expect(systemClient.accepted).toHaveLength(0);
    expect(systemClient.rejected[0]?.reason).toBe('player_not_eligible');
    expect(await prisma.analyticsEvent.count({ where: { playerId: player.id } })).toBe(2);
    expect(await prisma.analyticsEvent.count({ where: { playerId: system.id } })).toBe(0);
  });

  it('rolls analytics back with the authoritative gameplay transaction', async () => {
    const player = await prisma.player.create({ data: {} });
    playerIds.push(player.id);
    await expect(prisma.$transaction(async (tx) => {
      await analytics.recordServer(tx, { playerId: player.id, eventName: 'collect_completed', dedupeKey: `rollback:${player.id}` });
      throw new Error('rollback');
    })).rejects.toThrow('rollback');
    expect(await prisma.analyticsEvent.count({ where: { dedupeKey: `rollback:${player.id}` } })).toBe(0);
  });

  it('rejects properties above 2KB without blocking valid events', async () => {
    const player = await prisma.player.create({ data: {} });
    playerIds.push(player.id);
    const eventId = randomUUID();
    const result = await analytics.ingestClient(player.id, Platform.WEB, [{
      eventId, eventName: 'screen_opened', sessionId: randomUUID(), properties: { oversized: 'x'.repeat(2_100) },
    }]);
    expect(result).toEqual({ accepted: [], duplicates: [], rejected: [{ eventId, reason: 'properties_too_large_or_invalid' }] });
  });
});
