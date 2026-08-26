import type { BattleEventState, HeroKey } from '@crown-and-coin/shared';
import type { SfxKey } from './audio-manager';

export function sfxForBattleEvent(event: BattleEventState, sourceHero?: HeroKey): SfxKey[] {
  if (event.type === 'HERO_DEFEATED') return ['hero_defeated'];
  if (event.type === 'SKILL_CAST') {
    if (event.skillKey === 'SHIELD_WALL') return ['shield_wall'];
    if (event.skillKey === 'POWER_SHOT') return ['arrow_shot'];
    if (event.skillKey === 'ARCANE_BLAST') return ['magic_cast'];
  }
  if (event.type !== 'DAMAGE') return [];
  if (event.skillKey === 'POWER_SHOT' || sourceHero === 'RANGER') return ['arrow_impact'];
  if (event.skillKey === 'ARCANE_BLAST' || sourceHero === 'MAGE') return ['magic_impact'];
  return ['sword_hit'];
}
