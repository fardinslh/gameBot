import type { RaidLootAmounts, RaidResourceType } from '@crown-and-coin/shared';

export const RAID_OFFER_TTL_MS = 180_000;
export const RAID_RECENT_OPPONENT_LIMIT = 5;
export const RAID_HISTORY_LIMIT = 20;
export const RAID_PROTECTED_BPS = 7_000n;

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

export const DEVELOPMENT_OPPONENTS = [
  { externalId: 'raid-fixture:iron-wolf', name: 'Iron Wolf', kingdom: 'Ironhold', trophies: 850, level: 1, resources: [14_000n, 10_000n, 8_000n, 7_000n] },
  { externalId: 'raid-fixture:silver-fox', name: 'Silver Fox', kingdom: 'Moonwatch', trophies: 920, level: 1, resources: [18_000n, 12_000n, 11_000n, 8_000n] },
  { externalId: 'raid-fixture:lion-heart', name: 'Lion Heart', kingdom: 'Sunspire', trophies: 1_000, level: 2, resources: [22_000n, 16_000n, 14_000n, 12_000n] },
  { externalId: 'raid-fixture:black-raven', name: 'Black Raven', kingdom: 'Nightfall', trophies: 1_100, level: 2, resources: [28_000n, 20_000n, 18_000n, 15_000n] },
  { externalId: 'raid-fixture:storm-keep', name: 'Storm Keep', kingdom: 'Stormkeep', trophies: 1_220, level: 3, resources: [36_000n, 28_000n, 22_000n, 20_000n] },
] as const;

