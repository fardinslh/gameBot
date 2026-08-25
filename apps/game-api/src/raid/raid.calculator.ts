import type { RaidLootAmounts, RaidResourceType } from '@crown-and-coin/shared';
import { EMPTY_RAID_LOOT, RAID_LOOT_CAP, RAID_LOOT_RESERVE, RAID_PROTECTED_BPS } from './raid.config';
import { normalizeKingdomEffectBps } from '../kingdom/kingdom-effects.config';

export function calculateRaidLoot(
  balances: Partial<Record<RaidResourceType, bigint>>,
  watchtowerProtectionBps = 0,
): RaidLootAmounts {
  const result = { ...EMPTY_RAID_LOOT };
  const protectedBps = RAID_PROTECTED_BPS + BigInt(normalizeKingdomEffectBps(watchtowerProtectionBps));
  for (const resource of Object.keys(result) as RaidResourceType[]) {
    const balance = balances[resource] ?? 0n;
    const exposed = balance - (balance * protectedBps) / 10_000n;
    const aboveReserve = balance - RAID_LOOT_RESERVE[resource];
    result[resource] = max(0n, min(exposed, aboveReserve, RAID_LOOT_CAP[resource])).toString();
  }
  return result;
}

export function calculateTrophyDeltas(attacker: number, defender: number, attackerWon: boolean): { attacker: number; defender: number } {
  const expected = 1 / (1 + 10 ** ((defender - attacker) / 400));
  if (attackerWon) {
    const gain = clamp(Math.round(30 - expected * 15), 15, 30);
    return { attacker: gain, defender: -clamp(Math.round(5 + expected * 15), 5, 20) };
  }
  const loss = clamp(Math.round(5 + (1 - expected) * 15), 5, 20);
  return { attacker: -loss, defender: clamp(Math.round(15 + expected * 15), 15, 30) };
}

function min(...values: bigint[]): bigint { return values.reduce((a, b) => a < b ? a : b); }
function max(a: bigint, b: bigint): bigint { return a > b ? a : b; }
function clamp(value: number, low: number, high: number): number { return Math.max(low, Math.min(high, value)); }
