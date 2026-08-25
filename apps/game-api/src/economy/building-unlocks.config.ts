import type { KingdomBuildingType, KingdomUnlockState } from '@crown-and-coin/shared';

export interface UnlockRule {
  key: KingdomUnlockState['key'];
  kind: KingdomUnlockState['kind'];
  requiredCastleLevel: number;
}

export const UNLOCK_RULES: readonly UnlockRule[] = [
  { key: 'CASTLE', kind: 'BUILDING', requiredCastleLevel: 1 },
  { key: 'FARM', kind: 'BUILDING', requiredCastleLevel: 1 },
  { key: 'LUMBER_MILL', kind: 'BUILDING', requiredCastleLevel: 1 },
  { key: 'MINE', kind: 'BUILDING', requiredCastleLevel: 1 },
  { key: 'GRAND_MARKET', kind: 'BUILDING', requiredCastleLevel: 1 },
  { key: 'WATCHTOWER', kind: 'BUILDING', requiredCastleLevel: 2 },
  { key: 'ACADEMY', kind: 'BUILDING', requiredCastleLevel: 3 },
  { key: 'WORKSHOP', kind: 'BUILDING', requiredCastleLevel: 4 },
  { key: 'BLACKSMITH', kind: 'BUILDING', requiredCastleLevel: 5 },
  { key: 'ADVANCED_PVP', kind: 'FEATURE', requiredCastleLevel: 7 },
] as const;

export function unlockCastleLevel(type: KingdomBuildingType): number {
  return UNLOCK_RULES.find((rule) => rule.kind === 'BUILDING' && rule.key === type)?.requiredCastleLevel ?? 1;
}

export function isBuildingUnlocked(type: KingdomBuildingType, castleLevel: number): boolean {
  return castleLevel >= unlockCastleLevel(type);
}

export function presentUnlocks(castleLevel: number): KingdomUnlockState[] {
  return UNLOCK_RULES.map((rule) => ({ ...rule, unlocked: castleLevel >= rule.requiredCastleLevel }));
}
