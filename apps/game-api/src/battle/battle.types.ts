import type { BattleEventState, BattleResult, BattleSide, HeroKey, HeroSkillKey } from '@crown-and-coin/shared';

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
  rulesVersion: number;
  attacker: BattleCombatHero[];
  defender: BattleCombatHero[];
}

export interface BattleEngineResult {
  result: BattleResult;
  winnerSide: BattleSide;
  durationMs: number;
  logicalDurationMs: number;
  events: BattleEventState[];
}

