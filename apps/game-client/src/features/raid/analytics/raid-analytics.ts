export type RaidAnalyticsEvent =
  | 'raid_opened'
  | 'raid_search'
  | 'raid_offer_received'
  | 'raid_started'
  | 'raid_finished'
  | 'raid_win'
  | 'raid_loss';

export function trackRaidEvent(event: RaidAnalyticsEvent, properties: Record<string, string | number> = {}): void {
  if (process.env.NODE_ENV !== 'production') console.info('[raid-analytics]', event, properties);
}
