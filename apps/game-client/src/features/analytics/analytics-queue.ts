import type { AnalyticsEventsResponse, ClientAnalyticsEventInput } from '@crown-and-coin/shared';

export const MAX_ANALYTICS_QUEUE_SIZE = 50;

export function boundAnalyticsQueue(events: ClientAnalyticsEventInput[]): ClientAnalyticsEventInput[] {
  return events.slice(-MAX_ANALYTICS_QUEUE_SIZE);
}

export function reconcileAnalyticsQueue(
  current: ClientAnalyticsEventInput[],
  result: AnalyticsEventsResponse,
): ClientAnalyticsEventInput[] {
  const handled = new Set([...result.accepted, ...result.duplicates, ...result.rejected.map((item) => item.eventId)]);
  return current.filter((event) => !handled.has(event.eventId));
}
