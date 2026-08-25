import { describe, expect, it } from 'vitest';
import { calculateProduction, capProductionToStorage, OFFLINE_STORAGE_CAP_MS } from './economy.calculator';
import { appearanceVariant, productionPerHour, requiredCastleLevel, storageCapacity, upgradeCost, upgradeDurationSeconds } from './economy.config';
import { isBuildingUnlocked, presentUnlocks } from './building-unlocks.config';

const buildings = [
  { id: 'farm', type: 'FARM' as const, level: 1, productionRemainder: 0n },
  { id: 'lumber', type: 'LUMBER_MILL' as const, level: 1, productionRemainder: 0n },
  { id: 'mine', type: 'MINE' as const, level: 1, productionRemainder: 0n },
  { id: 'market', type: 'GRAND_MARKET' as const, level: 1, productionRemainder: 0n },
  { id: 'castle', type: 'CASTLE' as const, level: 1, productionRemainder: 0n },
];

describe('server economy calculator', () => {
  it('returns zero production at zero elapsed time', () => {
    const now = new Date('2026-08-23T12:00:00.000Z');
    expect(calculateProduction(buildings, now, now).map((item) => item.gain)).toEqual([0n, 0n, 0n, 0n]);
  });

  it('calculates each producing building independently for normal elapsed time', () => {
    const start = new Date('2026-08-23T10:00:00.000Z');
    const results = calculateProduction(buildings, start, new Date('2026-08-23T11:00:00.000Z'));
    expect(Object.fromEntries(results.map((item) => [item.resource, item.gain]))).toEqual({
      FOOD: 500n,
      WOOD: 420n,
      STONE: 300n,
      GOLD: 380n,
    });
  });

  it('applies the Academy bonus before elapsed production and storage capping', () => {
    const start = new Date('2026-08-23T10:00:00.000Z');
    const results = calculateProduction(buildings, start, new Date('2026-08-23T11:00:00.000Z'), 100);
    expect(Object.fromEntries(results.map((item) => [item.resource, item.gain]))).toEqual({
      FOOD: 505n, WOOD: 424n, STONE: 303n, GOLD: 383n,
    });
    const capped = capProductionToStorage(results, { GOLD: '0', FOOD: '9998', WOOD: '0', STONE: '0', GEMS: '0' }, { GOLD: '10000', FOOD: '10000', WOOD: '10000', STONE: '8000', GEMS: '500' });
    expect(capped.find((item) => item.resource === 'FOOD')?.gain).toBe(2n);
  });

  it('caps production at exactly eight hours', () => {
    const start = new Date('2026-08-23T00:00:00.000Z');
    const atCap = calculateProduction(buildings, start, new Date(start.getTime() + OFFLINE_STORAGE_CAP_MS));
    const beyondCap = calculateProduction(buildings, start, new Date(start.getTime() + OFFLINE_STORAGE_CAP_MS * 10));
    expect(beyondCap).toEqual(atCap);
    expect(atCap.find((item) => item.resource === 'FOOD')?.gain).toBe(4_000n);
  });

  it('rejects negative elapsed time without trusting a future timestamp', () => {
    const now = new Date('2026-08-23T12:00:00.000Z');
    const future = new Date('2026-08-24T12:00:00.000Z');
    expect(calculateProduction(buildings, future, now).every((item) => item.gain === 0n)).toBe(true);
  });

  it('preserves fractional integer production as a remainder', () => {
    const start = new Date('2026-08-23T12:00:00.000Z');
    const first = calculateProduction([buildings[0]], start, new Date(start.getTime() + 1_000))[0];
    const second = calculateProduction([{ ...buildings[0], productionRemainder: first.remainder }], start, new Date(start.getTime() + 1_000))[0];
    expect(first.gain).toBe(0n);
    expect(second.remainder).toBe(first.remainder * 2n);
  });

  it('derives production, upgrade costs, durations, and Castle requirements from config', () => {
    expect(productionPerHour('FARM', 2)).toBe(590n);
    expect(upgradeCost('FARM', 2)).toEqual({ GOLD: 427n, WOOD: 147n });
    expect(upgradeDurationSeconds('FARM', 1)).toBeGreaterThanOrEqual(1);
    expect(upgradeDurationSeconds('FARM', 1, 1_500)).toBeLessThan(upgradeDurationSeconds('FARM', 1));
    expect(requiredCastleLevel('FARM', 3)).toBe(1);
    expect(requiredCastleLevel('FARM', 4)).toBe(2);
    expect(requiredCastleLevel('CASTLE', 4)).toBeNull();
  });

  it('caps production without carrying discarded full-storage rewards forward', () => {
    const start = new Date('2026-08-23T10:00:00.000Z');
    const production = calculateProduction([buildings[0]], start, new Date('2026-08-23T11:00:00.000Z'));
    const capped = capProductionToStorage(
      production,
      { GOLD: '0', FOOD: '9900', WOOD: '0', STONE: '0', GEMS: '0' },
      { GOLD: '10000', FOOD: '10000', WOOD: '10000', STONE: '8000', GEMS: '500' },
    );
    expect(capped[0].gain).toBe(100n);
    expect(capped[0].remainder).toBe(production[0].remainder);
  });

  it('derives storage, visual variants, and unlocks from centralized config', () => {
    expect(storageCapacity('GOLD', 1)).toBe(10_000n);
    expect(storageCapacity('GOLD', 2)).toBe(13_500n);
    expect(appearanceVariant(1)).toBe('WOOD');
    expect(appearanceVariant(5)).toBe('STONE');
    expect(appearanceVariant(10)).toBe('FORTIFIED');
    expect(isBuildingUnlocked('ACADEMY', 2)).toBe(false);
    expect(isBuildingUnlocked('ACADEMY', 3)).toBe(true);
    expect(presentUnlocks(7).find((unlock) => unlock.key === 'ADVANCED_PVP')?.unlocked).toBe(true);
  });
});
