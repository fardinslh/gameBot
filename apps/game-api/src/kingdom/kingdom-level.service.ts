import { Injectable } from '@nestjs/common';
import type { KingdomBuildingType, KingdomProgressionState } from '@crown-and-coin/shared';

const XP_PER_BUILDING_LEVEL = 100;
const XP_PER_KINGDOM_LEVEL = 900;
const MAXIMUM_KINGDOM_LEVEL = 20;

@Injectable()
export class KingdomLevelService {
  calculate(buildings: readonly { type: KingdomBuildingType; level: number }[]): KingdomProgressionState {
    const xp = buildings.reduce(
      (total, building) => total + Math.max(0, building.level - 1) * XP_PER_BUILDING_LEVEL,
      0,
    );
    const level = Math.min(MAXIMUM_KINGDOM_LEVEL, 1 + Math.floor(xp / XP_PER_KINGDOM_LEVEL));
    return {
      level,
      xp,
      xpIntoLevel: level >= MAXIMUM_KINGDOM_LEVEL ? 0 : xp % XP_PER_KINGDOM_LEVEL,
      xpRequiredForNextLevel: level >= MAXIMUM_KINGDOM_LEVEL ? null : XP_PER_KINGDOM_LEVEL,
    };
  }
}
