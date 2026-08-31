import { describe, expect, it } from 'vitest';
import {
  buildingFinishPrice,
  SHOP_CATALOG,
  trainingFinishPrice,
} from './shop.config';

describe('Retention 05 Shop config', () => {
  it('exposes exactly three permanent Profile Crest cosmetics at approved temporary prices', () => {
    expect(SHOP_CATALOG.map((item) => [item.key, item.gemPrice])).toEqual([
      ['PROFILE_CREST_FOREST', 40],
      ['PROFILE_CREST_CRIMSON', 70],
      ['PROFILE_CREST_ROYAL', 120],
    ]);
    expect(SHOP_CATALOG.every((item) => item.category === 'COSMETICS' && item.fulfillmentType === 'PROFILE_CREST' && item.enabled)).toBe(true);
  });

  it('uses bounded deterministic server speedup formulas', () => {
    expect(buildingFinishPrice(1)).toBe(1);
    expect(buildingFinishPrice(61)).toBe(2);
    expect(buildingFinishPrice(9_000)).toBe(50);
    expect(trainingFinishPrice(1)).toBe(1);
    expect(trainingFinishPrice(31)).toBe(2);
    expect(trainingFinishPrice(9_000)).toBe(20);
  });
});
