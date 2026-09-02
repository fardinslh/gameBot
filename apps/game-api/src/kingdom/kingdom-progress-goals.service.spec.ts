import type { KingdomBuildingType } from '@crown-and-coin/shared';
import { describe, expect, it } from 'vitest';
import { KingdomProgressGoalsService } from './kingdom-progress-goals.service';
import { KINGDOM_REALM_MILESTONES } from './kingdom-realm-milestones.config';

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

  it('defines the authoritative Castle realm milestones through level 20', () => {
    expect(KINGDOM_REALM_MILESTONES.map(({ requiredCastleLevel, realmState, unlockBuildingType }) => [requiredCastleLevel, realmState, unlockBuildingType])).toEqual([
      [1, 'FRONTIER_HOLD', null], [2, 'GUARDED_SETTLEMENT', 'WATCHTOWER'], [3, 'LEARNED_COURT', 'ACADEMY'],
      [4, 'MAKERS_WARD', 'WORKSHOP'], [5, 'FORGED_KINGDOM', 'BLACKSMITH'], [7, 'WAR_COUNCIL', null],
      [10, 'FORTIFIED_REALM', null], [13, 'GRAND_COURT', null], [17, 'CROWNED_REALM', null], [20, 'LEGENDARY_KINGDOM', null],
    ]);
  });

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

  it('continues realm transformation after all districts unlock at Castle level 5', () => {
    const result = service.calculate(buildings(5));
    expect(result.nextUnlock).toBeNull();
    expect(result.allDistrictsUnlocked).toBe(true);
    expect(result.transformation).toMatchObject({
      current: { realmState: 'FORGED_KINGDOM', requiredCastleLevel: 5, unlockBuildingType: 'BLACKSMITH' },
      next: { realmState: 'WAR_COUNCIL', requiredCastleLevel: 7, unlockBuildingType: null },
      future: { realmState: 'FORTIFIED_REALM', requiredCastleLevel: 10, unlockBuildingType: null },
    });
    expect(result.milestones).toHaveLength(4);
  });

  it.each([
    [6, 'FORGED_KINGDOM', 7, 'WAR_COUNCIL', 10, 'FORTIFIED_REALM'],
    [7, 'WAR_COUNCIL', 10, 'FORTIFIED_REALM', 13, 'GRAND_COURT'],
    [10, 'FORTIFIED_REALM', 13, 'GRAND_COURT', 17, 'CROWNED_REALM'],
    [13, 'GRAND_COURT', 17, 'CROWNED_REALM', 20, 'LEGENDARY_KINGDOM'],
    [17, 'CROWNED_REALM', 20, 'LEGENDARY_KINGDOM', null, null],
  ] as const)('projects current, next, and one later realm milestone at Castle %i', (level, current, nextLevel, next, futureLevel, future) => {
    const transformation = service.calculate(buildings(level)).transformation;
    expect(transformation.current.realmState).toBe(current);
    expect(transformation.next).toMatchObject({ requiredCastleLevel: nextLevel, realmState: next });
    if (futureLevel === null) expect(transformation.future).toBeNull();
    else expect(transformation.future).toMatchObject({ requiredCastleLevel: futureLevel, realmState: future });
  });

  it('returns the terminal Legendary Kingdom state at Castle level 20', () => {
    expect(service.calculate(buildings(20)).transformation).toEqual({
      current: { realmState: 'LEGENDARY_KINGDOM', requiredCastleLevel: 20, unlockBuildingType: null },
      next: null,
      future: null,
    });
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
