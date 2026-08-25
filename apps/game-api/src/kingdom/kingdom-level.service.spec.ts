import { describe, expect, it } from 'vitest';
import { KINGDOM_BUILDING_TYPES } from '@crown-and-coin/shared';
import { KingdomLevelService } from './kingdom-level.service';

describe('KingdomLevelService', () => {
  const service = new KingdomLevelService();

  it('uses total building levels while preserving Castle as a minimum', () => {
    const levelOne = KINGDOM_BUILDING_TYPES.map((type) => ({ type, level: 1 }));
    expect(service.calculate(levelOne)).toEqual({ level: 1, xp: 900, nextLevelRequirement: 1800 });

    const castleFive = levelOne.map((building) => building.type === 'CASTLE' ? { ...building, level: 5 } : building);
    expect(service.calculate(castleFive).level).toBe(5);
  });
});
