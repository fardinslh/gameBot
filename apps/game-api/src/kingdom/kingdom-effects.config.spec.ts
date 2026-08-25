import { describe, expect, it } from 'vitest';
import { applyBpsDiscount, applyBpsIncrease, buildingEffect, kingdomEffectBps } from './kingdom-effects.config';

describe('kingdom building effects', () => {
  it('uses one percentage point per level above one and caps at fifteen percent', () => {
    expect(kingdomEffectBps(1)).toBe(0);
    expect(kingdomEffectBps(2)).toBe(100);
    expect(kingdomEffectBps(16)).toBe(1_500);
    expect(kingdomEffectBps(20)).toBe(1_500);
  });

  it('uses deterministic integer increase and ceiling discount arithmetic', () => {
    expect(applyBpsIncrease(383n, 100)).toBe(386n);
    expect(applyBpsDiscount(301n, 100)).toBe(298n);
  });

  it('presents structured current and next effects only for effect buildings', () => {
    expect(buildingEffect('ACADEMY', 2, false)).toEqual([{ type: 'PRODUCTION_BONUS', valueBps: 100, nextLevelValueBps: 200 }]);
    expect(buildingEffect('CASTLE', 2, false)).toEqual([]);
    expect(buildingEffect('BLACKSMITH', 20, true)[0]?.nextLevelValueBps).toBeNull();
  });
});
