export const SERVER_ANALYTICS_EVENTS = [
  'player_created',
  'collect_completed',
  'first_collect',
  'building_upgrade_started',
  'first_upgrade',
  'hero_upgrade_completed',
  'raid_search',
  'raid_started',
  'raid_finished',
  'raid_win',
  'raid_loss',
  'first_raid_completed',
  'revenge_started',
  'revenge_finished',
  'onboarding_completed',
] as const;

export const CLIENT_ANALYTICS_EVENTS = [
  'app_open',
  'app_resume',
  'screen_opened',
  'onboarding_started',
  'onboarding_step_seen',
] as const;
export const RESERVED_ANALYTICS_EVENTS: readonly string[] = [];

export type ServerAnalyticsEventName = (typeof SERVER_ANALYTICS_EVENTS)[number];
export type ClientAnalyticsEventName = (typeof CLIENT_ANALYTICS_EVENTS)[number];

export const ANALYTICS_SCHEMA_VERSION = 1;
export const MAX_ANALYTICS_BATCH_SIZE = 20;
export const MAX_ANALYTICS_PROPERTIES_BYTES = 2_048;
