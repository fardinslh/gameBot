import { describe, expect, it } from 'vitest';
import type { ClientAnalyticsEventInput } from '@crown-and-coin/shared';
import { boundAnalyticsQueue, reconcileAnalyticsQueue } from './analytics-queue';

const event = (index: number): ClientAnalyticsEventInput => ({
  eventId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  eventName: 'app_open',
  sessionId: '00000000-0000-4000-8000-000000000001',
});

describe('analytics queue', () => {
  it('bounds storage to the newest 50 events', () => {
    expect(boundAnalyticsQueue(Array.from({ length: 55 }, (_, index) => event(index))).map((item) => item.eventId))
      .toEqual(Array.from({ length: 50 }, (_, index) => event(index + 5).eventId));
  });

  it('removes acknowledged events without dropping an event queued during the request', () => {
    const current = [event(1), event(2), event(3)];
    expect(reconcileAnalyticsQueue(current, { accepted: [event(1).eventId], duplicates: [event(2).eventId], rejected: [] }))
      .toEqual([event(3)]);
  });
});
