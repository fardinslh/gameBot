import { describe, expect, it } from 'vitest';
import type { ArmyPreview, BattleReplayV2 } from '@crown-and-coin/shared';
import { deriveKingdomRaidReturn, deriveRaidDeparture, raidDepartureDuration } from './raid-journey-presentation';

function battle(result: 'ATTACKER_WIN' | 'DEFENDER_WIN'): BattleReplayV2 {
  return {
    id: `battle-${result}`, type: 'RAID', seed: 'seed', result, winnerPlayerId: result === 'ATTACKER_WIN' ? 'attacker' : 'defender', durationMs: 1_000,
    attacker: { playerId: 'attacker', displayName: 'A', trophiesBefore: 1_000, trophyDelta: result === 'ATTACKER_WIN' ? 12 : -8 },
    defender: { playerId: 'defender', displayName: 'D', trophiesBefore: 1_000, trophyDelta: result === 'ATTACKER_WIN' ? -12 : 8 },
    events: [], loot: { GOLD: '100', FOOD: '80', WOOD: '60', STONE: '40' }, balances: { GOLD: '100', FOOD: '80', WOOD: '60', STONE: '40', GEMS: '0' }, resolvedAt: new Date(0).toISOString(), rulesVersion: 2,
    armies: { attacker: [
      { side: 'ATTACKER', slot: 1, troopType: 'INFANTRY', initialUnitCount: 20, perUnitHp: 1, perUnitAtk: 1, perUnitDef: 1, aggregateMaxHp: 20, commanderKey: 'KNIGHT', commanderLevel: 1, commanderSkillKey: 'SHIELD_WALL', commanderPower: 1, commanderPortraitAsset: '/knight.webp', squadPower: 20 },
      { side: 'ATTACKER', slot: 2, troopType: 'ARCHER', initialUnitCount: 15, perUnitHp: 1, perUnitAtk: 1, perUnitDef: 1, aggregateMaxHp: 15, commanderKey: 'RANGER', commanderLevel: 1, commanderSkillKey: 'POWER_SHOT', commanderPower: 1, commanderPortraitAsset: '/ranger.webp', squadPower: 15 },
      { side: 'ATTACKER', slot: 3, troopType: 'CAVALRY', initialUnitCount: 10, perUnitHp: 1, perUnitAtk: 1, perUnitDef: 1, aggregateMaxHp: 10, commanderKey: 'MAGE', commanderLevel: 1, commanderSkillKey: 'ARCANE_BLAST', commanderPower: 1, commanderPortraitAsset: '/mage.webp', squadPower: 10 },
    ], defender: [] },
  };
}

describe('Raid journey presentation', () => {
  it('snapshots departure presentation without mutating authoritative Army data', () => {
    const replay = battle('ATTACKER_WIN');
    const army: ArmyPreview = {
      power: 45,
      squads: replay.armies.attacker.map((squad) => ({
        slot: squad.slot,
        troopType: squad.troopType,
        unitCount: squad.initialUnitCount,
        squadPower: squad.squadPower,
        commander: { playerHeroId: `hero-${squad.slot}`, key: squad.commanderKey, level: squad.commanderLevel, skillKey: squad.commanderSkillKey, portraitAsset: squad.commanderPortraitAsset, power: squad.commanderPower },
      })),
    };
    const before = structuredClone(army);
    const presentation = deriveRaidDeparture(army);
    presentation.squads[0].unitCount = 0;
    expect(army).toEqual(before);
  });

  it('derives a victory return from the immutable replay without changing settlement', () => {
    const replay = battle('ATTACKER_WIN');
    const before = structuredClone(replay);
    const result = deriveKingdomRaidReturn(replay);
    expect(result).toMatchObject({ battleId: replay.id, outcome: 'VICTORY', loot: replay.loot });
    expect(result.commanders.map((commander) => commander.key)).toEqual(['KNIGHT', 'RANGER', 'MAGE']);
    expect(replay).toEqual(before);
  });

  it('never presents fake loot after defeat', () => {
    expect(deriveKingdomRaidReturn(battle('DEFENDER_WIN'))).toMatchObject({ outcome: 'DEFEAT', loot: { GOLD: '0', FOOD: '0', WOOD: '0', STONE: '0' } });
  });

  it('keeps normal departure fast and reduced motion nearly immediate', () => {
    expect(raidDepartureDuration(false)).toBeGreaterThanOrEqual(1_000);
    expect(raidDepartureDuration(false)).toBeLessThanOrEqual(2_000);
    expect(raidDepartureDuration(true)).toBeLessThan(250);
  });
});
