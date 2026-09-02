import { Injectable } from '@nestjs/common';
import type {
  KingdomBuildingType,
  KingdomEffectProgressState,
  KingdomEffectType,
  KingdomProgressGoalsState,
} from '@crown-and-coin/shared';
import { isBuildingUnlocked, presentUnlocks } from '../economy/building-unlocks.config';
import { kingdomEffectBps } from './kingdom-effects.config';
import { KINGDOM_REALM_MILESTONES } from './kingdom-realm-milestones.config';

const EFFECT_BUILDINGS: readonly {
  buildingType: KingdomBuildingType;
  effectType: KingdomEffectType;
}[] = [
  { buildingType: 'WATCHTOWER', effectType: 'RAID_PROTECTION_BONUS' },
  { buildingType: 'ACADEMY', effectType: 'PRODUCTION_BONUS' },
  { buildingType: 'WORKSHOP', effectType: 'BUILDING_UPGRADE_SPEED' },
  { buildingType: 'BLACKSMITH', effectType: 'HERO_UPGRADE_DISCOUNT' },
];

@Injectable()
export class KingdomProgressGoalsService {
  calculate(buildings: readonly { type: KingdomBuildingType; level: number }[]): KingdomProgressGoalsState {
    const levelByType = new Map(buildings.map((building) => [building.type, building.level]));
    const castleLevel = levelByType.get('CASTLE') ?? 1;
    const milestones = presentUnlocks(castleLevel)
      .filter((unlock) => unlock.kind === 'BUILDING' && unlock.requiredCastleLevel > 1)
      .sort((left, right) => left.requiredCastleLevel - right.requiredCastleLevel);
    const nextUnlock = milestones.find((unlock) => !unlock.unlocked) ?? null;
    const currentTransformationIndex = findCurrentTransformationIndex(castleLevel);
    const effects: KingdomEffectProgressState[] = EFFECT_BUILDINGS.map(({ buildingType, effectType }) => {
      const buildingLevel = levelByType.get(buildingType) ?? 1;
      return {
        buildingType,
        buildingLevel,
        effectType,
        unlocked: isBuildingUnlocked(buildingType, castleLevel),
        valueBps: kingdomEffectBps(buildingLevel),
        nextLevelValueBps: buildingLevel >= 20 ? null : kingdomEffectBps(buildingLevel + 1),
      };
    });
    return {
      castleLevel,
      milestones,
      nextUnlock,
      allDistrictsUnlocked: nextUnlock === null,
      transformation: {
        current: KINGDOM_REALM_MILESTONES[currentTransformationIndex],
        next: KINGDOM_REALM_MILESTONES[currentTransformationIndex + 1] ?? null,
        future: KINGDOM_REALM_MILESTONES[currentTransformationIndex + 2] ?? null,
      },
      effects,
    };
  }

}

function findCurrentTransformationIndex(castleLevel: number): number {
  for (let index = KINGDOM_REALM_MILESTONES.length - 1; index >= 0; index -= 1) {
    if (castleLevel >= KINGDOM_REALM_MILESTONES[index].requiredCastleLevel) return index;
  }
  return 0;
}
