import type { KingdomBuildingType } from '@crown-and-coin/shared';
import type { BuildingId, BuildingLayout, FutureBuildingLayout } from '../domain/kingdom-types';

export const KINGDOM_WORLD = { width: 640, height: 1536, sourceOffsetX: -192 } as const;

export const KINGDOM_BUILDING_LAYOUT: readonly BuildingLayout[] = [
  { id: 'castle', type: 'CASTLE', groundX: 320, groundY: 690, scale: 1.48 },
  { id: 'mine', type: 'MINE', groundX: 170, groundY: 396, scale: 1 },
  { id: 'farm', type: 'FARM', groundX: 88, groundY: 958, scale: 0.97 },
  { id: 'lumberMill', type: 'LUMBER_MILL', groundX: 552, groundY: 958, scale: 0.96 },
  { id: 'grandMarket', type: 'GRAND_MARKET', groundX: 320, groundY: 1172, scale: 1.03 },
  { id: 'academy', type: 'ACADEMY', groundX: 320, groundY: 365, scale: 0.9 },
  { id: 'blacksmith', type: 'BLACKSMITH', groundX: 90, groundY: 420, scale: 0.92 },
  { id: 'watchtower', type: 'WATCHTOWER', groundX: 590, groundY: 330, scale: 0.8 },
  { id: 'workshop', type: 'WORKSHOP', groundX: 275, groundY: 235, scale: 0.82 },
];

export const FUTURE_BUILDING_LAYOUT: readonly FutureBuildingLayout[] = [
  { id: 'barracks', groundX: 545, groundY: 430, scale: 1, castleLevel: 3 },
  { id: 'granary', groundX: 320, groundY: 932, scale: 0.9, castleLevel: 2 },
  { id: 'tavern', groundX: 168, groundY: 1228, scale: 0.86, castleLevel: 4 },
  { id: 'stable', groundX: 472, groundY: 1232, scale: 0.88, castleLevel: 4 },
];

export const BUILDING_TYPE_TO_ID: Record<KingdomBuildingType, BuildingId> = {
  CASTLE: 'castle',
  FARM: 'farm',
  LUMBER_MILL: 'lumberMill',
  MINE: 'mine',
  GRAND_MARKET: 'grandMarket',
  ACADEMY: 'academy',
  BLACKSMITH: 'blacksmith',
  WATCHTOWER: 'watchtower',
  WORKSHOP: 'workshop',
};
