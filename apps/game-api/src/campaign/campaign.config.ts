import type { CampaignChapterKey, CampaignStageKey, HeroKey, ResourceType, TroopType } from '@crown-and-coin/shared';

export interface CampaignRewardDefinition { resource: ResourceType; amount: bigint; }
export interface CampaignSquadDefinition {
  troopType: TroopType;
  unitCount: number;
  commanderKey: HeroKey;
  commanderLevel: number;
}
export interface CampaignStageDefinition {
  key: CampaignStageKey;
  index: number;
  title: { en: string; fa: string };
  enemyName: { en: string; fa: string };
  externalId: string;
  castleLevel: number;
  requiredCastleLevel: number;
  isBoss: boolean;
  formation: readonly [CampaignSquadDefinition, CampaignSquadDefinition, CampaignSquadDefinition];
  firstClearRewards: readonly CampaignRewardDefinition[];
}

const rewards = (...entries: readonly [ResourceType, bigint][]): readonly CampaignRewardDefinition[] =>
  entries.map(([resource, amount]) => ({ resource, amount }));
const squad = (troopType: TroopType, unitCount: number, commanderKey: HeroKey, commanderLevel: number): CampaignSquadDefinition =>
  ({ troopType, unitCount, commanderKey, commanderLevel });

export const CAMPAIGN_CHAPTER_KEY: CampaignChapterKey = 'BROKEN_FRONTIER';
export const CAMPAIGN_CHAPTER_TITLE = { en: 'The Broken Frontier', fa: 'مرز شکسته' } as const;

export const CAMPAIGN_STAGES: readonly CampaignStageDefinition[] = [
  { key: 'FRONTIER_01', index: 1, title: { en: 'Abandoned Watch', fa: 'دیده‌بان متروک' }, enemyName: { en: 'Frontier Scavengers', fa: 'غارتگران مرزی' }, externalId: 'campaign:broken_frontier:01', castleLevel: 1, requiredCastleLevel: 1, isBoss: false, formation: [squad('INFANTRY', 12, 'KNIGHT', 1), squad('INFANTRY', 8, 'MAGE', 1), squad('ARCHER', 5, 'RANGER', 1)], firstClearRewards: rewards(['GOLD', 800n], ['FOOD', 400n]) },
  { key: 'FRONTIER_02', index: 2, title: { en: 'Ashen Bow', fa: 'کمان خاکستر' }, enemyName: { en: 'Ashen Bowmen', fa: 'کمانداران خاکستر' }, externalId: 'campaign:broken_frontier:02', castleLevel: 1, requiredCastleLevel: 1, isBoss: false, formation: [squad('ARCHER', 10, 'RANGER', 1), squad('ARCHER', 12, 'MAGE', 1), squad('INFANTRY', 6, 'KNIGHT', 1)], firstClearRewards: rewards(['FOOD', 600n], ['WOOD', 500n]) },
  { key: 'FRONTIER_03', index: 3, title: { en: 'Riders at the Ford', fa: 'سواران گذرگاه' }, enemyName: { en: 'Ford Riders', fa: 'سواران گذرگاه' }, externalId: 'campaign:broken_frontier:03', castleLevel: 1, requiredCastleLevel: 1, isBoss: false, formation: [squad('CAVALRY', 14, 'MAGE', 1), squad('CAVALRY', 9, 'KNIGHT', 1), squad('ARCHER', 8, 'RANGER', 1)], firstClearRewards: rewards(['GOLD', 900n], ['STONE', 600n]) },
  { key: 'FRONTIER_04', index: 4, title: { en: 'Broken Palisade', fa: 'باروی شکسته' }, enemyName: { en: 'Palisade Guard', fa: 'نگهبانان بارو' }, externalId: 'campaign:broken_frontier:04', castleLevel: 2, requiredCastleLevel: 2, isBoss: false, formation: [squad('INFANTRY', 18, 'KNIGHT', 2), squad('ARCHER', 14, 'RANGER', 2), squad('CAVALRY', 8, 'MAGE', 2)], firstClearRewards: rewards(['GOLD', 1200n], ['FOOD', 800n]) },
  { key: 'FRONTIER_05', index: 5, title: { en: 'Wolf Road', fa: 'جاده گرگ' }, enemyName: { en: 'Wolf Road Company', fa: 'گروه جاده گرگ' }, externalId: 'campaign:broken_frontier:05', castleLevel: 2, requiredCastleLevel: 2, isBoss: false, formation: [squad('CAVALRY', 12, 'KNIGHT', 2), squad('INFANTRY', 18, 'MAGE', 2), squad('ARCHER', 12, 'RANGER', 2)], firstClearRewards: rewards(['WOOD', 900n], ['STONE', 700n]) },
  { key: 'FRONTIER_06', index: 6, title: { en: 'Archer’s Rise', fa: 'بلندی کمانداران' }, enemyName: { en: 'Rise Wardens', fa: 'نگهبانان بلندی' }, externalId: 'campaign:broken_frontier:06', castleLevel: 2, requiredCastleLevel: 2, isBoss: false, formation: [squad('ARCHER', 20, 'MAGE', 3), squad('CAVALRY', 12, 'RANGER', 3), squad('INFANTRY', 15, 'KNIGHT', 3)], firstClearRewards: rewards(['GOLD', 1600n], ['FOOD', 1000n]) },
  { key: 'FRONTIER_07', index: 7, title: { en: 'Iron Crossing', fa: 'گذرگاه آهنین' }, enemyName: { en: 'Iron Crossing Guard', fa: 'پاسداران گذرگاه آهنین' }, externalId: 'campaign:broken_frontier:07', castleLevel: 3, requiredCastleLevel: 3, isBoss: false, formation: [squad('INFANTRY', 24, 'RANGER', 4), squad('ARCHER', 16, 'KNIGHT', 4), squad('CAVALRY', 18, 'MAGE', 4)], firstClearRewards: rewards(['GOLD', 1900n], ['WOOD', 1200n]) },
  { key: 'FRONTIER_08', index: 8, title: { en: 'Last Redoubt', fa: 'آخرین سنگر' }, enemyName: { en: 'Redoubt Legion', fa: 'لژیون سنگر' }, externalId: 'campaign:broken_frontier:08', castleLevel: 3, requiredCastleLevel: 3, isBoss: false, formation: [squad('CAVALRY', 18, 'RANGER', 4), squad('ARCHER', 24, 'MAGE', 4), squad('INFANTRY', 20, 'KNIGHT', 4)], firstClearRewards: rewards(['FOOD', 1500n], ['STONE', 1200n]) },
  { key: 'FRONTIER_09', index: 9, title: { en: 'Warlord of the Frontier', fa: 'سالار مرز' }, enemyName: { en: 'The Broken Warlord', fa: 'سالار شکسته' }, externalId: 'campaign:broken_frontier:09', castleLevel: 3, requiredCastleLevel: 3, isBoss: true, formation: [squad('INFANTRY', 28, 'MAGE', 5), squad('ARCHER', 24, 'KNIGHT', 5), squad('CAVALRY', 22, 'RANGER', 5)], firstClearRewards: rewards(['GOLD', 3500n], ['FOOD', 2000n], ['WOOD', 1500n], ['STONE', 1500n]) },
] as const;

export const CAMPAIGN_STAR_REWARDS = [
  { stars: 9 as const, rewards: rewards(['GOLD', 1500n], ['FOOD', 750n]) },
  { stars: 18 as const, rewards: rewards(['GOLD', 2500n], ['FOOD', 1200n], ['WOOD', 1000n]) },
  { stars: 27 as const, rewards: rewards(['GOLD', 5000n], ['FOOD', 2000n], ['WOOD', 1500n], ['STONE', 1500n]) },
] as const;

export const CAMPAIGN_STAGE_BY_KEY = new Map(CAMPAIGN_STAGES.map((stage) => [stage.key, stage]));
export const CAMPAIGN_EXTERNAL_IDS = CAMPAIGN_STAGES.map((stage) => stage.externalId);
