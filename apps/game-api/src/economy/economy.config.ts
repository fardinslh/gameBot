import type { KingdomBuildingType, ResourceType } from '@crown-and-coin/shared';

export interface BuildingEconomyConfig {
  resource: ResourceType | null;
  baseProductionPerHour: number;
  productionGrowth: number;
  baseUpgradeCost: Partial<Record<ResourceType, number>>;
  costGrowth: number;
  baseUpgradeSeconds: number;
  durationGrowth: number;
  maximumLevel: number;
}

export const OFFLINE_STORAGE_CAP_HOURS = 8;

export const STARTING_RESOURCES: Record<ResourceType, bigint> = {
  GOLD: 8_000n,
  FOOD: 5_000n,
  WOOD: 5_000n,
  STONE: 3_500n,
  GEMS: 120n,
};

export const ECONOMY_CONFIG: Record<KingdomBuildingType, BuildingEconomyConfig> = {
  CASTLE: {
    resource: null,
    baseProductionPerHour: 0,
    productionGrowth: 1,
    baseUpgradeCost: { GOLD: 1_000, WOOD: 500, STONE: 500 },
    costGrowth: 1.35,
    baseUpgradeSeconds: 20,
    durationGrowth: 1.25,
    maximumLevel: 20,
  },
  FARM: {
    resource: 'FOOD',
    baseProductionPerHour: 500,
    productionGrowth: 1.18,
    baseUpgradeCost: { GOLD: 350, WOOD: 120 },
    costGrowth: 1.22,
    baseUpgradeSeconds: 10,
    durationGrowth: 1.2,
    maximumLevel: 20,
  },
  LUMBER_MILL: {
    resource: 'WOOD',
    baseProductionPerHour: 420,
    productionGrowth: 1.18,
    baseUpgradeCost: { GOLD: 400, FOOD: 100 },
    costGrowth: 1.22,
    baseUpgradeSeconds: 12,
    durationGrowth: 1.2,
    maximumLevel: 20,
  },
  MINE: {
    resource: 'STONE',
    baseProductionPerHour: 300,
    productionGrowth: 1.18,
    baseUpgradeCost: { GOLD: 450, FOOD: 100, WOOD: 180 },
    costGrowth: 1.22,
    baseUpgradeSeconds: 14,
    durationGrowth: 1.2,
    maximumLevel: 20,
  },
  GRAND_MARKET: {
    resource: 'GOLD',
    baseProductionPerHour: 380,
    productionGrowth: 1.18,
    baseUpgradeCost: { FOOD: 200, WOOD: 150, STONE: 120 },
    costGrowth: 1.22,
    baseUpgradeSeconds: 16,
    durationGrowth: 1.2,
    maximumLevel: 20,
  },
};

export function productionPerHour(type: KingdomBuildingType, level: number): bigint {
  const config = ECONOMY_CONFIG[type];
  if (!config.resource) return 0n;
  return BigInt(Math.round(config.baseProductionPerHour * config.productionGrowth ** (level - 1)));
}

export function upgradeCost(type: KingdomBuildingType, currentLevel: number): Partial<Record<ResourceType, bigint>> {
  const config = ECONOMY_CONFIG[type];
  return Object.fromEntries(
    Object.entries(config.baseUpgradeCost).map(([resource, base]) => [
      resource,
      BigInt(Math.ceil((base ?? 0) * config.costGrowth ** (currentLevel - 1))),
    ]),
  );
}

export function upgradeDurationSeconds(type: KingdomBuildingType, currentLevel: number): number {
  const config = ECONOMY_CONFIG[type];
  const configuredMultiplier = Number(process.env.ECONOMY_TIMER_MULTIPLIER ?? 1);
  const multiplier = Number.isFinite(configuredMultiplier) && configuredMultiplier > 0
    ? configuredMultiplier
    : 1;
  return Math.max(1, Math.ceil(config.baseUpgradeSeconds * config.durationGrowth ** (currentLevel - 1) * multiplier));
}

export function requiredCastleLevel(type: KingdomBuildingType, targetLevel: number): number | null {
  if (type === 'CASTLE') return null;
  return Math.max(1, Math.ceil(targetLevel / 3));
}
