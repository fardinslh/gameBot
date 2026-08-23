import type { KingdomBuildingType, ResourceType } from '@crown-and-coin/shared';
import { ECONOMY_CONFIG, OFFLINE_STORAGE_CAP_HOURS, productionPerHour } from './economy.config';

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
): ProductionResult[] {
  const elapsedMs = Math.max(0, Math.min(serverNow.getTime() - lastCollectedAt.getTime(), OFFLINE_STORAGE_CAP_MS));
  const elapsed = BigInt(elapsedMs);

  return buildings.flatMap((building): ProductionResult[] => {
    const config = ECONOMY_CONFIG[building.type];
    if (!config.resource) return [];

    const rate = productionPerHour(building.type, building.level);
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
