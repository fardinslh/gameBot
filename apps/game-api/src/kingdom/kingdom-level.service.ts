import { Injectable } from '@nestjs/common';
import type { KingdomBuildingType, KingdomProgressionState } from '@crown-and-coin/shared';
import { KINGDOM_BUILDING_TYPES } from '@crown-and-coin/shared';

const XP_PER_BUILDING_LEVEL = 100;
const XP_PER_KINGDOM_LEVEL = KINGDOM_BUILDING_TYPES.length * XP_PER_BUILDING_LEVEL;
const MAXIMUM_KINGDOM_LEVEL = 20;

@Injectable()
export class KingdomLevelService {
  calculate(buildings: readonly { type: KingdomBuildingType; level: number }[]): KingdomProgressionState {
    const castleLevel = buildings.find((building) => building.type === 'CASTLE')?.level ?? 1;
    const xp = buildings.reduce((total, building) => total + building.level * XP_PER_BUILDING_LEVEL, 0);
    const levelFromTotal = Math.max(1, Math.floor(xp / XP_PER_KINGDOM_LEVEL));
    const level = Math.min(MAXIMUM_KINGDOM_LEVEL, Math.max(castleLevel, levelFromTotal));
    return {
      level,
      xp,
      nextLevelRequirement: level >= MAXIMUM_KINGDOM_LEVEL ? null : (level + 1) * XP_PER_KINGDOM_LEVEL,
    };
  }
}
