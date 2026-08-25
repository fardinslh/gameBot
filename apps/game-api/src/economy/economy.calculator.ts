import type { KingdomBuildingType, ResourceAmounts, ResourceType } from '@crown-and-coin/shared';
import { ECONOMY_CONFIG, OFFLINE_STORAGE_CAP_HOURS, productionPerHour } from './economy.config';
import { applyBpsIncrease } from '../kingdom/kingdom-effects.config';

const HOUR_MS = 3_600_000n;
export const OFFLINE_STORAGE_CAP_MS = OFFLINE_STORAGE_CAP_HOURS * Number(HOUR_MS);

export interface ProductionBuildingInput {
  id: string;
  type: KingdomBuildingType;
  level: number;
  productionRemainder: bigint;
}

export interface ProductionResult {
  buildingId: string;
  resource: ResourceType;
  gain: bigint;
  remainder: bigint;
  productionPerHour: bigint;
}

export function calculateProduction(
  buildings: readonly ProductionBuildingInput[],
  lastCollectedAt: Date,
  serverNow: Date,
  productionBonusBps = 0,
): ProductionResult[] {
  const elapsedMs = Math.max(0, Math.min(serverNow.getTime() - lastCollectedAt.getTime(), OFFLINE_STORAGE_CAP_MS));
  const elapsed = BigInt(elapsedMs);

  return buildings.flatMap((building): ProductionResult[] => {
    const config = ECONOMY_CONFIG[building.type];
    if (!config.resource) return [];

    const rate = applyBpsIncrease(productionPerHour(building.type, building.level), productionBonusBps);
    const numerator = rate * elapsed + building.productionRemainder;
    return [{
      buildingId: building.id,
      resource: config.resource,
      gain: numerator / HOUR_MS,
      remainder: numerator % HOUR_MS,
      productionPerHour: rate,
    }];
  });
}

export function capProductionToStorage(
  production: readonly ProductionResult[],
  balances: ResourceAmounts,
  capacities: ResourceAmounts,
): ProductionResult[] {
  const remaining = Object.fromEntries(
    Object.keys(capacities).map((resource) => {
      const type = resource as ResourceType;
      return [type, BigInt(capacities[type]) - BigInt(balances[type])];
    }),
  ) as Record<ResourceType, bigint>;

  return production.map((result) => {
    const available = remaining[result.resource] > 0n ? remaining[result.resource] : 0n;
    const gain = result.gain < available ? result.gain : available;
    remaining[result.resource] -= gain;
    return { ...result, gain };
  });
}
