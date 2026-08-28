import type { ResourceType, RetentionMetric } from '@crown-and-coin/shared';

export interface RewardDefinition { resource: ResourceType; amount: bigint; }
export interface MissionDefinition {
  key: string;
  metric: RetentionMetric;
  target: bigint;
  rewards: readonly RewardDefinition[];
  enabled: boolean;
  sortOrder: number;
}
export interface AchievementTierDefinition { tier: number; target: bigint; rewards: readonly RewardDefinition[]; }
export interface AchievementDefinition {
  key: string;
  metric: RetentionMetric;
  tiers: readonly AchievementTierDefinition[];
  enabled: boolean;
  sortOrder: number;
}

const reward = (resource: ResourceType, amount: number): RewardDefinition => ({ resource, amount: BigInt(amount) });
const tier = (tierNumber: number, target: number, rewards: RewardDefinition[]): AchievementTierDefinition => ({ tier: tierNumber, target: BigInt(target), rewards });

export const DAILY_MISSION_COUNT = 3;
export const WEEKLY_MISSION_COUNT = 3;

export const DAILY_MISSIONS: readonly MissionDefinition[] = [
  { key: 'DAILY_COLLECTOR', metric: 'COLLECT_COUNT', target: 2n, rewards: [reward('GOLD', 600), reward('GEMS', 1)], enabled: true, sortOrder: 10 },
  { key: 'DAILY_BUILDER', metric: 'BUILDING_UPGRADE_STARTED', target: 1n, rewards: [reward('WOOD', 400), reward('GEMS', 1)], enabled: true, sortOrder: 20 },
  { key: 'DAILY_KINGDOM_GROWTH', metric: 'BUILDING_UPGRADE_COMPLETED', target: 1n, rewards: [reward('STONE', 400), reward('GEMS', 1)], enabled: true, sortOrder: 30 },
  { key: 'DAILY_HERO_TRAINING', metric: 'HERO_UPGRADE_COUNT', target: 1n, rewards: [reward('FOOD', 500), reward('GEMS', 1)], enabled: true, sortOrder: 40 },
  { key: 'DAILY_RAIDER', metric: 'RAID_COMPLETED', target: 2n, rewards: [reward('GOLD', 800), reward('GEMS', 1)], enabled: true, sortOrder: 50 },
  { key: 'DAILY_VICTORY', metric: 'RAID_WON', target: 1n, rewards: [reward('FOOD', 600), reward('GEMS', 1)], enabled: true, sortOrder: 60 },
];

export const WEEKLY_MISSIONS: readonly MissionDefinition[] = [
  { key: 'WEEKLY_COLLECTOR', metric: 'COLLECT_COUNT', target: 10n, rewards: [reward('GOLD', 2500), reward('GEMS', 2)], enabled: true, sortOrder: 10 },
  { key: 'WEEKLY_BUILDER', metric: 'BUILDING_UPGRADE_STARTED', target: 5n, rewards: [reward('WOOD', 1800), reward('STONE', 1200), reward('GEMS', 2)], enabled: true, sortOrder: 20 },
  { key: 'WEEKLY_HERO_TRAINING', metric: 'HERO_UPGRADE_COUNT', target: 3n, rewards: [reward('FOOD', 2000), reward('GOLD', 1200), reward('GEMS', 2)], enabled: true, sortOrder: 30 },
  { key: 'WEEKLY_RAIDER', metric: 'RAID_COMPLETED', target: 10n, rewards: [reward('GOLD', 3000), reward('GEMS', 3)], enabled: true, sortOrder: 40 },
  { key: 'WEEKLY_VICTORIES', metric: 'RAID_WON', target: 5n, rewards: [reward('GOLD', 2200), reward('FOOD', 1500), reward('GEMS', 3)], enabled: true, sortOrder: 50 },
];

export const DAILY_COMPLETION_REWARDS: readonly RewardDefinition[] = [
  reward('GOLD', 1000), reward('FOOD', 600), reward('WOOD', 600), reward('STONE', 600), reward('GEMS', 2),
];

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  { key: 'KINGDOM_RULER', metric: 'CASTLE_LEVEL_REACHED', enabled: true, sortOrder: 10, tiers: [
    tier(1, 3, [reward('GOLD', 1200), reward('GEMS', 2)]), tier(2, 5, [reward('GOLD', 2200), reward('GEMS', 3)]), tier(3, 10, [reward('GOLD', 5000), reward('GEMS', 5)]), tier(4, 15, [reward('GOLD', 9000), reward('GEMS', 7)]), tier(5, 20, [reward('GOLD', 15000), reward('GEMS', 10)]),
  ] },
  { key: 'MASTER_BUILDER', metric: 'BUILDING_LEVEL_TOTAL', enabled: true, sortOrder: 20, tiers: [
    tier(1, 20, [reward('WOOD', 1000), reward('STONE', 700), reward('GEMS', 2)]), tier(2, 40, [reward('WOOD', 2200), reward('STONE', 1600), reward('GEMS', 3)]), tier(3, 75, [reward('WOOD', 5000), reward('STONE', 3500), reward('GEMS', 5)]), tier(4, 120, [reward('WOOD', 9000), reward('STONE', 6500), reward('GEMS', 7)]), tier(5, 160, [reward('WOOD', 14000), reward('STONE', 10000), reward('GEMS', 10)]),
  ] },
  { key: 'DEDICATED_BUILDER', metric: 'BUILDING_UPGRADE_COMPLETED', enabled: true, sortOrder: 30, tiers: [
    tier(1, 5, [reward('GOLD', 1200), reward('GEMS', 2)]), tier(2, 20, [reward('GOLD', 3500), reward('GEMS', 3)]), tier(3, 50, [reward('GOLD', 8000), reward('GEMS', 5)]), tier(4, 100, [reward('GOLD', 15000), reward('GEMS', 8)]),
  ] },
  { key: 'ROYAL_TREASURY', metric: 'COLLECT_RESOURCE_TOTAL', enabled: true, sortOrder: 40, tiers: [
    tier(1, 10_000, [reward('GOLD', 1000), reward('GEMS', 2)]), tier(2, 100_000, [reward('GOLD', 3500), reward('GEMS', 3)]), tier(3, 500_000, [reward('GOLD', 9000), reward('GEMS', 5)]), tier(4, 2_000_000, [reward('GOLD', 20000), reward('GEMS', 8)]),
  ] },
  { key: 'HERO_TRAINER', metric: 'HERO_UPGRADE_COUNT', enabled: true, sortOrder: 50, tiers: [
    tier(1, 5, [reward('FOOD', 1200), reward('GOLD', 800), reward('GEMS', 2)]), tier(2, 15, [reward('FOOD', 3000), reward('GOLD', 1800), reward('GEMS', 3)]), tier(3, 30, [reward('FOOD', 6500), reward('GOLD', 4000), reward('GEMS', 5)]), tier(4, 60, [reward('FOOD', 12000), reward('GOLD', 8000), reward('GEMS', 8)]),
  ] },
  { key: 'RAIDER', metric: 'RAID_COMPLETED', enabled: true, sortOrder: 60, tiers: [
    tier(1, 5, [reward('GOLD', 1200), reward('GEMS', 2)]), tier(2, 25, [reward('GOLD', 4000), reward('GEMS', 3)]), tier(3, 100, [reward('GOLD', 10000), reward('GEMS', 5)]), tier(4, 250, [reward('GOLD', 22000), reward('GEMS', 8)]),
  ] },
  { key: 'CONQUEROR', metric: 'RAID_WON', enabled: true, sortOrder: 70, tiers: [
    tier(1, 5, [reward('GOLD', 1500), reward('GEMS', 2)]), tier(2, 20, [reward('GOLD', 4500), reward('GEMS', 3)]), tier(3, 75, [reward('GOLD', 11000), reward('GEMS', 6)]), tier(4, 200, [reward('GOLD', 25000), reward('GEMS', 9)]),
  ] },
  { key: 'REVENGER', metric: 'REVENGE_COMPLETED', enabled: true, sortOrder: 80, tiers: [
    tier(1, 1, [reward('STONE', 800), reward('GEMS', 2)]), tier(2, 5, [reward('STONE', 2200), reward('GOLD', 1200), reward('GEMS', 3)]), tier(3, 20, [reward('STONE', 6500), reward('GOLD', 4000), reward('GEMS', 6)]),
  ] },
  { key: 'TROPHY_CLIMBER', metric: 'TROPHY_REACHED', enabled: true, sortOrder: 90, tiers: [
    tier(1, 1100, [reward('GOLD', 1200), reward('GEMS', 2)]), tier(2, 1300, [reward('GOLD', 3500), reward('GEMS', 3)]), tier(3, 1600, [reward('GOLD', 8000), reward('GEMS', 5)]), tier(4, 2000, [reward('GOLD', 16000), reward('GEMS', 8)]),
  ] },
];

export const DAILY_RETURN_REWARDS: ReadonlyArray<{ dayIndex: number; rewards: readonly RewardDefinition[] }> = [
  { dayIndex: 1, rewards: [reward('GOLD', 1000)] },
  { dayIndex: 2, rewards: [reward('FOOD', 750), reward('WOOD', 750)] },
  { dayIndex: 3, rewards: [reward('STONE', 800), reward('GOLD', 800)] },
  { dayIndex: 4, rewards: [reward('GEMS', 2)] },
  { dayIndex: 5, rewards: [reward('FOOD', 1200), reward('WOOD', 1200), reward('STONE', 900)] },
  { dayIndex: 6, rewards: [reward('GOLD', 2500)] },
  { dayIndex: 7, rewards: [reward('GOLD', 2000), reward('FOOD', 1500), reward('WOOD', 1500), reward('STONE', 1200), reward('GEMS', 5)] },
];

export function missionDefinition(key: string): MissionDefinition | undefined {
  // Keep already-assigned missions resolvable if live configuration disables
  // them after a period has started. Selection still filters disabled entries.
  return [...DAILY_MISSIONS, ...WEEKLY_MISSIONS].find((definition) => definition.key === key);
}

export function achievementDefinition(key: string): AchievementDefinition | undefined {
  return ACHIEVEMENTS.find((definition) => definition.key === key && definition.enabled);
}
