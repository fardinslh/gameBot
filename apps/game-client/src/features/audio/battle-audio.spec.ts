import { describe, expect, it } from 'vitest';
import type { BattleEventState } from '@crown-and-coin/shared';
import { sfxForBattleEvent } from './battle-audio';

const event = (input: Partial<BattleEventState>): BattleEventState => ({
  sequence: 1, timeMs: 100, type: 'DAMAGE', sourceSide: 'ATTACKER', sourceSlot: 1,
  targetSide: 'DEFENDER', targetSlot: 1, amount: 10, remainingHp: 90, skillKey: null, ...input,
});

describe('battle audio routing', () => {
  it('maps each Hero combat identity to the persisted event timeline', () => {
    expect(sfxForBattleEvent(event({}), 'KNIGHT')).toEqual(['sword_hit']);
    expect(sfxForBattleEvent(event({}), 'RANGER')).toEqual(['arrow_impact']);
    expect(sfxForBattleEvent(event({}), 'MAGE')).toEqual(['magic_impact']);
  });

  it('maps skill casts, impacts, shield wall, and defeat without inventing timing', () => {
    expect(sfxForBattleEvent(event({ type: 'SKILL_CAST', skillKey: 'POWER_SHOT' }))).toEqual(['arrow_shot']);
    expect(sfxForBattleEvent(event({ type: 'SKILL_CAST', skillKey: 'ARCANE_BLAST' }))).toEqual(['magic_cast']);
    expect(sfxForBattleEvent(event({ type: 'SKILL_CAST', skillKey: 'SHIELD_WALL' }))).toEqual(['shield_wall']);
    expect(sfxForBattleEvent(event({ type: 'HERO_DEFEATED' }))).toEqual(['hero_defeated']);
    expect(sfxForBattleEvent(event({ type: 'BATTLE_START' }))).toEqual([]);
  });
});
