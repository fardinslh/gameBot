import { describe, expect, it } from 'vitest';
import type { ResourceAmounts, StorageCapacities } from '@crown-and-coin/shared';
import { en } from '../../../i18n/messages/en';
import { fa } from '../../../i18n/messages/fa';
import type { KingdomBuildingView } from './kingdom-types';
import { aggregateProductionRates, easeOutCubic, estimateCollectableProduction, formatAmount, getCapacityState, interpolateResourceBalances } from './collection-presentation';

const balances: ResourceAmounts = { GOLD: '900', FOOD: '1000', WOOD: '1200', STONE: '500', GEMS: '50' };
const capacities: StorageCapacities = { GOLD: '1000', FOOD: '1000', WOOD: '1000', STONE: '1000' };
const buildings = [
  { collectable: '150', productionPerHour: '360', resource: 'GOLD', unlocked: true },
  { collectable: '80', productionPerHour: '360', resource: 'FOOD', unlocked: true },
  { collectable: '90', productionPerHour: '360', resource: 'WOOD', unlocked: true },
  { collectable: '40', productionPerHour: '360', resource: 'STONE', unlocked: true },
] as KingdomBuildingView[];

describe('collection presentation', () => {
  it('classifies normal, full, overflow, and uncapped resources', () => {
    expect(getCapacityState('999', '1000')).toBe('normal');
    expect(getCapacityState('1000', '1000')).toBe('full');
    expect(getCapacityState('1001', '1000')).toBe('overflow');
    expect(getCapacityState('999999999999999999999')).toBeNull();
  });

  it('caps the estimate per resource and blocks full or overflow storage', () => {
    expect(estimateCollectableProduction(buildings, balances, capacities, 1_000_000)).toEqual({
      collectable: BigInt(240),
      raw: BigInt(760),
    });
  });

  it('reports raw production while returning zero when every store is blocked', () => {
    const full = { ...balances, GOLD: '1000', FOOD: '1000', WOOD: '1001', STONE: '1000' };
    expect(estimateCollectableProduction(buildings, full, capacities, 0)).toEqual({ collectable: BigInt(0), raw: BigInt(360) });
  });

  it('interpolates arbitrarily large balances with exact BigInt endpoints', () => {
    const start = { ...balances, GOLD: '900719925474099300000' };
    const end = { ...start, GOLD: '900719925474099399999' };
    expect(interpolateResourceBalances(start, end, 0).GOLD).toBe(start.GOLD);
    expect(interpolateResourceBalances(start, end, .5).GOLD).toBe('900719925474099349999');
    expect(interpolateResourceBalances(start, end, 1).GOLD).toBe(end.GOLD);
    expect(easeOutCubic(1)).toBe(1);
  });

  it('formats large values without Number precision loss', () => {
    expect(formatAmount('999999999999999999999')).toBe('999999999999999.9M');
  });

  it('aggregates authoritative unlocked building rates per resource', () => {
    expect(aggregateProductionRates([
      ...buildings,
      { ...buildings[0], productionPerHour: '40' },
      { ...buildings[1], productionPerHour: '999', unlocked: false },
    ])).toEqual({ GOLD: '400', FOOD: '360', WOOD: '360', STONE: '360', GEMS: '0' });
  });

  it('defines compact localized production and full labels', () => {
    expect([en.resourceFullShort, en.resourcePerHourShort, en.storageFull]).toEqual(['FULL', 'h', 'Storage full']);
    expect([fa.resourceFullShort, fa.resourcePerHourShort, fa.storageFull]).toEqual(['پر', 'س', 'انبارها پر هستند']);
  });
});
