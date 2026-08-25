import { describe, expect, it } from 'vitest';
import { KINGDOM_BUILDING_TYPES } from '@crown-and-coin/shared';
import { KingdomLevelService } from './kingdom-level.service';

describe('KingdomLevelService', () => {
  const service = new KingdomLevelService();

  it('starts at zero XP and advances once per 900 earned XP', () => {
    const levelOne = KINGDOM_BUILDING_TYPES.map((type) => ({ type, level: 1 }));
    expect(service.calculate(levelOne)).toEqual({ level: 1, xp: 0, xpIntoLevel: 0, xpRequiredForNextLevel: 900 });

    const castleFive = levelOne.map((building) => building.type === 'CASTLE' ? { ...building, level: 5 } : building);
    expect(service.calculate(castleFive)).toEqual({ level: 1, xp: 400, xpIntoLevel: 400, xpRequiredForNextLevel: 900 });

    const oneUpgradeEach = levelOne.map((building) => ({ ...building, level: 2 }));
    expect(service.calculate(oneUpgradeEach)).toEqual({ level: 2, xp: 900, xpIntoLevel: 0, xpRequiredForNextLevel: 900 });
  });

  it('does not let Castle force the level and caps complete progression at 20', () => {
    const castleTwenty = KINGDOM_BUILDING_TYPES.map((type) => ({ type, level: type === 'CASTLE' ? 20 : 1 }));
    expect(service.calculate(castleTwenty).level).toBe(3);
    const allTwenty = KINGDOM_BUILDING_TYPES.map((type) => ({ type, level: 20 }));
    expect(service.calculate(allTwenty)).toEqual({ level: 20, xp: 17_100, xpIntoLevel: 0, xpRequiredForNextLevel: null });
  });
});
