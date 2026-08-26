import { AnalyticsSource, Platform, PrismaClient } from '@prisma/client';
import { buildAnalyticsReport } from './analytics.reporting';
import { CLIENT_ANALYTICS_EVENTS, RESERVED_ANALYTICS_EVENTS, SERVER_ANALYTICS_EVENTS } from './analytics.events';

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const value = (flag: string): string | undefined => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};

async function main(): Promise<void> {
  if (args.includes('--check')) {
    const [reserved, wrongServer, wrongClient, systemEvents] = await Promise.all([
      prisma.analyticsEvent.count({ where: { eventName: { in: [...RESERVED_ANALYTICS_EVENTS] } } }),
      prisma.analyticsEvent.count({ where: { source: AnalyticsSource.SERVER, eventName: { notIn: [...SERVER_ANALYTICS_EVENTS] } } }),
      prisma.analyticsEvent.count({ where: { source: AnalyticsSource.CLIENT, eventName: { notIn: [...CLIENT_ANALYTICS_EVENTS] } } }),
      prisma.analyticsEvent.count({ where: { player: { isSystemOpponent: true } } }),
    ]);
    const result = { ok: reserved + wrongServer + wrongClient + systemEvents === 0, reserved, wrongServer, wrongClient, systemEvents };
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
    return;
  }
  const from = value('--from');
  const to = value('--to');
  const platform = value('--platform')?.toUpperCase() as Platform | undefined;
  const locale = value('--locale');
  const source = value('--source')?.toUpperCase();
  const rows = await prisma.analyticsEvent.findMany({ orderBy: { occurredAt: 'asc' } });
  const report = buildAnalyticsReport(rows, new Date(), {
    from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined, platform, locale, source,
  });
  console.log(JSON.stringify(report, null, args.includes('--json') ? 0 : 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
