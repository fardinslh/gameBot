import type { BuildingId } from '../domain/kingdom-types';
import {
  DEFAULT_KINGDOM_THEME,
  KINGDOM_THEMES,
  type KingdomThemeId,
} from '../domain/kingdom-theme';

export const EVOLUTION_BUILDINGS = [
  'castle',
  'farm',
  'lumberMill',
  'mine',
  'grandMarket',
  'academy',
  'blacksmith',
  'watchtower',
  'workshop',
] as const;

export type EvolutionBuildingId = (typeof EVOLUTION_BUILDINGS)[number];
export type BuildingVisualTier = 'EARLY' | 'DEVELOPED' | 'ADVANCED' | 'FORTIFIED' | 'PRESTIGE';
export type BuildingVisualTierNumber = 1 | 2 | 3 | 4 | 5;
export type BuildingVisualMinorStep = 0 | 1 | 2 | 3;

export interface BuildingVisualState {
  asset: string;
  buildingId: EvolutionBuildingId;
  capstone: boolean;
  detailIds: readonly string[];
  level: number;
  minorStep: BuildingVisualMinorStep;
  renderWidth: number;
  tier: BuildingVisualTier;
  tierNumber: BuildingVisualTierNumber;
  theme: KingdomThemeId;
}

export interface BuildingVisualRequest {
  buildingId: EvolutionBuildingId;
  level: number;
  theme?: KingdomThemeId;
}

type TierAssets = readonly [string, string, string, string, string];
interface BuildingThemeVisuals {
  assets: TierAssets;
  renderWidths: readonly [number, number, number, number, number];
}

const TIER_NAMES: readonly BuildingVisualTier[] = ['EARLY', 'DEVELOPED', 'ADVANCED', 'FORTIFIED', 'PRESTIGE'];
const createTierAssets = (theme: KingdomThemeId, folder: string): TierAssets => {
  const namespace = KINGDOM_THEMES[theme].assetNamespace;
  const base = `/assets/kingdom/evolution/${namespace}/${folder}`;
  return [
    `${base}/tier-1.webp`,
    `${base}/tier-2.webp`,
    `${base}/tier-3.webp`,
    `${base}/tier-4.webp`,
    `${base}/tier-5.webp`,
  ];
};

export const BUILDING_VISUAL_CATALOG: Readonly<
  Record<KingdomThemeId, Readonly<Record<EvolutionBuildingId, BuildingThemeVisuals>>>
> = {
  DEFAULT: {
    castle: { assets: createTierAssets('DEFAULT', 'castle'), renderWidths: [158, 186, 202, 214, 224] },
    farm: { assets: createTierAssets('DEFAULT', 'farm'), renderWidths: [154, 170, 182, 190, 198] },
    lumberMill: { assets: createTierAssets('DEFAULT', 'lumber-mill'), renderWidths: [150, 168, 180, 190, 198] },
    mine: { assets: createTierAssets('DEFAULT', 'mine'), renderWidths: [158, 178, 190, 198, 206] },
    grandMarket: { assets: createTierAssets('DEFAULT', 'grand-market'), renderWidths: [156, 176, 194, 204, 212] },
    academy: { assets: createTierAssets('DEFAULT', 'academy'), renderWidths: [184, 190, 196, 202, 208] },
    blacksmith: { assets: createTierAssets('DEFAULT', 'blacksmith'), renderWidths: [174, 181, 188, 195, 202] },
    watchtower: { assets: createTierAssets('DEFAULT', 'watchtower'), renderWidths: [137, 143, 149, 155, 161] },
    workshop: { assets: createTierAssets('DEFAULT', 'workshop'), renderWidths: [174, 181, 188, 195, 202] },
  },
};

export function isEvolutionBuilding(id: BuildingId): id is EvolutionBuildingId {
  return (EVOLUTION_BUILDINGS as readonly BuildingId[]).includes(id);
}

export function getBuildingVisualState({
  buildingId,
  level: rawLevel,
  theme = DEFAULT_KINGDOM_THEME,
}: BuildingVisualRequest): BuildingVisualState {
  const level = clampBuildingLevel(rawLevel);
  const tierNumber = (Math.floor((level - 1) / 4) + 1) as BuildingVisualTierNumber;
  const minorStep = ((level - 1) % 4) as BuildingVisualMinorStep;
  const visuals = BUILDING_VISUAL_CATALOG[theme][buildingId];
  const detailIds = Array.from({ length: minorStep }, (_, index) => `${buildingId}-tier-${tierNumber}-detail-${index + 1}`);
  if (level === 20) detailIds.push(`${buildingId}-prestige-capstone`);
  return {
    asset: visuals.assets[tierNumber - 1],
    buildingId,
    capstone: level === 20,
    detailIds,
    level,
    minorStep,
    renderWidth: visuals.renderWidths[tierNumber - 1],
    tier: TIER_NAMES[tierNumber - 1],
    tierNumber,
    theme,
  };
}

export function clampBuildingLevel(level: number): number {
  if (!Number.isFinite(level)) return 1;
  return Math.max(1, Math.min(20, Math.floor(level)));
}

export function isMajorTierBoundary(previousLevel: number, nextLevel: number): boolean {
  const previous = clampBuildingLevel(previousLevel);
  const next = clampBuildingLevel(nextLevel);
  return next > previous && getTierNumber(previous) !== getTierNumber(next);
}

export function getUpgradeTransition(previousLevel: number, nextLevel: number, reducedMotion = false) {
  const major = isMajorTierBoundary(previousLevel, nextLevel);
  return {
    durationMs: reducedMotion ? 0 : major ? 980 : 620,
    major,
  } as const;
}

function getTierNumber(level: number): BuildingVisualTierNumber {
  return (Math.floor((clampBuildingLevel(level) - 1) / 4) + 1) as BuildingVisualTierNumber;
}
