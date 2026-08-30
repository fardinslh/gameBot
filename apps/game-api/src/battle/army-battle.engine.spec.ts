import { describe, expect, it } from 'vitest';
import type { ArmyCombatSquad, BattleEngineResult } from './battle.types';
import { applyArmyShieldReduction, armyBaseDamage, armyRemainingHpPpm, hasCounterAdvantage, livingUnits, selectNearestLivingSlot, simulateArmyBattle, timeoutWinner, type ArmyCombatState } from './army-battle.engine';
import { ARMY_BATTLE_RULES_VERSION } from './battle.config';
import { createSeededRandom } from './seeded-random';

function army(side: 'ATTACKER' | 'DEFENDER'): ArmyCombatSquad[] {
  return [
    squad(side, 1, 'INFANTRY', 'KNIGHT', 'SHIELD_WALL', 20, 90, 9, 14),
    squad(side, 2, 'ARCHER', 'RANGER', 'POWER_SHOT', 15, 60, 14, 7),
    squad(side, 3, 'CAVALRY', 'MAGE', 'ARCANE_BLAST', 10, 80, 16, 10),
  ];
}

function squad(
  side: 'ATTACKER' | 'DEFENDER', slot: 1 | 2 | 3, troopType: ArmyCombatSquad['troopType'],
  commanderKey: ArmyCombatSquad['commanderKey'], commanderSkillKey: ArmyCombatSquad['commanderSkillKey'],
  initialUnitCount: number, perUnitHp: number, perUnitAtk: number, perUnitDef: number,
): ArmyCombatSquad {
  return { side, slot, troopType, initialUnitCount, perUnitHp, perUnitAtk, perUnitDef, aggregateMaxHp: initialUnitCount * perUnitHp, commanderPlayerHeroId: `${side}-${slot}`, commanderKey, commanderLevel: 1, commanderSkillKey, commanderPower: 700, commanderPortraitAsset: '/hero.webp', squadPower: 500 };
}

function combatState(value: ArmyCombatSquad, currentHp = value.aggregateMaxHp): ArmyCombatState {
  return { ...value, currentHp, nextBasicAt: 1, nextSkillAt: 1, shieldUntil: 0, shieldExpirationEmitted: true };
}

describe('Army Battle rules v2', () => {
  it('is deterministic byte-for-byte with bounded playback and aggregate unit state', () => {
    const input = { seed: 'army-fixed-seed', rulesVersion: ARMY_BATTLE_RULES_VERSION, attacker: army('ATTACKER'), defender: army('DEFENDER') };
    const first: BattleEngineResult = simulateArmyBattle(input);
    expect(simulateArmyBattle(input)).toEqual(first);
    expect(first.durationMs).toBeGreaterThanOrEqual(8_000);
    expect(first.durationMs).toBeLessThanOrEqual(15_000);
    expect(first.logicalDurationMs).toBeLessThanOrEqual(30_000);
    expect(first.events.filter((event) => event.type === 'DAMAGE').every((event) => event.remainingHp! >= 0 && event.remainingUnits! >= 0)).toBe(true);
  });

  it('implements the exact counter triangle and a restrained 20% outgoing bonus', () => {
    expect(hasCounterAdvantage('INFANTRY', 'CAVALRY')).toBe(true);
    expect(hasCounterAdvantage('CAVALRY', 'ARCHER')).toBe(true);
    expect(hasCounterAdvantage('ARCHER', 'INFANTRY')).toBe(true);
    expect(hasCounterAdvantage('INFANTRY', 'ARCHER')).toBe(false);
    const source = combatState(squad('ATTACKER', 1, 'INFANTRY', 'KNIGHT', 'SHIELD_WALL', 20, 90, 9, 14));
    const counterTarget = combatState(squad('DEFENDER', 1, 'CAVALRY', 'KNIGHT', 'SHIELD_WALL', 10, 80, 16, 10));
    const neutralTarget = { ...counterTarget, troopType: 'ARCHER' as const };
    expect(armyBaseDamage(source, counterTarget)).toBeGreaterThan(armyBaseDamage(source, neutralTarget));
  });

  it('reduces attack output with casualties and derives remaining units without negatives', () => {
    const full = combatState(squad('ATTACKER', 1, 'ARCHER', 'RANGER', 'POWER_SHOT', 15, 60, 14, 7));
    const injured = combatState(full, full.perUnitHp * 5);
    const target = combatState(squad('DEFENDER', 1, 'CAVALRY', 'KNIGHT', 'SHIELD_WALL', 10, 80, 16, 10));
    expect(armyBaseDamage(injured, target)).toBeLessThan(armyBaseDamage(full, target));
    expect(livingUnits(301, 60)).toBe(6);
    expect(livingUnits(0, 60)).toBe(0);
    expect(livingUnits(-10, 60)).toBe(0);
  });

  it('targets the same lane, then nearest lane with lower-slot tie break', () => {
    expect(selectNearestLivingSlot(2, [1, 2, 3])).toBe(2);
    expect(selectNearestLivingSlot(2, [1, 3])).toBe(1);
    expect(selectNearestLivingSlot(3, [1, 2])).toBe(2);
    expect(selectNearestLivingSlot(1, [])).toBeNull();
  });

  it('uses Army-wide remaining HP weighting at timeout instead of equal squad weighting', () => {
    const attacker = [
      combatState(squad('ATTACKER', 1, 'INFANTRY', 'KNIGHT', 'SHIELD_WALL', 100, 10, 1, 1), 600),
      combatState(squad('ATTACKER', 2, 'ARCHER', 'RANGER', 'POWER_SHOT', 1, 10, 1, 1), 0),
      combatState(squad('ATTACKER', 3, 'CAVALRY', 'MAGE', 'ARCANE_BLAST', 1, 10, 1, 1), 0),
    ];
    const defender = [
      combatState(squad('DEFENDER', 1, 'INFANTRY', 'KNIGHT', 'SHIELD_WALL', 34, 10, 1, 1), 102),
      combatState(squad('DEFENDER', 2, 'ARCHER', 'RANGER', 'POWER_SHOT', 34, 10, 1, 1), 102),
      combatState(squad('DEFENDER', 3, 'CAVALRY', 'MAGE', 'ARCANE_BLAST', 34, 10, 1, 1), 102),
    ];
    const oldEqualSquadScore = (values: ArmyCombatState[]) => values.reduce(
      (total, value) => total + Math.round((value.currentHp * 1_000_000) / value.aggregateMaxHp),
      0,
    );
    expect(oldEqualSquadScore(attacker)).toBeLessThan(oldEqualSquadScore(defender));
    expect(armyRemainingHpPpm(attacker, 'ATTACKER')).toBeGreaterThan(armyRemainingHpPpm(defender, 'DEFENDER'));
    expect(timeoutWinner([...attacker, ...defender], createSeededRandom('weighted-timeout'))).toBe('ATTACKER');
  });

  it('keeps skills attached to Commanders and defeated squads silent', () => {
    const moved = army('ATTACKER');
    [moved[0].commanderKey, moved[2].commanderKey] = [moved[2].commanderKey, moved[0].commanderKey];
    [moved[0].commanderSkillKey, moved[2].commanderSkillKey] = [moved[2].commanderSkillKey, moved[0].commanderSkillKey];
    const result = simulateArmyBattle({ seed: 'skills-follow-commanders', rulesVersion: 2, attacker: moved, defender: army('DEFENDER') });
    expect(result.events.some((event) => event.type === 'SKILL_CAST' && event.sourceSlot === 1 && event.skillKey === 'ARCANE_BLAST')).toBe(true);
    for (const defeated of result.events.filter((event) => event.type === 'SQUAD_DEFEATED')) {
      expect(result.events.some((event) => event.sequence > defeated.sequence && event.sourceSide === defeated.targetSide && event.sourceSlot === defeated.targetSlot && (event.type === 'BASIC_ATTACK' || event.type === 'SKILL_CAST'))).toBe(false);
    }
    expect(applyArmyShieldReduction(100)).toBe(65);
    const shieldApplied = result.events.find((event) => event.type === 'BUFF_APPLIED' && event.skillKey === 'SHIELD_WALL');
    const shieldExpired = result.events.find((event) => event.type === 'BUFF_EXPIRED' && event.skillKey === 'SHIELD_WALL');
    expect(shieldApplied).toBeDefined();
    expect(shieldExpired?.timeMs).toBeGreaterThan(shieldApplied?.timeMs ?? 0);
    const powerShotGroups = new Map<string, number>();
    for (const event of result.events.filter((event) => event.type === 'DAMAGE' && event.skillKey === 'POWER_SHOT')) {
      const castKey = `${event.timeMs}:${event.sourceSide}:${event.sourceSlot}`;
      powerShotGroups.set(castKey, (powerShotGroups.get(castKey) ?? 0) + 1);
    }
    expect(Math.max(...powerShotGroups.values())).toBe(1);
    const arcaneGroups = new Map<string, number>();
    for (const event of result.events.filter((event) => event.type === 'DAMAGE' && event.skillKey === 'ARCANE_BLAST')) {
      const castKey = `${event.timeMs}:${event.sourceSide}:${event.sourceSlot}`;
      arcaneGroups.set(castKey, (arcaneGroups.get(castKey) ?? 0) + 1);
    }
    expect(Math.max(...arcaneGroups.values())).toBeLessThanOrEqual(3);
  });
});
