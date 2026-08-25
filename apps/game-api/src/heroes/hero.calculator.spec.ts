import { describe, expect, it } from 'vitest';
import { deriveHeroStats, heroUpgradeCost } from './hero.calculator';
import { HERO_CONTENT } from './hero.config';

describe('Hero stat calculator', () => {
  it('returns the configured level-one stats and integer power', () => {
    expect(deriveHeroStats(HERO_CONTENT.KNIGHT, 1)).toEqual({ hp: 1_500, atk: 110, def: 170, power: 775 });
    expect(deriveHeroStats(HERO_CONTENT.RANGER, 1)).toEqual({ hp: 1_050, atk: 170, def: 90, power: 685 });
    expect(deriveHeroStats(HERO_CONTENT.MAGE, 1)).toEqual({ hp: 850, atk: 210, def: 70, power: 695 });
  });

  it('derives deterministic higher-level integer stats', () => {
    const first = deriveHeroStats(HERO_CONTENT.KNIGHT, 2);
    const repeated = deriveHeroStats(HERO_CONTENT.KNIGHT, 2);
    expect(first).toEqual({ hp: 1_665, atk: 118, def: 187, power: 850 });
    expect(repeated).toEqual(first);
    expect(Object.values(first).every(Number.isInteger)).toBe(true);
  });

  it('calculates positive integer Gold costs from centralized growth', () => {
    expect(heroUpgradeCost(1)).toBe(300n);
    expect(heroUpgradeCost(2)).toBe(405n);
    expect(heroUpgradeCost(3)).toBe(547n);
    expect(heroUpgradeCost(1, 100)).toBe(297n);
    expect(heroUpgradeCost(1, 1_500)).toBe(255n);
  });
});
