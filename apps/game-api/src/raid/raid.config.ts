import type { RaidLootAmounts, RaidResourceType } from '@crown-and-coin/shared';

export const RAID_OFFER_TTL_MS = 180_000;
export const RAID_RECENT_OPPONENT_LIMIT = 8;
export const RAID_HISTORY_LIMIT = 20;
export const REVENGE_TTL_MS = 24 * 60 * 60 * 1_000;
export const NEW_KINGDOM_SHIELD_MS = 24 * 60 * 60 * 1_000;
export const REAL_PLAYER_REPEAT_RAID_COOLDOWN_MS = 6 * 60 * 60 * 1_000;
export const RAID_CANDIDATE_POOL_SIZE = 5;
export const RAID_PROTECTED_BPS = 7_000n;

export const REAL_PLAYER_MATCH_PASSES = [
  { trophyDifference: 150, powerDifferenceRatio: 0.15 },
  { trophyDifference: 300, powerDifferenceRatio: 0.30 },
  { trophyDifference: 450, powerDifferenceRatio: 0.40 },
] as const;

export const RAID_LOOT_CAP: Record<RaidResourceType, bigint> = {
  GOLD: 8_000n,
  FOOD: 6_000n,
  WOOD: 5_000n,
  STONE: 4_000n,
};

export const RAID_LOOT_RESERVE: Record<RaidResourceType, bigint> = {
  GOLD: 2_000n,
  FOOD: 1_000n,
  WOOD: 1_000n,
  STONE: 800n,
};

export const EMPTY_RAID_LOOT: RaidLootAmounts = { GOLD: '0', FOOD: '0', WOOD: '0', STONE: '0' };
