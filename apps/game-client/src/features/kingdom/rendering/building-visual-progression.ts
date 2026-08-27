import type { BuildingId } from '../domain/kingdom-types';

export const CORE_EVOLUTION_BUILDINGS = ['castle', 'farm', 'lumberMill', 'mine', 'grandMarket'] as const;

export type CoreEvolutionBuildingId = (typeof CORE_EVOLUTION_BUILDINGS)[number];
export type BuildingVisualTier = 'EARLY' | 'DEVELOPED' | 'ADVANCED' | 'FORTIFIED' | 'PRESTIGE';
export type BuildingVisualTierNumber = 1 | 2 | 3 | 4 | 5;
export type BuildingVisualMinorStep = 0 | 1 | 2 | 3;

export interface BuildingVisualState {
  asset: string;
  buildingId: CoreEvolutionBuildingId;
  capstone: boolean;
  detailIds: readonly string[];
  level: number;
  minorStep: BuildingVisualMinorStep;
  renderWidth: number;
  tier: BuildingVisualTier;
  tierNumber: BuildingVisualTierNumber;
}

const TIER_NAMES: readonly BuildingVisualTier[] = ['EARLY', 'DEVELOPED', 'ADVANCED', 'FORTIFIED', 'PRESTIGE'];
const ASSET_FOLDERS: Readonly<Record<CoreEvolutionBuildingId, string>> = {
  castle: 'castle',
  farm: 'farm',
  lumberMill: 'lumber-mill',
  mine: 'mine',
  grandMarket: 'grand-market',
};
const RENDER_WIDTHS: Readonly<Record<CoreEvolutionBuildingId, readonly [number, number, number, number, number]>> = {
  castle: [158, 186, 202, 214, 224],
  farm: [154, 170, 182, 190, 198],
  lumberMill: [150, 168, 180, 190, 198],
  mine: [158, 178, 190, 198, 206],
  grandMarket: [156, 176, 194, 204, 212],
};

export function isCoreEvolutionBuilding(id: BuildingId): id is CoreEvolutionBuildingId {
  return (CORE_EVOLUTION_BUILDINGS as readonly BuildingId[]).includes(id);
}

export function getBuildingVisualState(buildingId: CoreEvolutionBuildingId, rawLevel: number): BuildingVisualState {
  const level = clampBuildingLevel(rawLevel);
  const tierNumber = (Math.floor((level - 1) / 4) + 1) as BuildingVisualTierNumber;
  const minorStep = ((level - 1) % 4) as BuildingVisualMinorStep;
  const detailIds = Array.from({ length: minorStep }, (_, index) => `${buildingId}-tier-${tierNumber}-detail-${index + 1}`);
  if (level === 20) detailIds.push(`${buildingId}-prestige-capstone`);
  return {
    asset: `/assets/kingdom/evolution/${ASSET_FOLDERS[buildingId]}/tier-${tierNumber}.webp`,
    buildingId,
    capstone: level === 20,
    detailIds,
    level,
    minorStep,
    renderWidth: RENDER_WIDTHS[buildingId][tierNumber - 1],
    tier: TIER_NAMES[tierNumber - 1],
    tierNumber,
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
