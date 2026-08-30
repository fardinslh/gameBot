import { simulateArmyBattle } from './army-battle.engine';
import { simulateBattle } from './battle.engine';
import type { BattleEngineResult, VersionedBattleEngineInput } from './battle.types';

type BattleResolver<T extends VersionedBattleEngineInput> = (input: T) => BattleEngineResult;

const resolvers: { [Version in VersionedBattleEngineInput['rulesVersion']]: BattleResolver<Extract<VersionedBattleEngineInput, { rulesVersion: Version }>> } = {
  1: simulateBattle,
  2: simulateArmyBattle,
};

export function resolveBattleSimulation(input: VersionedBattleEngineInput): BattleEngineResult {
  const resolver = resolvers[input.rulesVersion] as BattleResolver<typeof input> | undefined;
  if (!resolver) throw new Error(`Unsupported Battle rules version ${String(input.rulesVersion)}`);
  return resolver(input);
}
