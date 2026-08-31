import type {
  PurchasableProfileCrestKey,
  ShopCategory,
  ShopFulfillmentType,
  ShopGemSource,
} from '@crown-and-coin/shared';

export interface ShopCatalogItem {
  key: PurchasableProfileCrestKey;
  category: ShopCategory;
  fulfillmentType: ShopFulfillmentType;
  gemPrice: number;
  displayOrder: number;
  enabled: boolean;
}

export const SHOP_CATALOG: readonly ShopCatalogItem[] = [
  { key: 'PROFILE_CREST_FOREST', category: 'COSMETICS', fulfillmentType: 'PROFILE_CREST', gemPrice: 40, displayOrder: 1, enabled: true },
  { key: 'PROFILE_CREST_CRIMSON', category: 'COSMETICS', fulfillmentType: 'PROFILE_CREST', gemPrice: 70, displayOrder: 2, enabled: true },
  { key: 'PROFILE_CREST_ROYAL', category: 'COSMETICS', fulfillmentType: 'PROFILE_CREST', gemPrice: 120, displayOrder: 3, enabled: true },
] as const;

export const BUILDING_FINISH_GEM_SECONDS = 60;
export const BUILDING_FINISH_MIN_GEMS = 1;
export const BUILDING_FINISH_MAX_GEMS = 50;
export const TRAINING_FINISH_GEM_SECONDS = 30;
export const TRAINING_FINISH_MIN_GEMS = 1;
export const TRAINING_FINISH_MAX_GEMS = 20;

export const SHOP_GEM_SOURCES: readonly ShopGemSource[] = [
  'DAILY_MISSIONS',
  'WEEKLY_MISSIONS',
  'ACHIEVEMENTS',
  'DAILY_RETURN',
] as const;

export function speedupPrice(remainingSeconds: number, secondsPerGem: number, minimum: number, maximum: number): number {
  const raw = Math.ceil(Math.max(0, remainingSeconds) / secondsPerGem);
  return Math.max(minimum, Math.min(maximum, raw));
}

export function buildingFinishPrice(remainingSeconds: number): number {
  return speedupPrice(remainingSeconds, BUILDING_FINISH_GEM_SECONDS, BUILDING_FINISH_MIN_GEMS, BUILDING_FINISH_MAX_GEMS);
}

export function trainingFinishPrice(remainingSeconds: number): number {
  return speedupPrice(remainingSeconds, TRAINING_FINISH_GEM_SECONDS, TRAINING_FINISH_MIN_GEMS, TRAINING_FINISH_MAX_GEMS);
}
