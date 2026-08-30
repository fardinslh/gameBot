import type { HeroKey, HeroSkillKey, TroopType } from '@crown-and-coin/shared';
import { TROOP_CONTENT } from './army.config';

export const MAX_COMMANDER_COMBAT_LEVEL = 20;
export const COMMANDER_LEVEL_BONUS_BPS = 100;

export interface ArmyPowerSquadInput {
  troopType: TroopType;
  unitCount: number;
  commanderKey: HeroKey;
  commanderLevel: number;
  commanderSkillKey: HeroSkillKey;
  commanderPower: number;
}

export interface CalculatedArmySquad extends ArmyPowerSquadInput {
  perUnitHp: number;
  perUnitAtk: number;
  perUnitDef: number;
  aggregateMaxHp: number;
  squadPower: number;
}

export function commanderBonusBps(level: number): number {
  return Math.max(0, Math.min(MAX_COMMANDER_COMBAT_LEVEL, Math.trunc(level)) - 1) * COMMANDER_LEVEL_BONUS_BPS;
}

export function calculateArmySquad(input: ArmyPowerSquadInput): CalculatedArmySquad {
  const combat = TROOP_CONTENT[input.troopType].combat;
  const multiplier = 10_000 + commanderBonusBps(input.commanderLevel);
  const perUnitHp = Math.round((combat.hp * multiplier) / 10_000);
  const perUnitAtk = Math.round((combat.atk * multiplier) / 10_000);
  const troopPower = input.unitCount * (perUnitHp + perUnitAtk * 8 + combat.def * 5);
  return {
    ...input,
    perUnitHp,
    perUnitAtk,
    perUnitDef: combat.def,
    aggregateMaxHp: input.unitCount * perUnitHp,
    squadPower: Math.round((troopPower + input.commanderPower) / 10),
  };
}

export function calculateArmyPower(squads: readonly ArmyPowerSquadInput[]): number {
  return squads.reduce((total, squad) => total + calculateArmySquad(squad).squadPower, 0);
}
