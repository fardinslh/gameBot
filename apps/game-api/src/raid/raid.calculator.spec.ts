import { describe, expect, it } from 'vitest';
import { calculateRaidLoot, calculateTrophyDeltas } from './raid.calculator';

describe('Raid settlement calculators', () => {
  it('protects reserves, excludes Gems, and obeys resource caps', () => {
    expect(calculateRaidLoot({ GOLD: 100_000n, FOOD: 100_000n, WOOD: 2_000n, STONE: 500n })).toEqual({
      GOLD: '8000', FOOD: '6000', WOOD: '600', STONE: '0',
    });
  });

  it('keeps trophy gains/losses bounded', () => {
    const win = calculateTrophyDeltas(900, 1200, true);
    const loss = calculateTrophyDeltas(900, 1200, false);
    expect(win.attacker).toBeGreaterThanOrEqual(15);
    expect(win.attacker).toBeLessThanOrEqual(30);
    expect(win.defender).toBeLessThanOrEqual(-5);
    expect(loss.attacker).toBeLessThanOrEqual(-5);
    expect(loss.defender).toBeGreaterThanOrEqual(15);
  });
});

