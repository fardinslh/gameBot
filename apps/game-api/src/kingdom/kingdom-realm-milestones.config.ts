import type { KingdomTransformationMilestone } from '@crown-and-coin/shared';

/**
 * Authoritative presentation milestones for Castle-led realm evolution.
 * Building references reuse real unlocks; later milestones add no gameplay gate.
 */
export const KINGDOM_REALM_MILESTONES: readonly KingdomTransformationMilestone[] = [
  { realmState: 'FRONTIER_HOLD', requiredCastleLevel: 1, unlockBuildingType: null },
  { realmState: 'GUARDED_SETTLEMENT', requiredCastleLevel: 2, unlockBuildingType: 'WATCHTOWER' },
  { realmState: 'LEARNED_COURT', requiredCastleLevel: 3, unlockBuildingType: 'ACADEMY' },
  { realmState: 'MAKERS_WARD', requiredCastleLevel: 4, unlockBuildingType: 'WORKSHOP' },
  { realmState: 'FORGED_KINGDOM', requiredCastleLevel: 5, unlockBuildingType: 'BLACKSMITH' },
  { realmState: 'WAR_COUNCIL', requiredCastleLevel: 7, unlockBuildingType: null },
  { realmState: 'FORTIFIED_REALM', requiredCastleLevel: 10, unlockBuildingType: null },
  { realmState: 'GRAND_COURT', requiredCastleLevel: 13, unlockBuildingType: null },
  { realmState: 'CROWNED_REALM', requiredCastleLevel: 17, unlockBuildingType: null },
  { realmState: 'LEGENDARY_KINGDOM', requiredCastleLevel: 20, unlockBuildingType: null },
] as const;
