export const SUPPORTED_PLATFORMS = ['BALE', 'TELEGRAM', 'WEB'] as const;

export type SupportedPlatform = (typeof SUPPORTED_PLATFORMS)[number];

export interface HealthResponse {
  status: 'ok';
}

export const RESOURCE_TYPES = ['GOLD', 'FOOD', 'WOOD', 'STONE', 'GEMS'] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const KINGDOM_BUILDING_TYPES = [
  'CASTLE',
  'FARM',
  'LUMBER_MILL',
  'MINE',
  'GRAND_MARKET',
] as const;
export type KingdomBuildingType = (typeof KINGDOM_BUILDING_TYPES)[number];

export type UpgradeAvailability =
  | 'CAN_UPGRADE'
  | 'INSUFFICIENT_RESOURCES'
  | 'CASTLE_LEVEL_REQUIRED'
  | 'UPGRADE_IN_PROGRESS'
  | 'MAX_LEVEL';

export type ResourceAmounts = Record<ResourceType, string>;

export interface UpgradeCostItem {
  resource: ResourceType;
  amount: string;
}

export interface ActiveUpgradeState {
  id: string;
  fromLevel: number;
  toLevel: number;
  startedAt: string;
  finishAt: string;
}

export interface KingdomBuildingState {
  id: string;
  type: KingdomBuildingType;
  level: number;
  resource: ResourceType | null;
  productionPerHour: string;
  collectable: string;
  nextProductionPerHour: string | null;
  upgradeCost: UpgradeCostItem[];
  upgradeDurationSeconds: number | null;
  requiredCastleLevel: number | null;
  upgradeAvailability: UpgradeAvailability;
  activeUpgrade: ActiveUpgradeState | null;
}

export interface KingdomStateResponse {
  player: {
    id: string;
    displayName: string;
    level: number;
  };
  kingdom: {
    id: string;
    name: string;
    level: number;
    lastCollectedAt: string;
  };
  balances: ResourceAmounts;
  buildings: KingdomBuildingState[];
  serverTime: string;
  offlineCapHours: number;
}

export interface CollectResponse {
  gains: ResourceAmounts;
  balances: ResourceAmounts;
  buildings: KingdomBuildingState[];
  lastCollectedAt: string;
  serverTime: string;
}

export interface UpgradeResponse {
  building: KingdomBuildingState;
  balances: ResourceAmounts;
  serverTime: string;
}

export type EconomyErrorCode =
  | 'INSUFFICIENT_RESOURCES'
  | 'UPGRADE_ALREADY_ACTIVE'
  | 'CASTLE_LEVEL_REQUIRED'
  | 'MAX_LEVEL'
  | 'BUILDING_NOT_FOUND'
  | 'NOT_BUILDING_OWNER'
  | 'INVALID_IDEMPOTENCY_KEY'
  | 'ECONOMY_CONFLICT';

export interface EconomyErrorResponse {
  statusCode: number;
  code: EconomyErrorCode;
  message: string;
}

export const HERO_KEYS = ['KNIGHT', 'RANGER', 'MAGE'] as const;
export type HeroKey = (typeof HERO_KEYS)[number];

export const HERO_COMBAT_CLASSES = ['TANK', 'SINGLE_TARGET_DPS', 'AOE_BURST'] as const;
export type HeroCombatClass = (typeof HERO_COMBAT_CLASSES)[number];

export type HeroSkillKey = 'SHIELD_WALL' | 'POWER_SHOT' | 'ARCANE_BLAST';

export interface HeroState {
  id: string;
  key: HeroKey;
  level: number;
  class: HeroCombatClass;
  hp: number;
  atk: number;
  def: number;
  power: number;
  skill: { key: HeroSkillKey };
  portraitAsset: string;
  canUpgrade: boolean;
  maximumLevel: number;
  upgradeCost: { gold: string } | null;
}

export interface RaidTeamSlotState {
  slot: 1 | 2 | 3;
  playerHeroId: string;
}

export interface RaidTeamState {
  slots: RaidTeamSlotState[];
  power: number;
}

export interface HeroesResponse {
  player: {
    id: string;
    displayName: string;
    level: number;
  };
  heroes: HeroState[];
  team: RaidTeamState;
  balances: ResourceAmounts;
  serverTime: string;
}

export interface RaidTeamResponse {
  team: RaidTeamState;
  serverTime: string;
}

export interface HeroUpgradeResponse {
  hero: HeroState;
  team: RaidTeamState;
  balances: ResourceAmounts;
  serverTime: string;
}

export type HeroErrorCode =
  | 'HERO_NOT_FOUND'
  | 'NOT_HERO_OWNER'
  | 'HERO_DISABLED'
  | 'INVALID_TEAM_SIZE'
  | 'DUPLICATE_TEAM_HERO'
  | 'INVALID_TEAM_HERO'
  | 'HERO_MAX_LEVEL'
  | 'HERO_INSUFFICIENT_GOLD'
  | 'INVALID_IDEMPOTENCY_KEY'
  | 'HERO_CONFLICT';

export interface HeroErrorResponse {
  statusCode: number;
  code: HeroErrorCode;
  message: string;
}
