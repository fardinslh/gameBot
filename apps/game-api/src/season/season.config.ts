import {
  type TrophyLeague,
  type SeasonRewardTier,
  SEASON_REWARD_TIERS,
} from '@crown-and-coin/shared';

export const SEASON_DURATION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
export const TROPHY_RESET_THRESHOLD = 2000;
export const TROPHY_RESET_FACTOR = 0.5;

export const SEASON_NAMES = [
  'Season of the Iron Crown',
  'Season of the Crimson Blade',
  'Season of the Golden Lion',
  'Season of the Dragon Banner',
  'Season of the Northern Shield',
  'Season of the Sovereign Sun',
  'Season of the Shadow Citadel',
  'Season of the Eternal Flame',
];

export function getSeasonName(seasonNumber: number): string {
  const index = (seasonNumber - 1) % SEASON_NAMES.length;
  return `${SEASON_NAMES[index]} (Season ${seasonNumber})`;
}

export function calculateTrophySoftReset(trophies: number): number {
  if (trophies <= TROPHY_RESET_THRESHOLD) {
    return trophies;
  }
  return TROPHY_RESET_THRESHOLD + Math.floor((trophies - TROPHY_RESET_THRESHOLD) * TROPHY_RESET_FACTOR);
}

export function getRewardForLeague(league: TrophyLeague): SeasonRewardTier {
  return SEASON_REWARD_TIERS[league] ?? SEASON_REWARD_TIERS.BRONZE;
}
