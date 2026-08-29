import type { ResourceType, TroopType } from '@crown-and-coin/shared';

export interface TroopContentConfig {
  type: TroopType;
  displayOrder: number;
  trainingCosts: Partial<Record<ResourceType, bigint>>;
  trainingSecondsPerUnit: number;
  starterCount: number;
  futureCombatRole: 'DEFENSIVE_FRONTLINE' | 'RANGED_PRESSURE' | 'MOBILE_BURST';
}

export const MAX_TRAINING_BATCH = 25;
export const BASE_ARMY_CAPACITY = 60;
export const ARMY_CAPACITY_PER_CASTLE_LEVEL = 10;

export const TROOP_CONTENT: Readonly<Record<TroopType, TroopContentConfig>> = {
  INFANTRY: {
    type: 'INFANTRY',
    displayOrder: 1,
    trainingCosts: { FOOD: 20n, GOLD: 5n },
    trainingSecondsPerUnit: 2,
    starterCount: 20,
    futureCombatRole: 'DEFENSIVE_FRONTLINE',
  },
  ARCHER: {
    type: 'ARCHER',
    displayOrder: 2,
    trainingCosts: { FOOD: 15n, WOOD: 10n, GOLD: 5n },
    trainingSecondsPerUnit: 3,
    starterCount: 15,
    futureCombatRole: 'RANGED_PRESSURE',
  },
  CAVALRY: {
    type: 'CAVALRY',
    displayOrder: 3,
    trainingCosts: { FOOD: 30n, GOLD: 15n },
    trainingSecondsPerUnit: 5,
    starterCount: 10,
    futureCombatRole: 'MOBILE_BURST',
  },
};

export function armyCapacity(castleLevel: number): number {
  return BASE_ARMY_CAPACITY + ARMY_CAPACITY_PER_CASTLE_LEVEL * (Math.max(1, Math.trunc(castleLevel)) - 1);
}

export function trainingCost(type: TroopType, quantity: number): Partial<Record<ResourceType, bigint>> {
  return Object.fromEntries(
    Object.entries(TROOP_CONTENT[type].trainingCosts).map(([resource, amount]) => [
      resource,
      (amount ?? 0n) * BigInt(quantity),
    ]),
  );
}
