import type { KingdomBuildingType } from '@crown-and-coin/shared';
import type { BuildingId, BuildingLayout } from '../domain/kingdom-types';

export const KINGDOM_BUILDING_LAYOUT: readonly BuildingLayout[] = [
  { id: 'castle', type: 'CASTLE', x: 0.5, y: 0.42, scale: 1.22 },
  { id: 'lumberMill', type: 'LUMBER_MILL', x: 0.23, y: 0.27, scale: 0.84 },
  { id: 'mine', type: 'MINE', x: 0.76, y: 0.28, scale: 0.86 },
  { id: 'farm', type: 'FARM', x: 0.23, y: 0.62, scale: 0.86 },
  { id: 'grandMarket', type: 'GRAND_MARKET', x: 0.73, y: 0.62, scale: 0.9 },
];

export const BUILDING_TYPE_TO_ID: Record<KingdomBuildingType, BuildingId> = {
  CASTLE: 'castle',
  FARM: 'farm',
  LUMBER_MILL: 'lumberMill',
  MINE: 'mine',
  GRAND_MARKET: 'grandMarket',
};
