import { describe, expect, it } from 'vitest';
import { AnalyticsSource, Platform, type Prisma } from '@prisma/client';
import { buildAnalyticsReport, type ReportingEvent } from './analytics.reporting';

const at = (hours: number): Date => new Date(Date.UTC(2026, 0, 1) + hours * 3_600_000);
const event = (playerId: string, eventName: string, hours: number, properties: Prisma.JsonValue = {}): ReportingEvent => ({
  playerId, eventName, source: eventName === 'app_open' ? AnalyticsSource.CLIENT : AnalyticsSource.SERVER,
  platform: Platform.WEB, locale: 'fa', acquisitionSource: 'DIRECT', properties, occurredAt: at(hours),
});

describe('analytics reporting', () => {
  it('uses activation-relative mature D1/D3/D7 windows and qualifying activity only', () => {
    const report = buildAnalyticsReport([
      event('p1', 'player_created', 0),
      event('p1', 'first_collect', 1),
      event('p1', 'first_upgrade', 2),
      event('p1', 'raid_search', 3),
      event('p1', 'first_raid_completed', 10),
      event('p1', 'app_open', 34),
      event('p1', 'screen_opened', 82),
      event('p1', 'collect_completed', 83),
      event('p1', 'raid_finished', 178, { opponentKind: 'SYSTEM' }),
      event('p1', 'raid_win', 178),
    ], at(250));

    expect(report.funnel.map((step) => step.players)).toEqual([1, 1, 1, 1, 1]);
    expect(report.activation.rate).toBe(1);
    expect(report.retention.d1).toMatchObject({ eligible: 1, retained: 1, rate: 1 });
    expect(report.retention.d3).toMatchObject({ eligible: 1, retained: 1, rate: 1 });
    expect(report.retention.d7).toMatchObject({ eligible: 1, retained: 1, rate: 1 });
    expect(report.engagement.systemRaidShare).toBe(1);
    expect(report.warnings).toHaveLength(2);
  });

  it('does not count immature cohorts or screen-only activity', () => {
    const report = buildAnalyticsReport([
      event('p2', 'player_created', 0),
      event('p2', 'first_raid_completed', 10),
      event('p2', 'screen_opened', 35),
    ], at(40));
    expect(report.retention.d1).toMatchObject({ eligible: 0, retained: 0, rate: null });
    expect(report.engagement.activePlayers).toBe(0);
  });
});
