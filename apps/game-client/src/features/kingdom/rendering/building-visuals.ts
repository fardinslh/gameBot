import type { PointData } from 'pixi.js';
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
  indicatorAnchor: PointData;
  lockAnchor: PointData;
}

const buildingAsset = (name: string): string => `/assets/kingdom/buildings/${name}-stage-1.webp`;

// All coordinates below are local to the registered ground-contact point (0, 0).
// The normalized anchors account for each generated asset's distinct canvas proportions.
export const BUILDING_VISUALS: Readonly<Record<BuildingVisualId, BuildingVisualDefinition>> = {
  castle: {
    stages: { 1: '/assets/kingdom/castle-production-v1.webp' }, renderWidth: 220, renderHeight: 230,
    groundAnchor: { x: .5, y: .904 }, visualOffset: { x: 0, y: 0 },
    footprint: { x: 0, y: 0, width: 196, height: 54 }, shadow: { x: 0, y: 3, width: 184, height: 30, alpha: .16 },
    hitArea: { x: 0, y: -30, width: 225, height: 205 }, indicatorAnchor: { x: 76, y: -148 }, lockAnchor: { x: 0, y: 0 },
  },
  farm: {
    stages: { 1: buildingAsset('farm') }, renderWidth: 180,
    groundAnchor: { x: .5, y: .832 }, visualOffset: { x: 0, y: 0 },
    footprint: { x: 0, y: 0, width: 145, height: 36 }, shadow: { x: 1, y: 2, width: 132, height: 20, alpha: .17 },
    hitArea: { x: 0, y: -37, width: 172, height: 118 }, indicatorAnchor: { x: 70, y: -100 }, lockAnchor: { x: 68, y: -88 },
  },
  lumberMill: {
    stages: { 1: buildingAsset('lumber-mill') }, renderWidth: 176,
    groundAnchor: { x: .5, y: .805 }, visualOffset: { x: 0, y: 0 },
    footprint: { x: 0, y: 0, width: 148, height: 34 }, shadow: { x: 0, y: 2, width: 136, height: 19, alpha: .17 },
    hitArea: { x: 0, y: -39, width: 170, height: 118 }, indicatorAnchor: { x: 66, y: -103 }, lockAnchor: { x: 66, y: -90 },
  },
  mine: {
    stages: { 1: buildingAsset('mine') }, renderWidth: 184,
    groundAnchor: { x: .5, y: .862 }, visualOffset: { x: -2, y: 0 },
    footprint: { x: -2, y: 0, width: 150, height: 38 }, shadow: { x: -4, y: 1, width: 138, height: 23, alpha: .2 },
    hitArea: { x: -2, y: -42, width: 176, height: 126 }, indicatorAnchor: { x: 64, y: -109 }, lockAnchor: { x: 66, y: -94 },
  },
  grandMarket: {
    stages: { 1: buildingAsset('grand-market') }, renderWidth: 194,
    groundAnchor: { x: .5, y: .84 }, visualOffset: { x: 0, y: 0 },
    footprint: { x: 0, y: 0, width: 164, height: 42 }, shadow: { x: 0, y: 2, width: 126, height: 18, alpha: .1 },
    hitArea: { x: 0, y: -48, width: 190, height: 138 }, indicatorAnchor: { x: 74, y: -116 }, lockAnchor: { x: 74, y: -102 },
  },
  barracks: {
    stages: { 1: buildingAsset('barracks') }, renderWidth: 194,
    groundAnchor: { x: .5, y: .851 }, visualOffset: { x: 0, y: 0 },
    footprint: { x: 0, y: 0, width: 165, height: 42 }, shadow: { x: 0, y: 1, width: 150, height: 22, alpha: .15 },
    hitArea: { x: 0, y: -46, width: 190, height: 138 }, indicatorAnchor: { x: 74, y: -117 }, lockAnchor: { x: 76, y: -105 },
  },
  blacksmith: {
    stages: { 1: buildingAsset('blacksmith') }, renderWidth: 174,
    groundAnchor: { x: .5, y: .873 }, visualOffset: { x: -1, y: 0 },
    footprint: { x: -1, y: 0, width: 145, height: 36 }, shadow: { x: -2, y: 1, width: 130, height: 20, alpha: .17 },
    hitArea: { x: -1, y: -45, width: 170, height: 132 }, indicatorAnchor: { x: 61, y: -116 }, lockAnchor: { x: 63, y: -103 },
  },
  academy: {
    stages: { 1: buildingAsset('academy') }, renderWidth: 184,
    groundAnchor: { x: .5, y: .869 }, visualOffset: { x: 0, y: 0 },
    footprint: { x: 0, y: 0, width: 150, height: 38 }, shadow: { x: 0, y: 1, width: 134, height: 20, alpha: .14 },
    hitArea: { x: 0, y: -54, width: 178, height: 148 }, indicatorAnchor: { x: 64, y: -137 }, lockAnchor: { x: 67, y: -123 },
  },
  granary: {
    stages: { 1: buildingAsset('granary') }, renderWidth: 178,
    groundAnchor: { x: .5, y: .849 }, visualOffset: { x: 0, y: 0 },
    footprint: { x: 0, y: 0, width: 150, height: 38 }, shadow: { x: 0, y: 1, width: 138, height: 20, alpha: .14 },
    hitArea: { x: 0, y: -43, width: 174, height: 126 }, indicatorAnchor: { x: 65, y: -109 }, lockAnchor: { x: 67, y: -96 },
  },
  watchtower: {
    stages: { 1: buildingAsset('watchtower') }, renderWidth: 137,
    groundAnchor: { x: .5, y: .879 }, visualOffset: { x: 0, y: 0 },
    footprint: { x: 0, y: 0, width: 105, height: 28 }, shadow: { x: 0, y: 1, width: 82, height: 16, alpha: .16 },
    hitArea: { x: 0, y: -64, width: 132, height: 176 }, indicatorAnchor: { x: 45, y: -157 }, lockAnchor: { x: 47, y: -145 },
  },
  workshop: {
    stages: { 1: buildingAsset('workshop') }, renderWidth: 174,
    groundAnchor: { x: .5, y: .855 }, visualOffset: { x: 1, y: 0 },
    footprint: { x: 1, y: 0, width: 146, height: 38 }, shadow: { x: 1, y: 1, width: 136, height: 20, alpha: .15 },
    hitArea: { x: 1, y: -43, width: 170, height: 126 }, indicatorAnchor: { x: 65, y: -109 }, lockAnchor: { x: 67, y: -97 },
  },
  stable: {
    stages: { 1: buildingAsset('stable') }, renderWidth: 184,
    groundAnchor: { x: .5, y: .846 }, visualOffset: { x: 0, y: 0 },
    footprint: { x: 0, y: 0, width: 156, height: 42 }, shadow: { x: 0, y: 2, width: 144, height: 22, alpha: .13 },
    hitArea: { x: 0, y: -40, width: 180, height: 122 }, indicatorAnchor: { x: 70, y: -106 }, lockAnchor: { x: 72, y: -94 },
  },
  tavern: {
    stages: { 1: buildingAsset('tavern') }, renderWidth: 174,
    groundAnchor: { x: .5, y: .878 }, visualOffset: { x: 0, y: 0 },
    footprint: { x: 0, y: 0, width: 146, height: 36 }, shadow: { x: 0, y: 1, width: 130, height: 19, alpha: .13 },
    hitArea: { x: 0, y: -44, width: 170, height: 130 }, indicatorAnchor: { x: 64, y: -114 }, lockAnchor: { x: 66, y: -101 },
  },
};

export function resolveBuildingTexture(id: BuildingVisualId, stage: BuildingVisualStage = 1): string {
  const visuals = BUILDING_VISUALS[id];
  return visuals.stages[stage] ?? visuals.stages[1];
}
