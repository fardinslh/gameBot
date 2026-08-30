import type { BattleEventState, BattleResult, BattleSide, HeroKey, HeroSkillKey, TroopType } from '@crown-and-coin/shared';

export interface BattleCombatHero {
  side: BattleSide;
  slot: 1 | 2 | 3;
  key: HeroKey;
  level: number;
  hp: number;
  atk: number;
  def: number;
  power: number;
  skillKey: HeroSkillKey;
}

export interface BattleEngineInput {
  seed: string;
  rulesVersion: 1;
  attacker: BattleCombatHero[];
  defender: BattleCombatHero[];
}

export interface ArmyCombatSquad {
  side: BattleSide;
  slot: 1 | 2 | 3;
  troopType: TroopType;
  initialUnitCount: number;
  perUnitHp: number;
  perUnitAtk: number;
  perUnitDef: number;
  aggregateMaxHp: number;
  commanderPlayerHeroId: string;
  commanderKey: HeroKey;
  commanderLevel: number;
  commanderSkillKey: HeroSkillKey;
  commanderPower: number;
  commanderPortraitAsset: string;
  squadPower: number;
}

export interface ArmyBattleEngineInput {
  seed: string;
  rulesVersion: 2;
  attacker: ArmyCombatSquad[];
  defender: ArmyCombatSquad[];
}

export type VersionedBattleEngineInput = BattleEngineInput | ArmyBattleEngineInput;

export interface BattleEngineResult {
  result: BattleResult;
  winnerSide: BattleSide;
  durationMs: number;
  logicalDurationMs: number;
  events: BattleEventState[];
}
