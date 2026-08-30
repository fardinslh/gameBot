import { createHash } from 'node:crypto';
import type { HeroKey, TroopType } from '@crown-and-coin/shared';

export interface ArmyFingerprintSquad {
  slot: 1 | 2 | 3;
  troopType: TroopType;
  unitCount: number;
  commanderPlayerHeroId: string;
  commanderKey: HeroKey;
  commanderLevel: number;
}

export function armyFingerprint(squads: readonly ArmyFingerprintSquad[]): string {
  const canonical = [...squads]
    .sort((left, right) => left.slot - right.slot)
    .map((squad) => ({
      slot: squad.slot,
      troopType: squad.troopType,
      unitCount: squad.unitCount,
      commanderPlayerHeroId: squad.commanderPlayerHeroId,
      commanderKey: squad.commanderKey,
      commanderLevel: squad.commanderLevel,
    }));
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
