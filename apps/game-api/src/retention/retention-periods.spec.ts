import { describe, expect, it } from 'vitest';
import { DAILY_MISSIONS } from './retention.config';
import { dailyPeriod, deterministicSelection, weeklyPeriod } from './retention-periods';

describe('retention periods and selection', () => {
  it('uses UTC midnight regardless of timestamp offset', () => {
    expect(dailyPeriod(new Date('2026-08-29T23:59:59.999-07:00')).key).toBe('2026-08-30');
    expect(dailyPeriod(new Date('2026-08-30T00:00:00.000Z')).endsAt.toISOString()).toBe('2026-08-31T00:00:00.000Z');
  });

  it('uses Monday-based UTC weeks', () => {
    const period = weeklyPeriod(new Date('2026-08-30T12:00:00.000Z'));
    expect(period.key).toBe('2026-08-24');
    expect(period.endsAt.toISOString()).toBe('2026-08-31T00:00:00.000Z');
  });

  it('selects exactly three stable daily missions per player and period', () => {
    const first = deterministicSelection(DAILY_MISSIONS, 3, 'player-a', '2026-08-29').map((item) => item.key);
    const repeated = deterministicSelection(DAILY_MISSIONS, 3, 'player-a', '2026-08-29').map((item) => item.key);
    expect(first).toHaveLength(3);
    expect(new Set(first).size).toBe(3);
    expect(repeated).toEqual(first);
  });
});
