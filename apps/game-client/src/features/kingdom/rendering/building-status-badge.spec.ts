import { describe, expect, it } from 'vitest';
import { KINGDOM_BUILDING_LAYOUT, KINGDOM_WORLD } from '../data/building-layout';
import { BUILDING_VISUALS } from './building-visuals';
import {
  BUILDING_STATUS_BADGE,
  BUILDING_UPGRADE_INDICATOR,
  calculateBuildingStatusLayout,
  calculateBuildingStatusPosition,
  statusElementsOverlap,
} from './building-status-badge';

const STATUS_BUILDINGS = [
  'castle',
  'farm',
  'lumberMill',
  'mine',
  'grandMarket',
  'academy',
  'blacksmith',
  'watchtower',
  'workshop',
] as const;

describe('building status badge', () => {
  it('uses a compact readable screen-space presentation', () => {
    expect(BUILDING_STATUS_BADGE).toMatchObject({ height: 22, width: 42, fontSize: 11 });
    expect(BUILDING_UPGRADE_INDICATOR).toMatchObject({ height: 20, width: 20, gap: 6 });
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

  it.each([
    { width: 320, height: 568 },
    { width: 375, height: 812 },
    { width: 390, height: 844 },
  ])('keeps level and upgrade status separate at $width×$height', ({ width, height }) => {
    const worldScale = width / KINGDOM_WORLD.width;
    const states = [
      { name: 'normal', indicator: null, unlockScale: 1 },
      { name: 'can-upgrade', indicator: 'upgrade', unlockScale: 1 },
      { name: 'upgrade-active', indicator: 'active', unlockScale: 1 },
      { name: 'selected-and-upgradeable', indicator: 'upgrade', unlockScale: 1 },
      { name: 'unlock-animation', indicator: 'upgrade', unlockScale: .9 },
    ] as const;
    for (const buildingId of STATUS_BUILDINGS) {
      const building = KINGDOM_BUILDING_LAYOUT.find(({ id }) => id === buildingId);
      expect(building).toBeDefined();
      if (!building) continue;
      for (const state of states) {
        const layout = calculateBuildingStatusLayout({
          statusStackAnchor: BUILDING_VISUALS[buildingId].statusStackAnchor,
          buildingPosition: { x: building.groundX, y: building.groundY },
          buildingScale: building.scale * state.unlockScale,
          resolution: 2,
          worldPosition: { x: 0, y: -height * .22 },
          worldScale,
        });
        if (state.indicator) {
          expect(statusElementsOverlap(layout.levelBadge, layout.upgradeIndicator), `${buildingId}:${state.name}`).toBe(false);
          expect(layout.upgradeIndicator.x, `${buildingId}:${state.name}`).toBe(layout.levelBadge.x);
          expect(layout.upgradeIndicator.y, `${buildingId}:${state.name}`).toBeLessThan(layout.levelBadge.y);
          expect(layout.levelBadge.y - layout.upgradeIndicator.y, `${buildingId}:${state.name}`).toBeGreaterThanOrEqual(
            (BUILDING_STATUS_BADGE.height + BUILDING_UPGRADE_INDICATOR.height) / 2 + BUILDING_UPGRADE_INDICATOR.gap,
          );
        }
      }
    }
  });
});
