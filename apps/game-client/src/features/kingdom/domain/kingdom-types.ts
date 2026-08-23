export type BuildingId = 'castle' | 'farm' | 'lumberMill' | 'mine' | 'grandMarket';

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
