import { describe, expect, it } from 'vitest';
import {
  CORE_EVOLUTION_BUILDINGS,
  getBuildingVisualState,
  getUpgradeTransition,
} from './building-visual-progression';

describe('building visual progression', () => {
  it.each(CORE_EVOLUTION_BUILDINGS)('maps all required tier boundaries for %s', (buildingId) => {
    expect(getBuildingVisualState(buildingId, 1).tier).toBe('EARLY');
    expect(getBuildingVisualState(buildingId, 4)).toMatchObject({ tier: 'EARLY', minorStep: 3 });
    expect(getBuildingVisualState(buildingId, 5)).toMatchObject({ tier: 'DEVELOPED', minorStep: 0 });
    expect(getBuildingVisualState(buildingId, 9).tier).toBe('ADVANCED');
    expect(getBuildingVisualState(buildingId, 13).tier).toBe('FORTIFIED');
    expect(getBuildingVisualState(buildingId, 17).tier).toBe('PRESTIGE');
    expect(getBuildingVisualState(buildingId, 20)).toMatchObject({ tier: 'PRESTIGE', minorStep: 3, capstone: true });
  });

  it.each(CORE_EVOLUTION_BUILDINGS)('produces a valid and distinct state at every level for %s', (buildingId) => {
    const states = Array.from({ length: 20 }, (_, index) => getBuildingVisualState(buildingId, index + 1));
    for (const state of states) {
      expect(state.asset).toMatch(/tier-[1-5]\.webp$/);
      expect(state.level).toBeGreaterThanOrEqual(1);
      expect(state.level).toBeLessThanOrEqual(20);
      expect(state.renderWidth).toBeGreaterThan(0);
    }
    for (let index = 1; index < states.length; index += 1) {
      expect(states[index]).not.toEqual(states[index - 1]);
      expect(
        states[index].asset !== states[index - 1].asset
        || states[index].detailIds.join('|') !== states[index - 1].detailIds.join('|'),
      ).toBe(true);
    }
  });

  it('clamps unsupported levels and classifies transition weight', () => {
    expect(getBuildingVisualState('farm', -8).level).toBe(1);
    expect(getBuildingVisualState('farm', 99).level).toBe(20);
    expect(getUpgradeTransition(6, 7)).toEqual({ durationMs: 620, major: false });
    expect(getUpgradeTransition(4, 5)).toEqual({ durationMs: 980, major: true });
    expect(getUpgradeTransition(4, 5, true)).toEqual({ durationMs: 0, major: true });
  });
});
