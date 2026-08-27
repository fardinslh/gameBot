export const SUPPORTED_PLATFORMS = ['BALE', 'TELEGRAM', 'WEB'] as const;

export type SupportedPlatform = (typeof SUPPORTED_PLATFORMS)[number];

export const CLIENT_ANALYTICS_EVENT_NAMES = [
  'app_open',
  'app_resume',
  'screen_opened',
  'onboarding_started',
  'onboarding_step_seen',
] as const;
export type ClientAnalyticsEventName = (typeof CLIENT_ANALYTICS_EVENT_NAMES)[number];

export interface ClientAnalyticsEventInput {
  eventId: string;
  eventName: ClientAnalyticsEventName;
  sessionId: string;
  locale?: string;
  appVersion?: string;
  acquisitionSource?: string;
  properties?: Record<string, unknown>;
  clientOccurredAt?: string;
}

export interface AnalyticsEventsRequest { events: ClientAnalyticsEventInput[]; }
export interface AnalyticsEventsResponse {
  accepted: string[];
  duplicates: string[];
  rejected: Array<{ eventId: string; reason: string }>;
}

export const ONBOARDING_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'] as const;
export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];
export const ONBOARDING_STEPS = ['WELCOME', 'COLLECT', 'UPGRADE', 'RAID', 'COMPLETE'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export interface OnboardingStateResponse {
  status: OnboardingStatus;
  currentStep: OnboardingStep;
  startedAt: string | null;
  completedAt: string | null;
  skippedAt: string | null;
  serverTime: string;
}

export const ADVISOR_TIP_KEYS = [
  'HEROES_INTRO',
  'CASTLE_PROGRESSION',
  'NEW_KINGDOM_SHIELD',
  'DEFENSE_INBOX',
  'REVENGE',
] as const;
export type AdvisorTipKey = (typeof ADVISOR_TIP_KEYS)[number];
export interface AdvisorTipsResponse { seen: AdvisorTipKey[]; }

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
  'ACADEMY',
  'BLACKSMITH',
  'WATCHTOWER',
  'WORKSHOP',
] as const;
export type KingdomBuildingType = (typeof KINGDOM_BUILDING_TYPES)[number];

export type BuildingAppearanceVariant = 'WOOD' | 'STONE' | 'FORTIFIED';
export type KingdomExpansionStage = 1 | 2 | 3 | 4 | 5;

export const KINGDOM_EFFECT_TYPES = [
  'PRODUCTION_BONUS',
  'HERO_UPGRADE_DISCOUNT',
  'RAID_PROTECTION_BONUS',
  'BUILDING_UPGRADE_SPEED',
] as const;
export type KingdomEffectType = (typeof KINGDOM_EFFECT_TYPES)[number];

export interface KingdomBuildingEffectState {
  type: KingdomEffectType;
  valueBps: number;
  nextLevelValueBps: number | null;
}

export interface KingdomProgressionState {
  level: number;
  xp: number;
  xpIntoLevel: number;
  xpRequiredForNextLevel: number | null;
}

export interface KingdomUnlockState {
  key: KingdomBuildingType | 'ADVANCED_PVP';
  kind: 'BUILDING' | 'FEATURE';
  requiredCastleLevel: number;
  unlocked: boolean;
}

export type UpgradeAvailability =
  | 'CAN_UPGRADE'
  | 'BUILDING_LOCKED'
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
  buildingType: KingdomBuildingType;
  level: number;
  nextLevel: number | null;
  resource: ResourceType | null;
  productionPerHour: string;
  collectable: string;
  nextProductionPerHour: string | null;
  upgradeCost: UpgradeCostItem[];
  upgradeDurationSeconds: number | null;
  requiredCastleLevel: number | null;
  remainingSeconds: number;
  upgradeStartedAt: string | null;
  upgradeFinishedAt: string | null;
  appearanceVariant: BuildingAppearanceVariant;
  unlocked: boolean;
  unlockCastleLevel: number;
  upgradeAvailability: UpgradeAvailability;
  activeUpgrade: ActiveUpgradeState | null;
  effects: KingdomBuildingEffectState[];
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
  progression: KingdomProgressionState;
  kingdomExpansionStage: KingdomExpansionStage;
  unlocks: KingdomUnlockState[];
  balances: ResourceAmounts;
  storageCapacities: ResourceAmounts;
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
  | 'UPGRADE_NOT_READY'
  | 'BUILDING_LOCKED'
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

export type RaidResourceType = Exclude<ResourceType, 'GEMS'>;
export type RaidLootAmounts = Record<RaidResourceType, string>;
export type BattleSide = 'ATTACKER' | 'DEFENDER';
export type BattleResult = 'ATTACKER_WIN' | 'DEFENDER_WIN';
export type BattleType = 'RAID' | 'REVENGE';
export type BattleEventType =
  | 'BATTLE_START'
  | 'BASIC_ATTACK'
  | 'SKILL_CAST'
  | 'DAMAGE'
  | 'BUFF_APPLIED'
  | 'BUFF_EXPIRED'
  | 'HERO_DEFEATED'
  | 'BATTLE_END';

export interface BattleHeroState {
  side: BattleSide;
  slot: 1 | 2 | 3;
  key: HeroKey;
  level: number;
  hp: number;
  atk: number;
  def: number;
  power: number;
  skillKey: HeroSkillKey;
  portraitAsset: string;
}

export interface BattleEventState {
  sequence: number;
  timeMs: number;
  type: BattleEventType;
  sourceSide: BattleSide | null;
  sourceSlot: 1 | 2 | 3 | null;
  targetSide: BattleSide | null;
  targetSlot: 1 | 2 | 3 | null;
  amount: number | null;
  remainingHp: number | null;
  skillKey: HeroSkillKey | null;
}

export interface RaidTeamPreview {
  heroes: HeroState[];
  power: number;
}

export interface NewPlayerProtectionState {
  active: boolean;
  expiresAt: string | null;
}

export interface RaidOverviewResponse {
  player: { id: string; displayName: string; level: number; trophies: number };
  balances: ResourceAmounts;
  team: RaidTeamPreview;
  newPlayerProtection: NewPlayerProtectionState;
  serverTime: string;
}

export interface RaidMatchOfferState {
  id: string;
  expiresAt: string;
  opponent: {
    id: string;
    displayName: string;
    castleLevel: number;
    trophies: number;
    teamPower: number;
    team: HeroState[];
    kind: 'REAL' | 'SYSTEM';
  };
  ownPower: number;
  potentialLoot: RaidLootAmounts;
}

export interface RaidSearchResponse extends RaidOverviewResponse {
  offer: RaidMatchOfferState;
}

export interface BattleReplayResponse {
  id: string;
  type: BattleType;
  seed: string;
  rulesVersion: number;
  result: BattleResult;
  winnerPlayerId: string;
  durationMs: number;
  attacker: { playerId: string; displayName: string; trophiesBefore: number; trophyDelta: number };
  defender: { playerId: string; displayName: string; trophiesBefore: number; trophyDelta: number };
  teams: { attacker: BattleHeroState[]; defender: BattleHeroState[] };
  events: BattleEventState[];
  loot: RaidLootAmounts;
  balances: ResourceAmounts;
  resolvedAt: string;
}

export interface RaidHistoryItem {
  battleId: string;
  opponentName: string;
  result: BattleResult;
  wasAttacker: boolean;
  trophyDelta: number;
  loot: RaidLootAmounts;
  createdAt: string;
}

export interface RaidHistoryResponse {
  battles: RaidHistoryItem[];
}

export type RevengeStatus = 'AVAILABLE' | 'USED' | 'EXPIRED' | 'INVALID' | 'UNAVAILABLE';
export type DefenseResult = 'DEFENSE_WIN' | 'DEFENSE_LOSS';

export interface DefenseInboxItem {
  battleId: string;
  battleType: BattleType;
  attacker: { id: string; displayName: string };
  createdAt: string;
  defenseResult: DefenseResult;
  lootLost: RaidLootAmounts;
  trophyDelta: number;
  revengeStatus: RevengeStatus;
  revengeTargetId: string | null;
  revengeExpiresAt: string | null;
}

export interface DefenseInboxResponse {
  entries: DefenseInboxItem[];
  unreadCount: number;
  serverTime: string;
}

export interface RevengePreviewResponse {
  revengeTargetId: string;
  sourceBattleId: string;
  status: RevengeStatus;
  target: { id: string; displayName: string; trophies: number; teamPower: number };
  ownTeam: RaidTeamPreview;
  potentialLoot: RaidLootAmounts;
  expiresAt: string;
  serverTime: string;
}

export type NotificationType = 'PLAYER_RAIDED' | 'REVENGE_AVAILABLE' | 'UPGRADE_COMPLETE';
export type DeepLinkIntent =
  | { screen: 'INBOX'; battleId?: string }
  | { screen: 'REVENGE'; revengeTargetId: string }
  | { screen: 'BUILDING'; buildingId: string };

export interface NotificationState {
  id: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  deepLinkIntent: DeepLinkIntent;
  createdAt: string;
  readAt: string | null;
}

export type RaidErrorCode =
  | 'NO_OPPONENT_AVAILABLE'
  | 'MATCH_OFFER_EXPIRED'
  | 'MATCH_OFFER_ALREADY_USED'
  | 'MATCH_OFFER_NOT_FOUND'
  | 'MATCH_OFFER_NOT_OWNER'
  | 'INVALID_RAID_TEAM'
  | 'OPPONENT_NOT_FOUND'
  | 'BATTLE_NOT_FOUND'
  | 'BATTLE_NOT_PARTICIPANT'
  | 'SELF_ATTACK_FORBIDDEN'
  | 'INSUFFICIENT_OR_INVALID_STATE'
  | 'INVALID_IDEMPOTENCY_KEY'
  | 'REVENGE_NOT_FOUND'
  | 'REVENGE_NOT_OWNER'
  | 'REVENGE_EXPIRED'
  | 'REVENGE_ALREADY_USED'
  | 'REVENGE_INVALID_SOURCE'
  | 'RAID_CONFLICT'
  | 'RATE_LIMITED';

export interface RaidErrorResponse {
  statusCode: number;
  code: RaidErrorCode;
  message: string;
}
