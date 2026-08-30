import { describe, expect, it } from 'vitest';
import { calculateArmyPower, calculateArmySquad, commanderBonusBps } from './army-power.calculator';

const input = { troopType: 'INFANTRY' as const, unitCount: 20, commanderKey: 'KNIGHT' as const, commanderLevel: 1, commanderSkillKey: 'SHIELD_WALL' as const, commanderPower: 775 };

describe('authoritative Army Power', () => {
  it('applies 1% HP/ATK per Commander level above one with a level-20 cap', () => {
    expect(commanderBonusBps(1)).toBe(0);
    expect(commanderBonusBps(10)).toBe(900);
    expect(commanderBonusBps(20)).toBe(1_900);
    expect(commanderBonusBps(99)).toBe(1_900);
    const novice = calculateArmySquad(input);
    const veteran = calculateArmySquad({ ...input, commanderLevel: 20 });
    expect(veteran.perUnitHp).toBeGreaterThan(novice.perUnitHp);
    expect(veteran.perUnitAtk).toBeGreaterThan(novice.perUnitAtk);
    expect(veteran.squadPower).toBeGreaterThan(novice.squadPower);
  });

  it('sums three independently calculated squad powers', () => {
    const squads = [input, { ...input, troopType: 'ARCHER' as const, commanderKey: 'RANGER' as const, commanderSkillKey: 'POWER_SHOT' as const }, { ...input, troopType: 'CAVALRY' as const, commanderKey: 'MAGE' as const, commanderSkillKey: 'ARCANE_BLAST' as const }];
    expect(calculateArmyPower(squads)).toBe(squads.reduce((sum, squad) => sum + calculateArmySquad(squad).squadPower, 0));
  });
});
