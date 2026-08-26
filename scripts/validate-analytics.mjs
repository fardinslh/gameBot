import { AnalyticsSource, Platform, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { buildAnalyticsReport } from '../apps/game-api/dist/analytics/analytics.reporting.js';

const prisma = new PrismaClient();
const playerIds = [];
const now = new Date();
const hoursAgo = (hours) => new Date(now.getTime() - hours * 3_600_000);

try {
  const player = await prisma.player.create({ data: { displayName: 'Analytics Validation' } });
  playerIds.push(player.id);
  const names = [
    ['player_created', 220], ['first_collect', 219], ['first_upgrade', 218], ['raid_search', 217],
    ['first_raid_completed', 216], ['app_open', 190], ['collect_completed', 140], ['raid_finished', 46], ['raid_win', 46],
  ];
  await prisma.analyticsEvent.createMany({
    data: names.map(([eventName, age]) => ({
      id: randomUUID(), playerId: player.id, source: eventName === 'app_open' ? AnalyticsSource.CLIENT : AnalyticsSource.SERVER,
      eventName, schemaVersion: 1, platform: Platform.WEB, locale: 'fa', acquisitionSource: 'VALIDATION',
      properties: eventName === 'raid_finished' ? { opponentKind: 'SYSTEM' } : {}, occurredAt: hoursAgo(age),
    })),
  });
  const rows = await prisma.analyticsEvent.findMany({ where: { playerId: player.id }, orderBy: { occurredAt: 'asc' } });
  const report = buildAnalyticsReport(rows, now);
  if (report.activation.players !== 1 || report.retention.d1.retained !== 1 || report.retention.d3.retained !== 1 || report.retention.d7.retained !== 1) {
    throw new Error(`Unexpected validation report: ${JSON.stringify(report)}`);
  }
  console.log(JSON.stringify({ ok: true, fixture: 'isolated-and-removed', funnel: report.funnel, retention: report.retention, acquisition: report.acquisition }, null, 2));
} finally {
  if (playerIds.length) await prisma.player.deleteMany({ where: { id: { in: playerIds } } });
  await prisma.$disconnect();
}
