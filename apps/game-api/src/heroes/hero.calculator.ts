import type { HeroContentConfig } from './hero.config';
import { HERO_UPGRADE_BASE_GOLD, HERO_UPGRADE_GROWTH_BPS } from './hero.config';

const GROWTH_SCALE = 10_000n;

export interface DerivedHeroStats {
  hp: number;
  atk: number;
  def: number;
  power: number;
}

export function deriveHeroStats(config: HeroContentConfig, level: number): DerivedHeroStats {
  const normalizedLevel = Math.max(1, Math.trunc(level));
  const hp = growStat(config.baseHp, config.hpGrowthBps, normalizedLevel);
  const atk = growStat(config.baseAtk, config.atkGrowthBps, normalizedLevel);
  const def = growStat(config.baseDef, config.defGrowthBps, normalizedLevel);
  const power = Math.round((hp * 2 + atk * 20 + def * 15) / 10);
  return { hp, atk, def, power };
}

export function heroUpgradeCost(currentLevel: number): bigint {
  const exponent = BigInt(Math.max(0, Math.trunc(currentLevel) - 1));
  const numerator = BigInt(HERO_UPGRADE_BASE_GOLD) * BigInt(HERO_UPGRADE_GROWTH_BPS) ** exponent;
  const denominator = GROWTH_SCALE ** exponent;
  return (numerator + denominator - 1n) / denominator;
}

function growStat(base: number, growthBps: number, level: number): number {
  const exponent = BigInt(level - 1);
  const numerator = BigInt(base) * BigInt(growthBps) ** exponent;
  const denominator = GROWTH_SCALE ** exponent;
  return Number((numerator + denominator / 2n) / denominator);
}

