import type { KingdomBuildingType } from '@crown-and-coin/shared';
import { describe, expect, it } from 'vitest';
import { KingdomProgressGoalsService } from './kingdom-progress-goals.service';

const TYPES: readonly KingdomBuildingType[] = [
  'CASTLE', 'FARM', 'LUMBER_MILL', 'MINE', 'GRAND_MARKET',
  'ACADEMY', 'BLACKSMITH', 'WATCHTOWER', 'WORKSHOP',
];

function buildings(castleLevel: number, advancedLevel = 1) {
  return TYPES.map((type) => ({
    type,
    level: type === 'CASTLE' ? castleLevel : ['ACADEMY', 'BLACKSMITH', 'WATCHTOWER', 'WORKSHOP'].includes(type) ? advancedLevel : 1,
  }));
}

describe('KingdomProgressGoalsService', () => {
  const service = new KingdomProgressGoalsService();

  it.each([
    [1, 'WATCHTOWER', 2],
    [2, 'ACADEMY', 3],
    [3, 'WORKSHOP', 4],
    [4, 'BLACKSMITH', 5],
  ] as const)('returns next real building unlock at Castle %i', (castleLevel, key, requiredCastleLevel) => {
    const result = service.calculate(buildings(castleLevel));
    expect(result.nextUnlock).toMatchObject({ key, kind: 'BUILDING', requiredCastleLevel, unlocked: false });
    expect(result.transformation.next).toMatchObject({ requiredCastleLevel, unlockBuildingType: key });
    expect(result.milestones.some((milestone) => milestone.key === 'ADVANCED_PVP')).toBe(false);
    expect(result.allDistrictsUnlocked).toBe(false);
  });

  it('reports all current districts unlocked after Castle level 5', () => {
    const result = service.calculate(buildings(5));
    expect(result.nextUnlock).toBeNull();
    expect(result.allDistrictsUnlocked).toBe(true);
    expect(result.transformation).toMatchObject({
      current: { realmState: 'FORGED_KINGDOM', requiredCastleLevel: 5, unlockBuildingType: 'BLACKSMITH' },
      next: null,
      future: null,
    });
    expect(result.milestones).toHaveLength(4);
  });

  it('exposes only the next transformation and one future preview', () => {
    const result = service.calculate(buildings(1));
    expect(result.transformation).toEqual({
      current: { realmState: 'FRONTIER_HOLD', requiredCastleLevel: 1, unlockBuildingType: null },
      next: { realmState: 'GUARDED_SETTLEMENT', requiredCastleLevel: 2, unlockBuildingType: 'WATCHTOWER' },
      future: { realmState: 'LEARNED_COURT', requiredCastleLevel: 3, unlockBuildingType: 'ACADEMY' },
    });
  });

  it('matches effect progression and maximum-level state', () => {
    const levelFive = service.calculate(buildings(5, 5));
    expect(levelFive.effects).toHaveLength(4);
    expect(levelFive.effects.every((effect) => effect.valueBps === 400 && effect.nextLevelValueBps === 500)).toBe(true);
    const maximum = service.calculate(buildings(20, 20));
    expect(maximum.effects.every((effect) => effect.valueBps === 1_500 && effect.nextLevelValueBps === null)).toBe(true);
  });
});
