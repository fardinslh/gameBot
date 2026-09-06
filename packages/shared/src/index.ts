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

export const KINGDOM_RULER_TITLES = ['LORD', 'LADY', 'WARDEN'] as const;
export type KingdomRulerTitle = (typeof KINGDOM_RULER_TITLES)[number];
export const KINGDOM_HERALDRY_KEYS = ['GOLDEN_LION', 'VERDANT_STAG', 'CRIMSON_FALCON'] as const;
export type KingdomHeraldryKey = (typeof KINGDOM_HERALDRY_KEYS)[number];
export const KINGDOM_REALM_STATE_KEYS = [
  'FRONTIER_HOLD',
  'GUARDED_SETTLEMENT',
  'LEARNED_COURT',
  'MAKERS_WARD',
  'FORGED_KINGDOM',
  'WAR_COUNCIL',
  'FORTIFIED_REALM',
  'GRAND_COURT',
  'CROWNED_REALM',
  'LEGENDARY_KINGDOM',
] as const;
export type KingdomRealmStateKey = (typeof KINGDOM_REALM_STATE_KEYS)[number];

export interface KingdomIdentityState {
  name: string;
  rulerTitle: KingdomRulerTitle;
  heraldry: KingdomHeraldryKey;
}

export interface KingdomTransformationMilestone {
  realmState: KingdomRealmStateKey;
  requiredCastleLevel: number;
  unlockBuildingType: KingdomBuildingType | null;
}

export interface KingdomTransformationState {
  current: KingdomTransformationMilestone;
  next: KingdomTransformationMilestone | null;
  future: KingdomTransformationMilestone | null;
}

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
  transformation: KingdomTransformationState;
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

export type EngagementSection = 'KINGDOM' | 'ARMY' | 'RAID' | 'RETENTION';
export type EngagementGoalKind =
  | 'CLAIM_REWARD'
  | 'ROYAL_DECREE'
  | 'COLLECT_RESOURCES'
  | 'UPGRADE_BUILDING'
  | 'WIN_RAID'
  | 'TRAIN_TROOPS'
  | 'UPGRADE_IN_PROGRESS';
export interface EngagementGoalState {
  kind: EngagementGoalKind;
  section: EngagementSection;
  current: string;
  target: string;
  buildingType: KingdomBuildingType | null;
  readyAt: string | null;
}
export interface EngagementProgressCue {
  source: 'DAILY_MISSION' | 'ACHIEVEMENT';
  key: string;
  current: string;
  target: string;
  claimable: boolean;
}
export interface RoyalDecreeTaskState {
  key: 'CASTLE_LEVEL' | 'COLLECT_RESOURCES' | 'COMPLETE_RAIDS';
  current: string;
  target: string;
  completed: boolean;
}
export interface RoyalDecreeState {
  available: boolean;
  claimed: boolean;
  claimable: boolean;
  tasks: RoyalDecreeTaskState[];
  rewards: RetentionRewardItem[];
}
export interface EngagementReturnSummary {
  awaySeconds: number;
  resourcesReady: ResourceAmounts;
  completedUpgrades: Array<{ buildingType: KingdomBuildingType; fromLevel: number; toLevel: number }>;
  completedTraining: Array<{ troopType: TroopType; quantity: number }>;
  availableRewardCount: number;
  revengeCount: number;
}
export interface EngagementOverviewResponse {
  serverTime: string;
  kingdomIdentity: KingdomIdentityState;
  nextGoal: EngagementGoalState;
  progress: EngagementProgressCue[];
  royalDecree: RoyalDecreeState;
  affordableBuildingType: KingdomBuildingType | null;
}
export interface EngagementSessionResponse extends EngagementOverviewResponse {
  returnSummary: EngagementReturnSummary | null;
}
export interface RoyalDecreeClaimResponse {
  granted: RetentionRewardItem[];
  balances: ResourceAmounts;
  engagement: EngagementOverviewResponse;
}
export type EngagementErrorCode =
  | 'INVALID_IDEMPOTENCY_KEY'
  | 'ROYAL_DECREE_LOCKED'
  | 'ROYAL_DECREE_INCOMPLETE'
  | 'ROYAL_DECREE_ALREADY_CLAIMED'
  | 'ENGAGEMENT_CONFLICT';
export interface EngagementErrorResponse { statusCode: number; code: EngagementErrorCode; message: string; }
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
    trophies?: number;
    league?: TrophyLeague;
  };
  kingdom: {
    id: string;
    name: string;
    rulerTitle: KingdomRulerTitle;
    heraldry: KingdomHeraldryKey;
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

export interface UpdateKingdomIdentityRequest extends KingdomIdentityState {}
export interface UpdateKingdomIdentityResponse {
  identity: KingdomIdentityState;
  serverTime: string;
}
export type KingdomIdentityErrorCode = 'KINGDOM_IDENTITY_INVALID';

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
  player: { id: string; displayName: string; level: number; trophies: number; league?: TrophyLeague };
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
  leagueBonus?: ResourceAmounts;
  attackerLeague?: TrophyLeague;
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

export type TrophyLeague = 'BRONZE' | 'SILVER' | 'GOLD' | 'CRYSTAL' | 'MASTER' | 'CHAMPION';

export interface LeagueConfig {
  id: TrophyLeague;
  nameKey: string;
  minTrophies: number;
  maxTrophies: number | null;
  winBonus: ResourceAmounts;
  badgeColor: string;
  badgeAccent: string;
}

export const LEAGUE_CONFIGS: Readonly<Record<TrophyLeague, LeagueConfig>> = {
  BRONZE: {
    id: 'BRONZE',
    nameKey: 'leagues.bronze',
    minTrophies: 0,
    maxTrophies: 1199,
    winBonus: { GOLD: '2500', FOOD: '1500', WOOD: '1500', STONE: '1000', GEMS: '0' },
    badgeColor: '#cd7f32',
    badgeAccent: '#8c501e',
  },
  SILVER: {
    id: 'SILVER',
    nameKey: 'leagues.silver',
    minTrophies: 1200,
    maxTrophies: 1499,
    winBonus: { GOLD: '5000', FOOD: '3000', WOOD: '3000', STONE: '2000', GEMS: '2' },
    badgeColor: '#c0c8d0',
    badgeAccent: '#7e8a94',
  },
  GOLD: {
    id: 'GOLD',
    nameKey: 'leagues.gold',
    minTrophies: 1500,
    maxTrophies: 1799,
    winBonus: { GOLD: '10000', FOOD: '6000', WOOD: '6000', STONE: '4000', GEMS: '5' },
    badgeColor: '#e5b842',
    badgeAccent: '#a27618',
  },
  CRYSTAL: {
    id: 'CRYSTAL',
    nameKey: 'leagues.crystal',
    minTrophies: 1800,
    maxTrophies: 2199,
    winBonus: { GOLD: '18000', FOOD: '12000', WOOD: '12000', STONE: '8000', GEMS: '10' },
    badgeColor: '#a855f7',
    badgeAccent: '#6b21a8',
  },
  MASTER: {
    id: 'MASTER',
    nameKey: 'leagues.master',
    minTrophies: 2200,
    maxTrophies: 2599,
    winBonus: { GOLD: '30000', FOOD: '20000', WOOD: '20000', STONE: '15000', GEMS: '20' },
    badgeColor: '#ef4444',
    badgeAccent: '#991b1b',
  },
  CHAMPION: {
    id: 'CHAMPION',
    nameKey: 'leagues.champion',
    minTrophies: 2600,
    maxTrophies: null,
    winBonus: { GOLD: '50000', FOOD: '35000', WOOD: '35000', STONE: '25000', GEMS: '40' },
    badgeColor: '#f59e0b',
    badgeAccent: '#d97706',
  },
};

export const LEAGUE_TIER_ORDER: readonly TrophyLeague[] = [
  'BRONZE',
  'SILVER',
  'GOLD',
  'CRYSTAL',
  'MASTER',
  'CHAMPION',
];

export function resolveLeagueFromTrophies(trophies: number): TrophyLeague {
  if (trophies >= 2600) return 'CHAMPION';
  if (trophies >= 2200) return 'MASTER';
  if (trophies >= 1800) return 'CRYSTAL';
  if (trophies >= 1500) return 'GOLD';
  if (trophies >= 1200) return 'SILVER';
  return 'BRONZE';
}

export function getNextLeagueThreshold(currentLeague: TrophyLeague): number | null {
  const index = LEAGUE_TIER_ORDER.indexOf(currentLeague);
  if (index === -1 || index === LEAGUE_TIER_ORDER.length - 1) return null;
  const nextLeague = LEAGUE_TIER_ORDER[index + 1];
  return LEAGUE_CONFIGS[nextLeague].minTrophies;
}

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  displayName: string;
  castleLevel: number;
  trophies: number;
  league: TrophyLeague;
  profileCrest: ProfileCrestKey;
  isCurrentPlayer: boolean;
}

export interface LeaderboardSeasonInfo {
  seasonId: string;
  name: string;
  endsAt: string;
  daysRemaining: number;
}

export interface LeaderboardResponse {
  topPlayers: LeaderboardEntry[];
  currentPlayer: LeaderboardEntry | null;
  season: LeaderboardSeasonInfo;
  serverTime: string;
}

// ==========================================
// Guilds & Alliances Domain Types
// ==========================================

export const GUILD_JOIN_POLICIES = ['OPEN', 'INVITE_ONLY', 'CLOSED'] as const;
export type GuildJoinPolicy = (typeof GUILD_JOIN_POLICIES)[number];

export const GUILD_ROLES = ['LEADER', 'OFFICER', 'MEMBER'] as const;
export type GuildRole = (typeof GUILD_ROLES)[number];

export const GUILD_CREST_EMBLEMS = [
  'shield',
  'crown',
  'swords',
  'lion',
  'eagle',
  'dragon',
  'tower',
  'flame',
] as const;
export type GuildCrestEmblem = (typeof GUILD_CREST_EMBLEMS)[number];

export interface GuildCrest {
  emblem: GuildCrestEmblem;
  primaryColor: string;
  secondaryColor: string;
}

export interface GuildSummary {
  id: string;
  name: string;
  tag: string;
  description: string;
  crest: GuildCrest;
  joinPolicy: GuildJoinPolicy;
  minTrophies: number;
  memberCount: number;
  maxMembers: number;
  score: number;
  leaderName: string;
  level?: number;
  xp?: number;
  nextLevelXp?: number;
  treasuryGold?: string;
}

export interface GuildMemberInfo {
  playerId: string;
  displayName: string;
  role: GuildRole;
  castleLevel: number;
  trophies: number;
  league: TrophyLeague;
  profileCrest: ProfileCrestKey;
  donationsGiven: number;
  donationsReceived: number;
  joinedAt: string;
}

export const GUILD_TROOP_REQUEST_STATUSES = ['OPEN', 'FULFILLED', 'EXPIRED'] as const;
export type GuildTroopRequestStatus = (typeof GUILD_TROOP_REQUEST_STATUSES)[number];

export interface GuildTroopRequestDonor {
  playerId: string;
  displayName: string;
  amount: number;
}

export interface GuildTroopRequestItem {
  id: string;
  requesterId: string;
  requesterName: string;
  troopType: TroopType;
  currentDonations: number;
  maxDonations: number;
  status: GuildTroopRequestStatus;
  createdAt: string;
  expiresAt: string;
  donors: GuildTroopRequestDonor[];
}

export interface GuildDetailsResponse {
  guild: GuildSummary;
  members: GuildMemberInfo[];
  requests: GuildTroopRequestItem[];
  currentUserRole: GuildRole | null;
  canRequestTroops: boolean;
  nextRequestAvailableAt: string | null;
}

export interface GuildLeaderboardEntry {
  rank: number;
  guildId: string;
  name: string;
  tag: string;
  crest: GuildCrest;
  memberCount: number;
  maxMembers: number;
  minTrophies: number;
  score: number;
  isPlayerGuild: boolean;
}

export interface GuildLeaderboardResponse {
  topGuilds: GuildLeaderboardEntry[];
  playerGuild: GuildLeaderboardEntry | null;
  serverTime: string;
}

export interface GuildOverviewResponse {
  inGuild: boolean;
  guild: GuildDetailsResponse | null;
  suggestedGuilds: GuildSummary[];
  creationCostGold: string;
}

export interface CreateGuildRequest {
  name: string;
  description?: string;
  emblem: GuildCrestEmblem;
  primaryColor: string;
  secondaryColor: string;
  joinPolicy: GuildJoinPolicy;
  minTrophies: number;
}

export interface RequestTroopsPayload {
  troopType: TroopType;
}

export interface DonateTroopsPayload {
  requestId: string;
  amount?: number;
}

export interface DonateTroopsResult {
  requestId: string;
  status: GuildTroopRequestStatus;
  currentDonations: number;
  maxDonations: number;
  donatedTroopType: TroopType;
  donatedAmount: number;
  xpAwarded: number;
  goldAwarded: string;
}

export const GUILD_CREATE_COST_GOLD = '2500';
export const GUILD_MAX_MEMBERS = 50;
export const GUILD_REQUEST_MAX_TROOPS = 10;
export const GUILD_REQUEST_COOLDOWN_HOURS = 4;

// --- GUILD WARS SYSTEM CONTRACTS ---

export const GUILD_WAR_STATES = ['NOT_IN_WAR', 'PREPARATION', 'BATTLE_DAY', 'WAR_ENDED'] as const;
export type GuildWarState = (typeof GUILD_WAR_STATES)[number];

export const GUILD_WAR_OUTCOMES = ['PENDING', 'VICTORY', 'DEFEAT', 'DRAW'] as const;
export type GuildWarOutcome = (typeof GUILD_WAR_OUTCOMES)[number];

export interface GuildWarParticipant {
  playerId: string;
  displayName: string;
  castleLevel: number;
  league: TrophyLeague;
  baseNumber: number;
  attacksUsed: number;
  maxAttacks: number;
  bestStarsConceded: number; // 0..3
  bestDestructionConceded: number; // 0..100
  defenseReinforcementsCount: number;
}

export interface GuildWarAttackEntry {
  id: string;
  attackerId: string;
  attackerName: string;
  defenderId: string;
  defenderName: string;
  attackerGuildId: string;
  defenderGuildId: string;
  stars: number;
  destructionPct: number;
  timeMs: number;
  createdAt: string;
  spoilsGold: string;
}

export interface GuildWarSideSummary {
  guildId: string;
  name: string;
  tag: string;
  crest: GuildCrest;
  stars: number;
  totalStarsPossible: number;
  destructionPct: number;
  attacksUsed: number;
  totalAttacks: number;
}

export interface GuildWarDetails {
  warId: string;
  state: GuildWarState;
  warSize: number;
  prepEndsAt: string;
  battleEndsAt: string;
  outcome: GuildWarOutcome;
  friendly: GuildWarSideSummary;
  opposing: GuildWarSideSummary;
  friendlyParticipants: GuildWarParticipant[];
  opposingParticipants: GuildWarParticipant[];
  recentAttacks: GuildWarAttackEntry[];
  canDeclareWar: boolean;
  currentUserAttacksLeft: number;
  warSpoilsAvailableGold: string;
}

export interface GuildWarRecord {
  wins: number;
  losses: number;
  draws: number;
  currentStreak: number;
  guildLevel: number;
  guildXp: number;
  nextLevelXp: number;
}

export interface GuildWarOverviewResponse {
  activeWar: GuildWarDetails | null;
  warRecord: GuildWarRecord;
  canDeclareWar: boolean;
}

export interface StartWarPayload {
  warSize?: number;
}

export interface WarAttackPayload {
  defenderPlayerId: string;
}

export interface WarAttackResult {
  attackId: string;
  stars: number;
  destructionPct: number;
  isNewBest: boolean;
  additionalStarsAwarded: number;
  spoilsGoldAwarded: string;
  friendlyTotalStars: number;
  opposingTotalStars: number;
  attacksRemaining: number;
  warFinished: boolean;
  outcome: GuildWarOutcome;
}

export const GUILD_WAR_ATTACKS_PER_PLAYER = 2;
export const GUILD_WAR_DEFAULT_SIZE = 5;
export const GUILD_WAR_WIN_SPOILS_GOLD = '50000';
export const GUILD_WAR_LOSE_SPOILS_GOLD = '15000';

// ==========================================
// Ranked Seasons & Tournaments Domain Types
// ==========================================

export const SEASON_STATUSES = ['ACTIVE', 'FINALIZING', 'ENDED'] as const;
export type SeasonStatus = (typeof SEASON_STATUSES)[number];

export interface SeasonRewardTier {
  league: TrophyLeague;
  gems: number;
  gold: string;
  title?: string;
}

export const SEASON_REWARD_TIERS: Record<TrophyLeague, SeasonRewardTier> = {
  BRONZE: { league: 'BRONZE', gems: 50, gold: '25000' },
  SILVER: { league: 'SILVER', gems: 100, gold: '60000' },
  GOLD: { league: 'GOLD', gems: 250, gold: '150000' },
  CRYSTAL: { league: 'CRYSTAL', gems: 500, gold: '350000' },
  MASTER: { league: 'MASTER', gems: 1000, gold: '750000' },
  CHAMPION: { league: 'CHAMPION', gems: 2500, gold: '1500000', title: 'Crown Champion' },
};

export interface SeasonSummary {
  id: string;
  seasonNumber: number;
  name: string;
  status: SeasonStatus;
  startsAt: string;
  endsAt: string;
  timeRemainingSeconds: number;
}

export interface PreviousSeasonStanding {
  seasonNumber: number;
  seasonName: string;
  endingTrophies: number;
  endingLeague: TrophyLeague;
  rewardsClaimed: boolean;
  reward: SeasonRewardTier;
}

export interface SeasonPlayerStanding {
  currentTrophies: number;
  currentLeague: TrophyLeague;
  peakTrophies: number;
  projectedReward: SeasonRewardTier;
  previousSeason: PreviousSeasonStanding | null;
}

export interface SeasonOverviewResponse {
  currentSeason: SeasonSummary;
  playerStanding: SeasonPlayerStanding;
  rewardTiers: SeasonRewardTier[];
  topGuilds: Array<{
    rank: number;
    id: string;
    name: string;
    tag: string;
    emblem: string;
    score: number;
  }>;
}

export interface ClaimSeasonRewardResponse {
  seasonNumber: number;
  gemsAwarded: number;
  goldAwarded: string;
  endingLeague: TrophyLeague;
  titleAwarded?: string;
  claimedAt: string;
}

// ==========================================
// Guild Perks & Treasury Domain Types
// ==========================================

export const GUILD_PERK_TYPES = [
  'GOLD_BOOST',
  'DONATION_CAPACITY',
  'WAR_LOOT_BONUS',
  'TROOP_TRAINING_SPEED',
] as const;
export type GuildPerkType = (typeof GUILD_PERK_TYPES)[number];

export interface GuildPerkLevelInfo {
  level: number;
  requiredGuildLevel: number;
  costTreasuryGold: string;
  bonusValue: number;
  description: string;
}

export interface GuildPerkDefinition {
  type: GuildPerkType;
  name: string;
  maxLevel: number;
  levels: GuildPerkLevelInfo[];
}

export interface GuildPerkStatus {
  type: GuildPerkType;
  name: string;
  currentLevel: number; // 0 if locked
  maxLevel: number;
  currentBonusValue: number;
  currentBonusDescription: string;
  nextLevel: GuildPerkLevelInfo | null;
  canUpgrade: boolean;
  lockReason?: 'INSUFFICIENT_LEVEL' | 'INSUFFICIENT_TREASURY' | 'MAX_LEVEL' | 'OFFICER_OR_LEADER_REQUIRED';
}

export interface GuildTreasuryDonationItem {
  id: string;
  donorId: string;
  donorName: string;
  amount: string;
  createdAt: string;
}

export interface GuildTreasuryOverviewResponse {
  guildId: string;
  guildName: string;
  guildLevel: number;
  guildXp: number;
  nextLevelXp: number;
  xpProgressPct: number;
  treasuryGold: string;
  treasuryCapacity: string;
  canDonate: boolean;
  canUpgradePerks: boolean; // LEADER or OFFICER
  currentUserRole: GuildRole | null;
  perks: GuildPerkStatus[];
  recentDonations: GuildTreasuryDonationItem[];
  playerContributionTotal: string;
}

export interface DonateToTreasuryPayload {
  amount: string; // gold amount
}

export interface DonateToTreasuryResponse {
  treasuryGold: string;
  guildXp: number;
  guildLevel: number;
  playerBalances: ResourceAmounts;
  donatedAmount: string;
  xpAwarded: number;
}

export interface UpgradeGuildPerkPayload {
  perkType: GuildPerkType;
}

export interface UpgradeGuildPerkResponse {
  perk: GuildPerkStatus;
  treasuryGold: string;
  guildLevel: number;
}

// ==========================================
// Alliance Chat & War Room Strategy Types
// ==========================================

export const GUILD_CHAT_MESSAGE_TYPES = ['TEXT', 'SYSTEM', 'ANNOUNCEMENT'] as const;
export type GuildChatMessageType = (typeof GUILD_CHAT_MESSAGE_TYPES)[number];

export interface GuildChatMessageItem {
  id: string;
  guildId: string;
  senderId: string | null;
  senderName: string;
  senderRole: GuildRole | null;
  senderProfileCrest: ProfileCrestKey;
  type: GuildChatMessageType;
  content: string;
  isPinned: boolean;
  createdAt: string;
}

export interface GuildChatFeedResponse {
  messages: GuildChatMessageItem[];
  pinnedAnnouncement: GuildChatMessageItem | null;
  canPostAnnouncement: boolean;
}

export interface SendGuildChatMessagePayload {
  content: string;
  isAnnouncement?: boolean;
  isPinned?: boolean;
}

export const WAR_TACTICAL_MARKERS = [
  'TARGET_CALLOUT',
  'ATTACK_PRIORITY',
  'SCOUT_FIRST',
  'CLEARED',
] as const;
export type WarTacticalMarker = (typeof WAR_TACTICAL_MARKERS)[number];

export interface GuildWarCalloutItem {
  id: string;
  warId: string;
  defenderPlayerId: string;
  baseNumber: number;
  marker: WarTacticalMarker;
  claimedById: string | null;
  claimedByName: string | null;
  notes: string | null;
  assignedById: string;
  assignedByName: string;
  updatedAt: string;
}

export interface SetWarCalloutPayload {
  defenderPlayerId: string;
  baseNumber: number;
  marker: WarTacticalMarker;
  claimedById?: string | null;
  notes?: string | null;
}

export interface WarRoomStrategyResponse {
  warId: string;
  callouts: GuildWarCalloutItem[];
  pinnedStrategyNotice: string | null;
  canManageStrategy: boolean;
}





