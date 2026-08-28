import { describe, expect, it } from 'vitest';
import { BUILDING_STATUS_BADGE, calculateBuildingStatusPosition } from './building-status-badge';

describe('building status badge', () => {
  it('uses a compact readable screen-space presentation', () => {
    expect(BUILDING_STATUS_BADGE).toMatchObject({ height: 22, width: 42, fontSize: 11 });
  });

  it('tracks world, building, and unlock scale without scaling its own UI', () => {
    expect(calculateBuildingStatusPosition({
      anchor: { x: 12, y: -40 },
      buildingPosition: { x: 200, y: 300 },
      buildingScale: 1.5,
      resolution: 2,
      worldPosition: { x: 0, y: 24 },
      worldScale: .5,
    })).toEqual({ x: 109, y: 144 });
  });

  it('snaps placement to physical pixels', () => {
    expect(calculateBuildingStatusPosition({
      anchor: { x: 0, y: 0 },
      buildingPosition: { x: 10.2, y: 20.3 },
      buildingScale: 1,
      resolution: 2,
      worldPosition: { x: 0, y: 0 },
      worldScale: 1,
    })).toEqual({ x: 10, y: 20.5 });
  });
});
