import { createHash } from 'node:crypto';

export interface RetentionPeriod {
  key: string;
  startsAt: Date;
  endsAt: Date;
}

const DAY_MS = 86_400_000;

export function dailyPeriod(now: Date): RetentionPeriod {
  const startsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const endsAt = new Date(startsAt.getTime() + DAY_MS);
  return { key: startsAt.toISOString().slice(0, 10), startsAt, endsAt };
}

export function weeklyPeriod(now: Date): RetentionPeriod {
  const day = dailyPeriod(now).startsAt;
  const daysSinceMonday = (day.getUTCDay() + 6) % 7;
  const startsAt = new Date(day.getTime() - daysSinceMonday * DAY_MS);
  const endsAt = new Date(startsAt.getTime() + 7 * DAY_MS);
  return { key: startsAt.toISOString().slice(0, 10), startsAt, endsAt };
}

export function deterministicSelection<T extends { key: string }>(
  definitions: readonly T[],
  count: number,
  playerId: string,
  periodKey: string,
): T[] {
  return [...definitions]
    .map((definition) => ({
      definition,
      rank: createHash('sha256').update(`${playerId}:${periodKey}:${definition.key}`).digest('hex'),
    }))
    .sort((left, right) => left.rank.localeCompare(right.rank) || left.definition.key.localeCompare(right.definition.key))
    .slice(0, count)
    .map(({ definition }) => definition);
}
