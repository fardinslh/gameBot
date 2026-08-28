import type { KingdomBuildingType } from '@crown-and-coin/shared';
import type { BuildingId, BuildingLayout, FutureBuildingLayout } from '../domain/kingdom-types';
import { EXPANSION_PRESENTATION_BY_BUILDING } from './kingdom-expansion-stages';

export const KINGDOM_WORLD = { width: 640, height: 1536, sourceOffsetX: -192 } as const;

export const KINGDOM_BUILDING_LAYOUT: readonly BuildingLayout[] = [
  { id: 'castle', type: 'CASTLE', groundX: 320, groundY: 665, scale: 1.48 },
  { id: 'mine', type: 'MINE', groundX: 145, groundY: 365, scale: 1 },
  { id: 'farm', type: 'FARM', groundX: 88, groundY: 958, scale: 0.97 },
  { id: 'lumberMill', type: 'LUMBER_MILL', groundX: 552, groundY: 958, scale: 0.96 },
  { id: 'grandMarket', type: 'GRAND_MARKET', groundX: 320, groundY: 1172, scale: 1.03 },
  { id: 'academy', type: 'ACADEMY', ...EXPANSION_PRESENTATION_BY_BUILDING.academy! },
  { id: 'blacksmith', type: 'BLACKSMITH', ...EXPANSION_PRESENTATION_BY_BUILDING.blacksmith! },
  { id: 'watchtower', type: 'WATCHTOWER', ...EXPANSION_PRESENTATION_BY_BUILDING.watchtower! },
  { id: 'workshop', type: 'WORKSHOP', ...EXPANSION_PRESENTATION_BY_BUILDING.workshop! },
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
