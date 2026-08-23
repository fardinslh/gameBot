import { describe, expect, it } from 'vitest';
import { BATTLE_RULES_VERSION, MAX_PLAYBACK_MS, MAX_SIMULATION_MS, MIN_PLAYBACK_MS } from './battle.config';
import { applyShieldReduction, simulateBattle } from './battle.engine';
import type { BattleCombatHero } from './battle.types';

function team(side: 'ATTACKER' | 'DEFENDER', levelBoost = 0): BattleCombatHero[] {
  return [
    { side, slot: 1, key: 'KNIGHT', level: 1, hp: 1500 + levelBoost, atk: 110 + levelBoost, def: 170, power: 800, skillKey: 'SHIELD_WALL' },
    { side, slot: 2, key: 'RANGER', level: 1, hp: 1050 + levelBoost, atk: 170 + levelBoost, def: 90, power: 800, skillKey: 'POWER_SHOT' },
    { side, slot: 3, key: 'MAGE', level: 1, hp: 850 + levelBoost, atk: 210 + levelBoost, def: 70, power: 800, skillKey: 'ARCANE_BLAST' },
  ];
}

describe('deterministic battle engine', () => {
  it('replays the same seed byte-for-byte and stays within timing and HP limits', () => {
    const input = { seed: 'fixed-seed', rulesVersion: BATTLE_RULES_VERSION, attacker: team('ATTACKER'), defender: team('DEFENDER') };
    const first = simulateBattle(input);
    expect(simulateBattle(input)).toEqual(first);
    expect(first.logicalDurationMs).toBeLessThanOrEqual(MAX_SIMULATION_MS);
    expect(first.durationMs).toBeGreaterThanOrEqual(MIN_PLAYBACK_MS);
    expect(first.durationMs).toBeLessThanOrEqual(MAX_PLAYBACK_MS);
    expect(first.events.filter((event) => event.remainingHp !== null).every((event) => event.remainingHp! >= 0)).toBe(true);
  });

  it('emits all three MVP skills and never lets a defeated Hero act later', () => {
    const result = simulateBattle({ seed: 'skill-seed', rulesVersion: BATTLE_RULES_VERSION, attacker: team('ATTACKER'), defender: team('DEFENDER') });
    const skills = new Set(result.events.filter((event) => event.type === 'SKILL_CAST').map((event) => event.skillKey));
    expect(skills).toEqual(new Set(['SHIELD_WALL', 'POWER_SHOT', 'ARCANE_BLAST']));
    for (const defeated of result.events.filter((event) => event.type === 'HERO_DEFEATED')) {
      expect(result.events.some((event) => event.sequence > defeated.sequence && event.sourceSide === defeated.targetSide && event.sourceSlot === defeated.targetSlot && (event.type === 'BASIC_ATTACK' || event.type === 'SKILL_CAST'))).toBe(false);
    }
  });

  it('permits seeded variation and keeps Power Shot single-target and Arcane Blast AOE', () => {
    const durable = (side: 'ATTACKER' | 'DEFENDER') => team(side).map((hero) => ({ ...hero, hp: hero.hp + 10_000 }));
    const first = simulateBattle({ seed: 'variation-a', rulesVersion: BATTLE_RULES_VERSION, attacker: durable('ATTACKER'), defender: durable('DEFENDER') });
    const second = simulateBattle({ seed: 'variation-b', rulesVersion: BATTLE_RULES_VERSION, attacker: durable('ATTACKER'), defender: durable('DEFENDER') });
    expect(second.events).not.toEqual(first.events);
    const powerShotCounts = new Map<string, number>();
    for (const event of first.events.filter((item) => item.type === 'DAMAGE' && item.skillKey === 'POWER_SHOT')) {
      const key = `${event.sourceSide}:${event.timeMs}`;
      powerShotCounts.set(key, (powerShotCounts.get(key) ?? 0) + 1);
    }
    expect(Math.max(...powerShotCounts.values())).toBe(1);
    const arcaneCounts = new Map<string, number>();
    for (const event of first.events.filter((item) => item.type === 'DAMAGE' && item.skillKey === 'ARCANE_BLAST')) {
      const key = `${event.sourceSide}:${event.timeMs}`;
      arcaneCounts.set(key, (arcaneCounts.get(key) ?? 0) + 1);
    }
    expect(Math.max(...arcaneCounts.values())).toBe(3);
  });

  it('applies the configured Shield Wall reduction', () => {
    expect(applyShieldReduction(100)).toBe(65);
    expect(applyShieldReduction(1)).toBe(1);
  });
});
