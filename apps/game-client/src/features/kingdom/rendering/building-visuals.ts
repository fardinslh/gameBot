import type { PointData } from 'pixi.js';
import type { BuildingAppearanceVariant } from '@crown-and-coin/shared';
import type { WorldBuildingId } from '../domain/kingdom-types';

export type BuildingVisualId = WorldBuildingId;
export type BuildingVisualStage = 1 | 2 | 3;

export interface PlacementEllipse {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ContactShadow extends PlacementEllipse {
  alpha: number;
}

export interface BuildingVisualDefinition {
  stages: Partial<Record<BuildingVisualStage, string>> & Pick<Record<BuildingVisualStage, string>, 1>;
  renderWidth: number;
  renderHeight?: number;
  /** Normalized source-image point registered directly on the painted map footprint. */
  groundAnchor: PointData;
  /** Small art-mass correction, intentionally separate from the map footprint target. */
  visualOffset: PointData;
  footprint: PlacementEllipse;
  shadow: ContactShadow;
  hitArea: PlacementEllipse;
  statusStackAnchor: PointData;
}

const buildingAsset = (name: string): string => `/assets/kingdom/buildings/${name}-stage-1.webp`;
// The Mine alpha bounds cover its complete 512x464 source canvas. The stable
// front rail/ground contact is centered at source pixel (280, 453); anchoring
// there prevents the last 11 rail-tip pixels from pulling the structure off its
// terrain registration while keeping scale changes pinned to the approach path.
const MINE_GROUND_ANCHOR = { x: 280 / 512, y: 453 / 464 } as const;

// All coordinates below are local to the registered ground-contact point (0, 0).
// The normalized anchors account for each generated asset's distinct canvas proportions.
export const BUILDING_VISUALS: Readonly<Record<BuildingVisualId, BuildingVisualDefinition>> = {
  castle: {
    stages: { 1: '/assets/kingdom/castle-production-v1.webp' }, renderWidth: 220, renderHeight: 230,
    groundAnchor: { x: .5, y: .904 }, visualOffset: { x: 0, y: 0 },
    footprint: { x: 0, y: 0, width: 196, height: 54 }, shadow: { x: 0, y: 3, width: 184, height: 30, alpha: .16 },
    hitArea: { x: 0, y: -30, width: 225, height: 205 }, statusStackAnchor: { x: 0, y: 38 },
  },
  farm: {
    stages: { 1: buildingAsset('farm') }, renderWidth: 180,
    groundAnchor: { x: .5, y: .832 }, visualOffset: { x: 0, y: 0 },
    footprint: { x: 0, y: 0, width: 145, height: 36 }, shadow: { x: 1, y: 2, width: 132, height: 20, alpha: .17 },
    hitArea: { x: 0, y: -37, width: 172, height: 118 }, statusStackAnchor: { x: 68, y: -88 },
  },
  lumberMill: {
    stages: { 1: buildingAsset('lumber-mill') }, renderWidth: 176,
    groundAnchor: { x: .5, y: .805 }, visualOffset: { x: 0, y: 0 },
    footprint: { x: 0, y: 0, width: 148, height: 34 }, shadow: { x: 0, y: 2, width: 136, height: 19, alpha: .17 },
    hitArea: { x: 0, y: -39, width: 170, height: 118 }, statusStackAnchor: { x: 66, y: -90 },
  },
  mine: {
    stages: { 1: buildingAsset('mine') }, renderWidth: 184,
    groundAnchor: MINE_GROUND_ANCHOR, visualOffset: { x: 0, y: 0 },
    footprint: { x: -8, y: -16, width: 152, height: 38 }, shadow: { x: -8, y: -14, width: 138, height: 22, alpha: .08 },
    hitArea: { x: -8, y: -78, width: 178, height: 166 }, statusStackAnchor: { x: 66, y: -104 },
  },
  grandMarket: {
    stages: { 1: buildingAsset('grand-market') }, renderWidth: 194,
    groundAnchor: { x: .5, y: .84 }, visualOffset: { x: 0, y: 0 },
    footprint: { x: 0, y: 0, width: 164, height: 42 }, shadow: { x: 0, y: 2, width: 126, height: 18, alpha: .1 },
    hitArea: { x: 0, y: -48, width: 190, height: 138 }, statusStackAnchor: { x: 74, y: -102 },
  },
  barracks: {
    stages: { 1: buildingAsset('barracks') }, renderWidth: 194,
    groundAnchor: { x: .5, y: .851 }, visualOffset: { x: 0, y: 0 },
    footprint: { x: 0, y: 0, width: 165, height: 42 }, shadow: { x: 0, y: 1, width: 150, height: 22, alpha: .15 },
    hitArea: { x: 0, y: -46, width: 190, height: 138 }, statusStackAnchor: { x: 76, y: -105 },
  },
  blacksmith: {
    stages: { 1: buildingAsset('blacksmith') }, renderWidth: 174,
    groundAnchor: { x: .5, y: .873 }, visualOffset: { x: -1, y: 0 },
    footprint: { x: -1, y: 0, width: 145, height: 36 }, shadow: { x: -2, y: 1, width: 130, height: 20, alpha: .17 },
    hitArea: { x: -1, y: -45, width: 170, height: 132 }, statusStackAnchor: { x: 63, y: -103 },
  },
  academy: {
    stages: { 1: buildingAsset('academy') }, renderWidth: 184,
    groundAnchor: { x: .5, y: .869 }, visualOffset: { x: 0, y: 0 },
    footprint: { x: 0, y: 0, width: 150, height: 38 }, shadow: { x: 0, y: 1, width: 134, height: 20, alpha: .14 },
    hitArea: { x: 0, y: -54, width: 178, height: 148 }, statusStackAnchor: { x: 67, y: -123 },
  },
  granary: {
    stages: { 1: buildingAsset('granary') }, renderWidth: 178,
    groundAnchor: { x: .5, y: .849 }, visualOffset: { x: 0, y: 0 },
    footprint: { x: 0, y: 0, width: 150, height: 38 }, shadow: { x: 0, y: 1, width: 138, height: 20, alpha: .14 },
    hitArea: { x: 0, y: -43, width: 174, height: 126 }, statusStackAnchor: { x: 67, y: -96 },
  },
  watchtower: {
    stages: { 1: buildingAsset('watchtower') }, renderWidth: 137,
    groundAnchor: { x: .5, y: .879 }, visualOffset: { x: 0, y: 0 },
    footprint: { x: 0, y: 0, width: 105, height: 28 }, shadow: { x: 0, y: 1, width: 82, height: 16, alpha: .16 },
    hitArea: { x: 0, y: -64, width: 132, height: 176 }, statusStackAnchor: { x: 47, y: -145 },
  },
  workshop: {
    stages: { 1: buildingAsset('workshop') }, renderWidth: 174,
    groundAnchor: { x: .5, y: .855 }, visualOffset: { x: 1, y: 0 },
    footprint: { x: 1, y: 0, width: 146, height: 38 }, shadow: { x: 1, y: 1, width: 136, height: 20, alpha: .15 },
    hitArea: { x: 1, y: -43, width: 170, height: 126 }, statusStackAnchor: { x: 67, y: -97 },
  },
  stable: {
    stages: { 1: buildingAsset('stable') }, renderWidth: 184,
    groundAnchor: { x: .5, y: .846 }, visualOffset: { x: 0, y: 0 },
    footprint: { x: 0, y: 0, width: 156, height: 42 }, shadow: { x: 0, y: 2, width: 144, height: 22, alpha: .13 },
    hitArea: { x: 0, y: -40, width: 180, height: 122 }, statusStackAnchor: { x: 72, y: -94 },
  },
  tavern: {
    stages: { 1: buildingAsset('tavern') }, renderWidth: 174,
    groundAnchor: { x: .5, y: .878 }, visualOffset: { x: 0, y: 0 },
    footprint: { x: 0, y: 0, width: 146, height: 36 }, shadow: { x: 0, y: 1, width: 130, height: 19, alpha: .13 },
    hitArea: { x: 0, y: -44, width: 170, height: 130 }, statusStackAnchor: { x: 66, y: -101 },
  },
};

export function resolveBuildingTexture(id: BuildingVisualId, stage: BuildingVisualStage = 1): string {
  const visuals = BUILDING_VISUALS[id];
  return visuals.stages[stage] ?? visuals.stages[1];
}

export function appearanceVariantStage(variant: BuildingAppearanceVariant): BuildingVisualStage {
  if (variant === 'FORTIFIED') return 3;
  if (variant === 'STONE') return 2;
  return 1;
}
