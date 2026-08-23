import type { MockBuilding, MockResource } from '../domain/kingdom-types';

// Phase 02 presentation data only. Nothing here is persisted or authoritative.
// Replace this module with API data in Phase 03 without changing the renderer.
export const MOCK_KINGDOM_RESOURCES: readonly MockResource[] = [
  { id: 'gold', value: '15.2K' },
  { id: 'food', value: '12.5K' },
  { id: 'wood', value: '8.4K' },
  { id: 'stone', value: '6.1K' },
  { id: 'gems', value: '120' },
];

export const MOCK_KINGDOM_BUILDINGS: readonly MockBuilding[] = [
  { id: 'castle', level: 8, nextLevel: 9, x: 0.5, y: 0.42, scale: 1.22 },
  { id: 'lumberMill', level: 5, nextLevel: 6, x: 0.23, y: 0.27, scale: 0.84 },
  { id: 'mine', level: 6, nextLevel: 7, x: 0.76, y: 0.28, scale: 0.86 },
  { id: 'farm', level: 5, nextLevel: 6, x: 0.23, y: 0.62, scale: 0.86 },
  { id: 'grandMarket', level: 7, nextLevel: 8, x: 0.73, y: 0.62, scale: 0.9 },
];

export const MOCK_PLAYER_LEVEL = 12;
