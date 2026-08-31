export const SUPPORTED_PLATFORMS = ['BALE', 'TELEGRAM', 'WEB'] as const;

export type SupportedPlatform = (typeof SUPPORTED_PLATFORMS)[number];

export const CLIENT_ANALYTICS_EVENT_NAMES = [
  'app_open',
  'app_resume',
  'screen_opened',
  'onboarding_started',
  'onboarding_step_seen',
  'retention_screen_opened',
  'shop_opened',
  'shop_purchase_failed',
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
  'CAMPAIGN_INTRO',
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

export interface KingdomEffectProgressState {
  buildingType: KingdomBuildingType;
  buildingLevel: number;
  effectType: KingdomEffectType;
  unlocked: boolean;
  valueBps: number;
  nextLevelValueBps: number | null;
}

export interface KingdomProgressGoalsState {
  castleLevel: number;
  milestones: KingdomUnlockState[];
  nextUnlock: KingdomUnlockState | null;
  allDistrictsUnlocked: boolean;
  effects: KingdomEffectProgressState[];
}

export type UpgradeAvailability =
  | 'CAN_UPGRADE'
  | 'BUILDING_LOCKED'
  | 'INSUFFICIENT_RESOURCES'
  | 'CASTLE_LEVEL_REQUIRED'
  | 'UPGRADE_IN_PROGRESS'
  | 'MAX_LEVEL';

export type ResourceAmounts = Record<ResourceType, string>;
export type StorageCapacities = Partial<Record<ResourceType, string>>;

export const RETENTION_METRICS = [
  'COLLECT_COUNT',
  'COLLECT_RESOURCE_TOTAL',
  'BUILDING_UPGRADE_STARTED',
  'BUILDING_UPGRADE_COMPLETED',
  'CASTLE_LEVEL_REACHED',
  'BUILDING_LEVEL_TOTAL',
  'HERO_UPGRADE_COUNT',
  'RAID_STARTED',
  'RAID_COMPLETED',
  'RAID_WON',
  'REVENGE_COMPLETED',
  'TROPHY_REACHED',
] as const;
export type RetentionMetric = (typeof RETENTION_METRICS)[number];
export type RetentionCadence = 'DAILY' | 'WEEKLY';
export interface RetentionRewardItem { resource: ResourceType; amount: string; }
export interface RetentionMissionState {
  id: string;
  key: string;
  cadence: RetentionCadence;
  metric: RetentionMetric;
  target: string;
  progress: string;
  completed: boolean;
  claimed: boolean;
  rewards: RetentionRewardItem[];
}
export interface RetentionCompletionBonusState {
  completedCount: number;
  requiredCount: number;
  eligible: boolean;
  claimed: boolean;
  rewards: RetentionRewardItem[];
}
export interface RetentionAchievementTierState {
  tier: number;
  target: string;
  completed: boolean;
  claimed: boolean;
  claimable: boolean;
  rewards: RetentionRewardItem[];
}
export interface RetentionAchievementFamilyState {
  key: string;
  metric: RetentionMetric;
  progress: string;
  tiers: RetentionAchievementTierState[];
  currentTier: RetentionAchievementTierState | null;
}
export interface DailyReturnDayState {
  dayIndex: number;
  rewards: RetentionRewardItem[];
  status: 'CLAIMED' | 'TODAY' | 'UPCOMING';
}
export interface DailyReturnState {
  currentDay: number;
  canClaimToday: boolean;
  lastClaimAt: string | null;
  nextClaimAt: string;
  cycle: DailyReturnDayState[];
}
export interface RetentionStateResponse {
  serverTime: string;
  dailyResetAt: string;
  weeklyResetAt: string;
  dailyReturn: DailyReturnState;
  daily: {
    periodKey: string;
    missions: RetentionMissionState[];
    completedCount: number;
    completionBonus: RetentionCompletionBonusState;
  };
  weekly: {
    periodKey: string;
    missions: RetentionMissionState[];
    completedCount: number;
  };
  achievements: { families: RetentionAchievementFamilyState[]; };
}
export interface RetentionClaimResponse {
  granted: RetentionRewardItem[];
  balances: ResourceAmounts;
  retention: RetentionStateResponse;
}
export type RetentionErrorCode =
  | 'INVALID_IDEMPOTENCY_KEY'
  | 'MISSION_NOT_FOUND'
  | 'MISSION_NOT_OWNER'
  | 'MISSION_EXPIRED'
  | 'MISSION_INCOMPLETE'
  | 'MISSION_ALREADY_CLAIMED'
  | 'DAILY_BONUS_INCOMPLETE'
  | 'DAILY_BONUS_ALREADY_CLAIMED'
  | 'ACHIEVEMENT_NOT_FOUND'
  | 'ACHIEVEMENT_INCOMPLETE'
  | 'ACHIEVEMENT_TIER_OUT_OF_ORDER'
  | 'ACHIEVEMENT_ALREADY_CLAIMED'
  | 'DAILY_RETURN_ALREADY_CLAIMED'
  | 'RETENTION_CONFLICT';
export interface RetentionErrorResponse { statusCode: number; code: RetentionErrorCode; message: string; }

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
    equippedProfileCrest: ProfileCrestKey;
  };
  kingdom: {
    id: string;
    name: string;
    level: number;
    lastCollectedAt: string;
  };
  progression: KingdomProgressionState;
  kingdomGoals: KingdomProgressGoalsState;
  kingdomExpansionStage: KingdomExpansionStage;
  unlocks: KingdomUnlockState[];
  balances: ResourceAmounts;
  storageCapacities: StorageCapacities;
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

export const SHOP_CATEGORIES = ['CONVENIENCE', 'COSMETICS'] as const;
export type ShopCategory = (typeof SHOP_CATEGORIES)[number];
export const PROFILE_CREST_KEYS = [
  'DEFAULT',
  'PROFILE_CREST_FOREST',
  'PROFILE_CREST_CRIMSON',
  'PROFILE_CREST_ROYAL',
] as const;
export type ProfileCrestKey = (typeof PROFILE_CREST_KEYS)[number];
export type PurchasableProfileCrestKey = Exclude<ProfileCrestKey, 'DEFAULT'>;
export const SHOP_PURCHASE_ITEM_KEYS = [
  'PROFILE_CREST_FOREST',
  'PROFILE_CREST_CRIMSON',
  'PROFILE_CREST_ROYAL',
  'BUILDING_FINISH',
  'TROOP_TRAINING_FINISH',
] as const;
export type ShopPurchaseItemKey = (typeof SHOP_PURCHASE_ITEM_KEYS)[number];
export type ShopFulfillmentType = 'PROFILE_CREST' | 'BUILDING_FINISH' | 'TROOP_TRAINING_FINISH';
export type ShopGemSource = 'DAILY_MISSIONS' | 'WEEKLY_MISSIONS' | 'ACHIEVEMENTS' | 'DAILY_RETURN';

export interface ShopCosmeticItemState {
  itemKey: PurchasableProfileCrestKey;
  category: 'COSMETICS';
  fulfillmentType: 'PROFILE_CREST';
  priceGems: number;
  displayOrder: number;
  enabled: boolean;
  owned: boolean;
  equipped: boolean;
}

export interface ShopBuildingFinishOffer {
  itemKey: 'BUILDING_FINISH';
  category: 'CONVENIENCE';
  fulfillmentType: 'BUILDING_FINISH';
  targetId: string;
  buildingId: string;
  buildingType: KingdomBuildingType;
  targetLevel: number;
  remainingSeconds: number;
  priceGems: number;
}

export interface ShopTroopTrainingFinishOffer {
  itemKey: 'TROOP_TRAINING_FINISH';
  category: 'CONVENIENCE';
  fulfillmentType: 'TROOP_TRAINING_FINISH';
  targetId: string;
  trainingOrderId: string;
  troopType: TroopType;
  quantity: number;
  remainingSeconds: number;
  priceGems: number;
}

export interface ShopStateResponse {
  serverTime: string;
  gemBalance: string;
  balances: ResourceAmounts;
  equippedProfileCrest: ProfileCrestKey;
  cosmetics: ShopCosmeticItemState[];
  convenience: {
    buildingFinishes: ShopBuildingFinishOffer[];
    troopTrainingFinish: ShopTroopTrainingFinishOffer | null;
  };
  gemSources: ShopGemSource[];
}

export interface ShopPurchaseRequest {
  itemKey: ShopPurchaseItemKey;
  targetId?: string;
}

export interface ShopPurchaseEvidence {
  id: string;
  itemKey: ShopPurchaseItemKey;
  category: ShopCategory;
  fulfillmentType: ShopFulfillmentType;
  gemPrice: number;
  targetType: string | null;
  targetId: string | null;
  createdAt: string;
}

export type ShopPurchaseTargetState =
  | { type: 'PROFILE_CREST'; itemKey: PurchasableProfileCrestKey; status: 'OWNED' }
  | { type: 'BUILDING_UPGRADE'; id: string; buildingId: string; status: 'COMPLETED'; level: number }
  | { type: 'TROOP_TRAINING'; id: string; troopType: TroopType; quantity: number; status: 'COMPLETED' };

export interface ShopPurchaseResponse {
  purchase: ShopPurchaseEvidence;
  gemBalance: string;
  balances: ResourceAmounts;
  equippedProfileCrest: ProfileCrestKey;
  target: ShopPurchaseTargetState;
  shop: ShopStateResponse;
  serverTime: string;
}

export interface EquipProfileCrestRequest { itemKey: ProfileCrestKey; }
export interface EquipProfileCrestResponse {
  equippedProfileCrest: ProfileCrestKey;
  shop: ShopStateResponse;
  serverTime: string;
}

export type ShopErrorCode =
  | 'SHOP_ITEM_NOT_FOUND'
  | 'SHOP_ITEM_DISABLED'
  | 'SHOP_ITEM_ALREADY_OWNED'
  | 'SHOP_TARGET_NOT_FOUND'
  | 'SHOP_TARGET_NOT_OWNER'
  | 'SHOP_TARGET_ALREADY_COMPLETE'
  | 'INSUFFICIENT_GEMS'
  | 'SHOP_INVALID_PURCHASE'
  | 'SHOP_ENTITLEMENT_REQUIRED'
  | 'INVALID_IDEMPOTENCY_KEY'
  | 'SHOP_CONFLICT';
export interface ShopErrorResponse { statusCode: number; code: ShopErrorCode; message: string; }

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

export const TROOP_TYPES = ['INFANTRY', 'ARCHER', 'CAVALRY'] as const;
export type TroopType = (typeof TROOP_TYPES)[number];

export interface ArmyTroopState {
  type: TroopType;
  readyCount: number;
  trainingCostPerUnit: Partial<Record<ResourceType, string>>;
  trainingSecondsPerUnit: number;
}

export interface ArmyCapacityState {
  maximum: number;
  ready: number;
  training: number;
  available: number;
}

export interface ArmyTrainingState {
  id: string;
  troopType: TroopType;
  quantity: number;
  startedAt: string;
  completesAt: string;
  remainingSeconds: number;
}

export interface ArmyCommanderState {
  playerHeroId: string;
  key: HeroKey;
  level: number;
  power: number;
  portraitAsset: string;
}

export interface ArmyFormationSlotState {
  slot: 1 | 2 | 3;
  troopType: TroopType;
  unitCount: number;
  commander: ArmyCommanderState;
  squadPower: number;
}

export interface ArmyFormationState {
  slots: ArmyFormationSlotState[];
}

export interface ArmyResponse {
  serverTime: string;
  power: number;
  capacity: ArmyCapacityState;
  troops: ArmyTroopState[];
  training: ArmyTrainingState | null;
  formation: ArmyFormationState;
  commanders: ArmyCommanderState[];
}

export interface ArmyTrainRequest {
  troopType: TroopType;
  quantity: number;
}

export interface ArmyFormationSlotInput {
  slot: 1 | 2 | 3;
  troopType: TroopType;
  unitCount: number;
  commanderPlayerHeroId: string;
}

export interface ArmyFormationSaveRequest {
  slots: ArmyFormationSlotInput[];
}

export interface ArmyTrainResponse extends ArmyResponse {
  balances: ResourceAmounts;
}

export type ArmyErrorCode =
  | 'INVALID_TROOP_TYPE'
  | 'INVALID_TRAINING_QUANTITY'
  | 'TRAINING_ALREADY_ACTIVE'
  | 'ARMY_CAPACITY_EXCEEDED'
  | 'INSUFFICIENT_RESOURCES'
  | 'FORMATION_INVALID'
  | 'FORMATION_TROOP_COUNT_EXCEEDED'
  | 'FORMATION_COMMANDER_DUPLICATE'
  | 'COMMANDER_NOT_OWNED'
  | 'COMMANDER_DISABLED'
  | 'INVALID_IDEMPOTENCY_KEY'
  | 'ARMY_CONFLICT';

export interface ArmyErrorResponse {
  statusCode: number;
  code: ArmyErrorCode;
  message: string;
}

export type RaidResourceType = Exclude<ResourceType, 'GEMS'>;
export type RaidLootAmounts = Record<RaidResourceType, string>;
export type BattleSide = 'ATTACKER' | 'DEFENDER';
export type BattleResult = 'ATTACKER_WIN' | 'DEFENDER_WIN';
export type BattleType = 'RAID' | 'REVENGE' | 'CAMPAIGN';
export type BattleEventType =
  | 'BATTLE_START'
  | 'BASIC_ATTACK'
  | 'SKILL_CAST'
  | 'DAMAGE'
  | 'BUFF_APPLIED'
  | 'BUFF_EXPIRED'
  | 'HERO_DEFEATED'
  | 'SQUAD_DEFEATED'
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
  remainingUnits?: number | null;
  skillKey: HeroSkillKey | null;
}

export interface BattleArmySquadState {
  side: BattleSide;
  slot: 1 | 2 | 3;
  troopType: TroopType;
  initialUnitCount: number;
  perUnitHp: number;
  perUnitAtk: number;
  perUnitDef: number;
  aggregateMaxHp: number;
  commanderKey: HeroKey;
  commanderLevel: number;
  commanderSkillKey: HeroSkillKey;
  commanderPower: number;
  commanderPortraitAsset: string;
  squadPower: number;
}

export interface ArmyPreview {
  squads: ArmyFormationSlotState[];
  power: number;
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
  army: ArmyPreview;
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
    armyPower: number;
    army: ArmyFormationSlotState[];
    kind: 'REAL' | 'SYSTEM';
  };
  ownPower: number;
  potentialLoot: RaidLootAmounts;
}

export interface RaidSearchResponse extends RaidOverviewResponse {
  offer: RaidMatchOfferState;
}

export interface BattleReplayBase {
  id: string;
  type: BattleType;
  seed: string;
  result: BattleResult;
  winnerPlayerId: string;
  durationMs: number;
  attacker: { playerId: string; displayName: string; trophiesBefore: number; trophyDelta: number };
  defender: { playerId: string; displayName: string; trophiesBefore: number; trophyDelta: number };
  events: BattleEventState[];
  loot: RaidLootAmounts;
  balances: ResourceAmounts;
  resolvedAt: string;
}

export interface BattleReplayV1 extends BattleReplayBase {
  rulesVersion: 1;
  teams: { attacker: BattleHeroState[]; defender: BattleHeroState[] };
}

export interface BattleReplayV2 extends BattleReplayBase {
  rulesVersion: 2;
  armies: { attacker: BattleArmySquadState[]; defender: BattleArmySquadState[] };
}

export type BattleReplayResponse = BattleReplayV1 | BattleReplayV2;

export const CAMPAIGN_CHAPTER_KEYS = ['BROKEN_FRONTIER'] as const;
export type CampaignChapterKey = (typeof CAMPAIGN_CHAPTER_KEYS)[number];
export const CAMPAIGN_STAGE_KEYS = [
  'FRONTIER_01', 'FRONTIER_02', 'FRONTIER_03',
  'FRONTIER_04', 'FRONTIER_05', 'FRONTIER_06',
  'FRONTIER_07', 'FRONTIER_08', 'FRONTIER_09',
] as const;
export type CampaignStageKey = (typeof CAMPAIGN_STAGE_KEYS)[number];
export type CampaignStageStatus = 'LOCKED' | 'AVAILABLE' | 'CLEARED';
export interface CampaignRewardItem { resource: ResourceType; amount: string; }
export interface CampaignEnemyPreview {
  displayName: { en: string; fa: string };
  castleLevel: number;
  power: number;
  army: ArmyFormationSlotState[];
}
export interface CampaignStageState {
  key: CampaignStageKey;
  index: number;
  title: { en: string; fa: string };
  status: CampaignStageStatus;
  requiredCastleLevel: number;
  lockReason: 'CASTLE' | 'PREVIOUS_STAGE' | null;
  bestStars: number;
  attempts: number;
  firstClearedAt: string | null;
  isBoss: boolean;
  enemy: CampaignEnemyPreview;
  firstClearRewards: CampaignRewardItem[];
}
export interface CampaignStarRewardState {
  stars: 9 | 18 | 27;
  status: 'LOCKED' | 'CLAIMABLE' | 'CLAIMED';
  rewards: CampaignRewardItem[];
  claimedAt: string | null;
}
export interface CampaignChapterState {
  key: CampaignChapterKey;
  title: { en: string; fa: string };
  totalStars: number;
  maximumStars: 27;
  completed: boolean;
  stages: CampaignStageState[];
  starRewards: CampaignStarRewardState[];
}
export interface CampaignResponse {
  serverTime: string;
  balances: ResourceAmounts;
  chapter: CampaignChapterState;
}
export interface CampaignBattleStartResponse {
  campaign: CampaignResponse;
  battle: BattleReplayV2;
  stageKey: CampaignStageKey;
  attemptStars: number;
  bestStars: number;
  firstClearRewardGranted: boolean;
  firstClearRewards: CampaignRewardItem[];
}
export interface CampaignRewardClaimResponse {
  campaign: CampaignResponse;
  granted: CampaignRewardItem[];
}
export type CampaignErrorCode =
  | 'CAMPAIGN_STAGE_NOT_FOUND'
  | 'CAMPAIGN_STAGE_LOCKED'
  | 'CAMPAIGN_CASTLE_REQUIRED'
  | 'CAMPAIGN_INVALID_ARMY'
  | 'CAMPAIGN_REWARD_LOCKED'
  | 'CAMPAIGN_REWARD_ALREADY_CLAIMED'
  | 'CAMPAIGN_CONFLICT'
  | 'INVALID_IDEMPOTENCY_KEY';
export interface CampaignErrorResponse { statusCode: number; code: CampaignErrorCode; message: string; }

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
  target: { id: string; displayName: string; trophies: number; armyPower: number; army: ArmyFormationSlotState[] };
  ownArmy: ArmyPreview;
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
  | 'MATCH_OFFER_ARMY_CHANGED'
  | 'INVALID_RAID_TEAM'
  | 'INVALID_ARMY_FORMATION'
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
