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
  'daily_return_available',
  'daily_return_claimed',
  'daily_mission_completed',
  'daily_mission_claimed',
  'daily_all_completed',
  'weekly_mission_completed',
  'weekly_mission_claimed',
  'achievement_completed',
  'achievement_claimed',
  'army_bootstrapped',
  'troop_training_started',
  'troop_training_completed',
  'army_formation_saved',
  'army_battle_started',
  'army_battle_finished',
  'campaign_opened',
  'campaign_stage_started',
  'campaign_stage_won',
  'campaign_stage_lost',
  'campaign_star_improved',
  'campaign_star_reward_claimed',
  'campaign_chapter_completed',
] as const;

export const CLIENT_ANALYTICS_EVENTS = [
  'app_open',
  'app_resume',
  'screen_opened',
  'onboarding_started',
  'onboarding_step_seen',
  'retention_screen_opened',
] as const;
export const RESERVED_ANALYTICS_EVENTS: readonly string[] = [];

export type ServerAnalyticsEventName = (typeof SERVER_ANALYTICS_EVENTS)[number];
export type ClientAnalyticsEventName = (typeof CLIENT_ANALYTICS_EVENTS)[number];

export const ANALYTICS_SCHEMA_VERSION = 1;
export const MAX_ANALYTICS_BATCH_SIZE = 20;
export const MAX_ANALYTICS_PROPERTIES_BYTES = 2_048;
