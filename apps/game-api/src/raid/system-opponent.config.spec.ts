import { describe, expect, it } from 'vitest';
import { deriveHeroStats } from '../heroes/hero.calculator';
import { HERO_CONTENT, STARTER_HERO_KEYS } from '../heroes/hero.config';
import { SYSTEM_OPPONENTS, SYSTEM_OPPONENT_TIERS } from './system-opponent.config';

describe('system opponent configuration', () => {
  it('defines exactly six tiers with five valid opponents each', () => {
    expect(SYSTEM_OPPONENT_TIERS).toHaveLength(6);
    expect(SYSTEM_OPPONENTS).toHaveLength(30);
    expect(SYSTEM_OPPONENT_TIERS.every((tier) => tier.opponents.length === 5)).toBe(true);
    expect(new Set(SYSTEM_OPPONENTS.map((opponent) => opponent.externalId)).size).toBe(30);
    expect(new Set(SYSTEM_OPPONENTS.map((opponent) => opponent.displayName)).size).toBe(30);
  });

  it('keeps stable keys, valid levels, and half-target replenishment thresholds', () => {
    for (const opponent of SYSTEM_OPPONENTS) {
      expect(opponent.externalId).toMatch(/^(?:system-opponent|raid-fixture):/);
      expect(opponent.heroLevels).toHaveLength(3);
      expect(opponent.heroLevels.every((level) => Number.isInteger(level) && level >= 1 && level <= 20)).toBe(true);
      expect(opponent.tier.castleLevel).toBeGreaterThanOrEqual(1);
      for (const resource of ['GOLD', 'FOOD', 'WOOD', 'STONE'] as const) {
        expect(opponent.tier.resourceThresholds[resource]).toBe(opponent.tier.resourceTargets[resource] / 2n);
      }
    }
  });

  it('derives a rising team-power range from normal Hero rules', () => {
    const ranges = SYSTEM_OPPONENT_TIERS.map((tier) => tier.opponents.map((opponent) =>
      opponent.heroLevels.reduce((total, level, index) =>
        total + deriveHeroStats(HERO_CONTENT[STARTER_HERO_KEYS[index]], level).power, 0),
    ));
    for (let index = 1; index < ranges.length; index += 1) {
      expect(Math.min(...ranges[index])).toBeGreaterThan(Math.min(...ranges[index - 1]));
      expect(Math.max(...ranges[index])).toBeGreaterThan(Math.max(...ranges[index - 1]));
    }
  });
});
