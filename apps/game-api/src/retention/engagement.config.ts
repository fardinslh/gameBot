import type { RetentionRewardItem } from '@crown-and-coin/shared';

export const RETURN_SUMMARY_MIN_AWAY_SECONDS = 300;
export const ROYAL_DECREE_REWARDS: RetentionRewardItem[] = [
  { resource: 'GOLD', amount: '1500' },
  { resource: 'WOOD', amount: '800' },
  { resource: 'GEMS', amount: '5' },
];
export const ROYAL_DECREE_TARGETS = {
  castleLevel: 2n,
  collectCount: 2n,
  raidCount: 2n,
} as const;
