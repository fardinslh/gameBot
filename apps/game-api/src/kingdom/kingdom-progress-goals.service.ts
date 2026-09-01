import { Injectable } from '@nestjs/common';
import type {
  KingdomBuildingType,
  KingdomEffectProgressState,
  KingdomEffectType,
  KingdomProgressGoalsState,
  KingdomRealmStateKey,
  KingdomTransformationMilestone,
} from '@crown-and-coin/shared';
import { isBuildingUnlocked, presentUnlocks } from '../economy/building-unlocks.config';
import { kingdomEffectBps } from './kingdom-effects.config';

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
    const currentUnlock = [...milestones].reverse().find((unlock) => unlock.unlocked) ?? null;
    const futureUnlock = nextUnlock
      ? milestones.find((unlock) => unlock.requiredCastleLevel > nextUnlock.requiredCastleLevel) ?? null
      : null;
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
        current: currentUnlock ? this.transformation(currentUnlock.requiredCastleLevel, currentUnlock.key as KingdomBuildingType) : this.transformation(1, null),
        next: nextUnlock ? this.transformation(nextUnlock.requiredCastleLevel, nextUnlock.key as KingdomBuildingType) : null,
        future: futureUnlock ? this.transformation(futureUnlock.requiredCastleLevel, futureUnlock.key as KingdomBuildingType) : null,
      },
      effects,
    };
  }

  private transformation(requiredCastleLevel: number, unlockBuildingType: KingdomBuildingType | null): KingdomTransformationMilestone {
    const realmStates: Record<number, KingdomRealmStateKey> = {
      1: 'FRONTIER_HOLD',
      2: 'GUARDED_SETTLEMENT',
      3: 'LEARNED_COURT',
      4: 'MAKERS_WARD',
      5: 'FORGED_KINGDOM',
    };
    return {
      realmState: realmStates[requiredCastleLevel] ?? 'FORGED_KINGDOM',
      requiredCastleLevel,
      unlockBuildingType,
    };
  }
}
