import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_KINGDOM_THEME,
  KINGDOM_THEMES,
  PLANNED_KINGDOM_THEME_IDS,
} from '../domain/kingdom-theme';
import {
  BUILDING_VISUAL_CATALOG,
  CORE_EVOLUTION_BUILDINGS,
  getBuildingVisualState,
  getUpgradeTransition,
} from './building-visual-progression';

describe('building visual progression', () => {
  it('registers DEFAULT as the only implemented theme', () => {
    expect(DEFAULT_KINGDOM_THEME).toBe('DEFAULT');
    expect(Object.keys(KINGDOM_THEMES)).toEqual(['DEFAULT']);
    expect(Object.keys(BUILDING_VISUAL_CATALOG)).toEqual(['DEFAULT']);
    expect(PLANNED_KINGDOM_THEME_IDS).toContain('SAFAVID');
    expect(PLANNED_KINGDOM_THEME_IDS).not.toContain('DEFAULT');
  });

  it.each(CORE_EVOLUTION_BUILDINGS)('maps all required tier boundaries for %s', (buildingId) => {
    const resolve = (level: number) => getBuildingVisualState({ buildingId, level, theme: 'DEFAULT' });
    expect(resolve(1).tier).toBe('EARLY');
    expect(resolve(4)).toMatchObject({ tier: 'EARLY', minorStep: 3 });
    expect(resolve(5)).toMatchObject({ tier: 'DEVELOPED', minorStep: 0 });
    expect(resolve(9).tier).toBe('ADVANCED');
    expect(resolve(13).tier).toBe('FORTIFIED');
    expect(resolve(17).tier).toBe('PRESTIGE');
    expect(resolve(20)).toMatchObject({ tier: 'PRESTIGE', minorStep: 3, capstone: true });
  });

  it.each(CORE_EVOLUTION_BUILDINGS)('produces a valid and distinct state at every level for %s', (buildingId) => {
    const states = Array.from({ length: 20 }, (_, index) => getBuildingVisualState({
      buildingId,
      level: index + 1,
      theme: 'DEFAULT',
    }));
    for (const state of states) {
      expect(state.theme).toBe('DEFAULT');
      expect(state.asset).toMatch(/^\/assets\/kingdom\/evolution\/default\/.+\/tier-[1-5]\.webp$/);
      expect(state.asset).not.toMatch(/^\/assets\/kingdom\/evolution\/(castle|farm|lumber-mill|mine|grand-market)\//);
      expect(existsSync(join(process.cwd(), 'public', state.asset.replace(/^\/assets\//, 'assets/')))).toBe(true);
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
    expect(getBuildingVisualState({ buildingId: 'farm', level: -8 }).level).toBe(1);
    expect(getBuildingVisualState({ buildingId: 'farm', level: 99 }).level).toBe(20);
    expect(getUpgradeTransition(6, 7)).toEqual({ durationMs: 620, major: false });
    expect(getUpgradeTransition(4, 5)).toEqual({ durationMs: 980, major: true });
    expect(getUpgradeTransition(4, 5, true)).toEqual({ durationMs: 0, major: true });
  });
});
