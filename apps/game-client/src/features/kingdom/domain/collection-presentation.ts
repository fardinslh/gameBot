import { RESOURCE_TYPES, type ResourceAmounts, type ResourceType, type StorageCapacities } from '@crown-and-coin/shared';
import type { KingdomBuildingView } from './kingdom-types';

const HOUR_MS = BigInt(3_600_000);
const INTERPOLATION_SCALE = BigInt(1_000_000);

export type CapacityState = 'normal' | 'full' | 'overflow';

export function getCapacityState(balance: string, capacity?: string): CapacityState | null {
  if (capacity === undefined) return null;
  const current = BigInt(balance);
  const maximum = BigInt(capacity);
  if (current > maximum) return 'overflow';
  if (current === maximum) return 'full';
  return 'normal';
}

export function aggregateProductionRates(buildings: readonly KingdomBuildingView[]): ResourceAmounts {
  const rates: ResourceAmounts = { GOLD: '0', FOOD: '0', WOOD: '0', STONE: '0', GEMS: '0' };
  for (const building of buildings) {
    if (!building.unlocked || !building.resource) continue;
    rates[building.resource] = (BigInt(rates[building.resource]) + BigInt(building.productionPerHour)).toString();
  }
  return rates;
}

export function estimateCollectableProduction(
  buildings: readonly KingdomBuildingView[],
  balances: ResourceAmounts,
  capacities: StorageCapacities,
  elapsedMs: number,
  rawElapsedMs = elapsedMs,
): { collectable: bigint; raw: bigint } {
  const elapsed = BigInt(Math.max(0, Math.floor(elapsedMs)));
  const rawElapsed = BigInt(Math.max(0, Math.floor(rawElapsedMs)));
  const rawByResource = emptyBigIntAmounts();
  let rawSinceCollection = BigInt(0);
  for (const building of buildings) {
    if (!building.resource) continue;
    rawByResource[building.resource] += BigInt(building.collectable)
      + (BigInt(building.productionPerHour) * elapsed / HOUR_MS);
    rawSinceCollection += BigInt(building.productionPerHour) * rawElapsed / HOUR_MS;
  }
  let collectable = BigInt(0);
  let raw = BigInt(0);
  for (const resource of RESOURCE_TYPES) {
    const accrued = rawByResource[resource];
    raw += accrued;
    const capacity = capacities[resource];
    if (capacity === undefined) {
      collectable += accrued;
      continue;
    }
    const room = BigInt(capacity) - BigInt(balances[resource]);
    collectable += room > BigInt(0) && accrued > room ? room : room > BigInt(0) ? accrued : BigInt(0);
  }
  return { collectable, raw: rawSinceCollection > raw ? rawSinceCollection : raw };
}

export function interpolateResourceBalances(start: ResourceAmounts, end: ResourceAmounts, progress: number): ResourceAmounts {
  const bounded = Math.max(0, Math.min(1, progress));
  const scaled = BigInt(Math.round(bounded * Number(INTERPOLATION_SCALE)));
  return Object.fromEntries(RESOURCE_TYPES.map((resource) => {
    const from = BigInt(start[resource]);
    const to = BigInt(end[resource]);
    return [resource, (from + ((to - from) * scaled / INTERPOLATION_SCALE)).toString()];
  })) as unknown as ResourceAmounts;
}

export function easeOutCubic(progress: number): number {
  const bounded = Math.max(0, Math.min(1, progress));
  return 1 - ((1 - bounded) ** 3);
}

export function formatAmount(value: string): string {
  const amount = BigInt(value);
  if (amount >= BigInt(1_000_000)) return `${formatScaled(amount, BigInt(1_000_000))}M`;
  if (amount >= BigInt(1_000)) return `${formatScaled(amount, BigInt(1_000))}K`;
  return amount.toString();
}

function formatScaled(value: bigint, divisor: bigint): string {
  const tenths = value * BigInt(10) / divisor;
  return tenths % BigInt(10) === BigInt(0) ? (tenths / BigInt(10)).toString() : `${tenths / BigInt(10)}.${tenths % BigInt(10)}`;
}

function emptyBigIntAmounts(): Record<ResourceType, bigint> {
  return { GOLD: BigInt(0), FOOD: BigInt(0), WOOD: BigInt(0), STONE: BigInt(0), GEMS: BigInt(0) };
}
