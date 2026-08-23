import type { KingdomBuildingType } from '@crown-and-coin/shared';
import type { BuildingId, BuildingLayout, FutureBuildingLayout } from '../domain/kingdom-types';

export const KINGDOM_WORLD = { width: 640, height: 1536, sourceOffsetX: -192 } as const;

export const KINGDOM_BUILDING_LAYOUT: readonly BuildingLayout[] = [
  { id: 'castle', type: 'CASTLE', x: 320, y: 690, scale: 1.48 },
  { id: 'mine', type: 'MINE', x: 220, y: 430, scale: 1.02 },
  { id: 'farm', type: 'FARM', x: 100, y: 1008, scale: 1.02 },
  { id: 'lumberMill', type: 'LUMBER_MILL', x: 535, y: 1002, scale: 1 },
  { id: 'grandMarket', type: 'GRAND_MARKET', x: 320, y: 1192, scale: 1.08 },
];

export const FUTURE_BUILDING_LAYOUT: readonly FutureBuildingLayout[] = [
  { id: 'academy', x: 320, y: 250, scale: 0.92, castleLevel: 4 },
  { id: 'blacksmith', x: 82, y: 330, scale: 0.94, castleLevel: 3 },
  { id: 'barracks', x: 520, y: 445, scale: 1.02, castleLevel: 3 },
  { id: 'watchtower', x: 558, y: 205, scale: 0.86, castleLevel: 5 },
  { id: 'granary', x: 318, y: 925, scale: 0.9, castleLevel: 2 },
  { id: 'tavern', x: 152, y: 1235, scale: 0.88, castleLevel: 4 },
  { id: 'stable', x: 500, y: 1242, scale: 0.9, castleLevel: 4 },
];

export const BUILDING_TYPE_TO_ID: Record<KingdomBuildingType, BuildingId> = {
  CASTLE: 'castle',
  FARM: 'farm',
  LUMBER_MILL: 'lumberMill',
  MINE: 'mine',
  GRAND_MARKET: 'grandMarket',
};
