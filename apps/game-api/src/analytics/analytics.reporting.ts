import type { AnalyticsSource, Platform, Prisma } from '@prisma/client';

export const FUNNEL_EVENTS = ['player_created', 'first_collect', 'first_upgrade', 'raid_search', 'first_raid_completed'] as const;
export const QUALIFYING_ACTIVITY_EVENTS = new Set([
  'app_open', 'collect_completed', 'building_upgrade_started', 'hero_upgrade_completed',
  'raid_search', 'raid_finished', 'revenge_finished',
]);

export interface ReportingEvent {
  playerId: string;
  eventName: string;
  source: AnalyticsSource;
  platform: Platform;
  locale: string | null;
  acquisitionSource: string | null;
  properties: Prisma.JsonValue;
  occurredAt: Date;
}

export interface AnalyticsReport {
  generatedAt: string;
  filters: Record<string, string | null>;
  funnel: Array<{ eventName: string; players: number; conversionFromCreated: number | null }>;
  activation: { players: number; rate: number | null };
  retention: Record<'d1' | 'd3' | 'd7', { eligible: number; retained: number; rate: number | null; directionalOnly: boolean }>;
  acquisition: Array<{ source: string; created: number; activated: number; activationRate: number | null; d1Rate: number | null; d7Rate: number | null }>;
  daily: Array<{ date: string; created: number; activated: number; active: number }>;
  engagement: {
    activatedPlayers: number;
    activePlayers: number;
    raidsPerActivated: number | null;
    wins: number;
    losses: number;
    winRate: number | null;
    systemRaidShare: number | null;
    realRaidShare: number | null;
    revengeAttempts: number;
    revengeCompletions: number;
    collectsPerActive: number | null;
    upgradesPerActive: number | null;
  };
  warnings: string[];
}

interface ReportFilters { from?: Date; to?: Date; platform?: Platform; locale?: string; source?: string; }

const ratio = (part: number, whole: number): number | null => whole === 0 ? null : Number((part / whole).toFixed(4));

export function buildAnalyticsReport(allEvents: ReportingEvent[], now: Date, filters: ReportFilters = {}): AnalyticsReport {
  const baseEvents = allEvents.filter((event) =>
    (!filters.from || event.occurredAt >= filters.from)
    && (!filters.to || event.occurredAt < filters.to)
    && (!filters.platform || event.platform === filters.platform)
    && (!filters.locale || event.locale === filters.locale),
  );
  const sourceByPlayer = new Map<string, string>();
  for (const event of baseEvents.slice().sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())) {
    if (!sourceByPlayer.has(event.playerId) && event.acquisitionSource) sourceByPlayer.set(event.playerId, event.acquisitionSource);
  }
  const events = filters.source
    ? baseEvents.filter((event) => (sourceByPlayer.get(event.playerId) ?? 'UNKNOWN') === filters.source)
    : baseEvents;
  const playersFor = (name: string): Set<string> => new Set(events.filter((event) => event.eventName === name).map((event) => event.playerId));
  const created = playersFor('player_created');
  const activated = playersFor('first_raid_completed');
  const activations = new Map<string, Date>();
  for (const event of events.filter((item) => item.eventName === 'first_raid_completed').sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())) {
    if (!activations.has(event.playerId)) activations.set(event.playerId, event.occurredAt);
  }

  const retentionFor = (startHours: number, endHours: number, threshold: number) => {
    const eligible = [...activations].filter(([, at]) => now.getTime() >= at.getTime() + endHours * 3_600_000);
    const retained = eligible.filter(([playerId, at]) => events.some((event) =>
      event.playerId === playerId && QUALIFYING_ACTIVITY_EVENTS.has(event.eventName)
      && event.occurredAt >= new Date(at.getTime() + startHours * 3_600_000)
      && event.occurredAt < new Date(at.getTime() + endHours * 3_600_000),
    )).length;
    return { eligible: eligible.length, retained, rate: ratio(retained, eligible.length), directionalOnly: eligible.length < threshold };
  };
  const retention = {
    d1: retentionFor(24, 48, 100),
    d3: retentionFor(72, 96, 100),
    d7: retentionFor(168, 192, 150),
  };

  const sources = new Set([...created].map((playerId) => sourceByPlayer.get(playerId) ?? 'UNKNOWN'));
  const retainedIn = (playerId: string, start: number, end: number): boolean => {
    const activation = activations.get(playerId);
    return !!activation && events.some((event) => event.playerId === playerId && QUALIFYING_ACTIVITY_EVENTS.has(event.eventName)
      && event.occurredAt >= new Date(activation.getTime() + start * 3_600_000)
      && event.occurredAt < new Date(activation.getTime() + end * 3_600_000));
  };
  const acquisition = [...sources].sort().map((source) => {
    const cohort = [...created].filter((playerId) => (sourceByPlayer.get(playerId) ?? 'UNKNOWN') === source);
    const cohortActivated = cohort.filter((playerId) => activated.has(playerId));
    const d1Eligible = cohortActivated.filter((playerId) => now.getTime() >= activations.get(playerId)!.getTime() + 48 * 3_600_000);
    const d7Eligible = cohortActivated.filter((playerId) => now.getTime() >= activations.get(playerId)!.getTime() + 192 * 3_600_000);
    return {
      source, created: cohort.length, activated: cohortActivated.length, activationRate: ratio(cohortActivated.length, cohort.length),
      d1Rate: ratio(d1Eligible.filter((id) => retainedIn(id, 24, 48)).length, d1Eligible.length),
      d7Rate: ratio(d7Eligible.filter((id) => retainedIn(id, 168, 192)).length, d7Eligible.length),
    };
  });

  const finished = events.filter((event) => event.eventName === 'raid_finished');
  const wins = events.filter((event) => event.eventName === 'raid_win').length;
  const losses = events.filter((event) => event.eventName === 'raid_loss').length;
  const system = finished.filter((event) => (event.properties as Record<string, unknown>)?.opponentKind === 'SYSTEM').length;
  const activePlayers = new Set(events.filter((event) => QUALIFYING_ACTIVITY_EVENTS.has(event.eventName)).map((event) => event.playerId));
  const warnings: string[] = [];
  if (retention.d1.directionalOnly) warnings.push(`D1 sample is directional only (${retention.d1.eligible} mature activated players; 100 recommended).`);
  if (retention.d7.directionalOnly) warnings.push(`D7 sample is directional only (${retention.d7.eligible} mature activated players; 150 recommended).`);
  const days = new Map<string, ReportingEvent[]>();
  for (const event of events) {
    const day = event.occurredAt.toISOString().slice(0, 10);
    days.set(day, [...(days.get(day) ?? []), event]);
  }

  return {
    generatedAt: now.toISOString(),
    filters: { from: filters.from?.toISOString() ?? null, to: filters.to?.toISOString() ?? null, platform: filters.platform ?? null, locale: filters.locale ?? null, source: filters.source ?? null },
    funnel: FUNNEL_EVENTS.map((eventName) => ({ eventName, players: playersFor(eventName).size, conversionFromCreated: ratio(playersFor(eventName).size, created.size) })),
    activation: { players: activated.size, rate: ratio(activated.size, created.size) },
    retention,
    acquisition,
    daily: [...days].sort(([a], [b]) => a.localeCompare(b)).map(([date, rows]) => ({
      date,
      created: new Set(rows.filter((event) => event.eventName === 'player_created').map((event) => event.playerId)).size,
      activated: new Set(rows.filter((event) => event.eventName === 'first_raid_completed').map((event) => event.playerId)).size,
      active: new Set(rows.filter((event) => QUALIFYING_ACTIVITY_EVENTS.has(event.eventName)).map((event) => event.playerId)).size,
    })),
    engagement: {
      activatedPlayers: activated.size, activePlayers: activePlayers.size,
      raidsPerActivated: ratio(finished.length, activated.size), wins, losses, winRate: ratio(wins, wins + losses),
      systemRaidShare: ratio(system, finished.length), realRaidShare: ratio(finished.length - system, finished.length),
      revengeAttempts: events.filter((event) => event.eventName === 'revenge_started').length,
      revengeCompletions: events.filter((event) => event.eventName === 'revenge_finished').length,
      collectsPerActive: ratio(events.filter((event) => event.eventName === 'collect_completed').length, activePlayers.size),
      upgradesPerActive: ratio(events.filter((event) => event.eventName === 'building_upgrade_started' || event.eventName === 'hero_upgrade_completed').length, activePlayers.size),
    },
    warnings,
  };
}
