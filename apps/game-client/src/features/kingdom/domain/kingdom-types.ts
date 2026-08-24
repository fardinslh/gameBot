import type { KingdomBuildingState, KingdomBuildingType, ResourceType } from '@crown-and-coin/shared';

export type BuildingId = 'castle' | 'farm' | 'lumberMill' | 'mine' | 'grandMarket';

export type FutureBuildingId = 'barracks' | 'blacksmith' | 'academy' | 'granary' | 'watchtower' | 'workshop' | 'tavern' | 'stable';

export type WorldBuildingId = BuildingId | FutureBuildingId;

export type ResourceId = 'gold' | 'food' | 'wood' | 'stone' | 'gems';

export interface MockBuilding {
  id: BuildingId;
  level: number;
  nextLevel: number;
  x: number;
  y: number;
  scale: number;
}

export interface MockResource {
  id: ResourceId;
  value: string;
}

export interface BuildingLayout {
  id: BuildingId;
  type: KingdomBuildingType;
  groundX: number;
  groundY: number;
  scale: number;
}

export interface FutureBuildingLayout {
  id: FutureBuildingId;
  groundX: number;
  groundY: number;
  scale: number;
  castleLevel: number;
}

export interface KingdomBuildingView extends KingdomBuildingState {
  visualId: BuildingId;
}

export const RESOURCE_TO_ID: Record<ResourceType, ResourceId> = {
  GOLD: 'gold',
  FOOD: 'food',
  WOOD: 'wood',
  STONE: 'stone',
  GEMS: 'gems',
};
