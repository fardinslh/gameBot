import type { HeroKey } from '@crown-and-coin/shared';

export const HERO_BATTLE_RULES_VERSION = 1 as const;
export const ARMY_BATTLE_RULES_VERSION = 2 as const;
export const BATTLE_RULES_VERSION = ARMY_BATTLE_RULES_VERSION;
export const MAX_SIMULATION_MS = 30_000;
export const MIN_PLAYBACK_MS = 8_000;
export const MAX_PLAYBACK_MS = 15_000;
export const DEFENSE_FACTOR_BPS = 3_500;
export const MINIMUM_DAMAGE = 25;
export const CRITICAL_CHANCE_BPS = 1_000;
export const CRITICAL_MULTIPLIER_BPS = 15_000;
export const DAMAGE_VARIANCE_MIN_BPS = 9_500;
export const DAMAGE_VARIANCE_MAX_BPS = 10_500;

export const HERO_BATTLE_CONFIG: Record<HeroKey, {
  attackIntervalMs: number;
  skillCooldownMs: number;
}> = {
  KNIGHT: { attackIntervalMs: 1_400, skillCooldownMs: 5_000 },
  RANGER: { attackIntervalMs: 1_200, skillCooldownMs: 4_000 },
  MAGE: { attackIntervalMs: 1_500, skillCooldownMs: 5_500 },
};

export const SHIELD_WALL_DURATION_MS = 2_500;
export const SHIELD_WALL_REDUCTION_BPS = 3_500;
export const POWER_SHOT_MULTIPLIER_BPS = 18_000;
export const ARCANE_BLAST_MULTIPLIER_BPS = 10_000;
export const ARMY_ARCANE_BLAST_MULTIPLIER_BPS = 7_500;
export const COUNTER_DAMAGE_BONUS_BPS = 2_000;
export const ARMY_MINIMUM_DAMAGE = 5;
