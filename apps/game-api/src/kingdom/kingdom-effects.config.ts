import type { KingdomBuildingEffectState, KingdomBuildingType, KingdomEffectType } from '@crown-and-coin/shared';

export const BASIS_POINTS_SCALE = 10_000;
export const KINGDOM_EFFECT_STEP_BPS = 100;
export const KINGDOM_EFFECT_CAP_BPS = 1_500;

const EFFECT_BY_BUILDING: Partial<Record<KingdomBuildingType, KingdomEffectType>> = {
  ACADEMY: 'PRODUCTION_BONUS',
  BLACKSMITH: 'HERO_UPGRADE_DISCOUNT',
  WATCHTOWER: 'RAID_PROTECTION_BONUS',
  WORKSHOP: 'BUILDING_UPGRADE_SPEED',
};

export function kingdomEffectBps(level: number): number {
  return Math.min(KINGDOM_EFFECT_CAP_BPS, Math.max(0, Math.trunc(level) - 1) * KINGDOM_EFFECT_STEP_BPS);
}

export function normalizeKingdomEffectBps(value: number): number {
  return Math.min(KINGDOM_EFFECT_CAP_BPS, Math.max(0, Math.trunc(value)));
}

export function buildingEffect(type: KingdomBuildingType, level: number, atMaximum: boolean): KingdomBuildingEffectState[] {
  const effectType = EFFECT_BY_BUILDING[type];
  if (!effectType) return [];
  return [{
    type: effectType,
    valueBps: kingdomEffectBps(level),
    nextLevelValueBps: atMaximum ? null : kingdomEffectBps(level + 1),
  }];
}

export function applyBpsIncrease(value: bigint, bonusBps: number): bigint {
  return value * BigInt(BASIS_POINTS_SCALE + normalizeKingdomEffectBps(bonusBps)) / BigInt(BASIS_POINTS_SCALE);
}

export function applyBpsDiscount(value: bigint, discountBps: number): bigint {
  const numerator = value * BigInt(BASIS_POINTS_SCALE - normalizeKingdomEffectBps(discountBps));
  return (numerator + BigInt(BASIS_POINTS_SCALE - 1)) / BigInt(BASIS_POINTS_SCALE);
}

export function applyDurationDiscount(seconds: number, discountBps: number): number {
  const normalized = Math.max(1, Math.trunc(seconds));
  return Number(applyBpsDiscount(BigInt(normalized), discountBps));
}
