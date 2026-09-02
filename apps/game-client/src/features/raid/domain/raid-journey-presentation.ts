import type { ArmyPreview, BattleReplayResponse, HeroKey, RaidLootAmounts } from '@crown-and-coin/shared';

export interface RaidJourneyCommander { key: HeroKey; portraitAsset: string; }
export interface KingdomRaidReturnPresentation {
  battleId: string;
  commanders: readonly RaidJourneyCommander[];
  loot: RaidLootAmounts;
  outcome: 'VICTORY' | 'DEFEAT';
}

const EMPTY_LOOT: RaidLootAmounts = { GOLD: '0', FOOD: '0', WOOD: '0', STONE: '0' };

export function raidDepartureDuration(reducedMotion: boolean): number {
  return reducedMotion ? 180 : 1_050;
}

export function deriveRaidDeparture(army: ArmyPreview): ArmyPreview {
  return {
    power: army.power,
    squads: army.squads.map((squad) => ({ ...squad, commander: { ...squad.commander } })),
  };
}

export function deriveKingdomRaidReturn(battle: BattleReplayResponse): KingdomRaidReturnPresentation {
  const victory = battle.result === 'ATTACKER_WIN';
  const commanders = battle.rulesVersion === 2
    ? battle.armies.attacker.map((squad) => ({ key: squad.commanderKey, portraitAsset: squad.commanderPortraitAsset }))
    : battle.teams.attacker.map((hero) => ({ key: hero.key, portraitAsset: hero.portraitAsset }));
  return { battleId: battle.id, commanders, loot: victory ? { ...battle.loot } : { ...EMPTY_LOOT }, outcome: victory ? 'VICTORY' : 'DEFEAT' };
}
