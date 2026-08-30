import { describe, expect, it } from 'vitest';
import { calculateArmySquad } from '../army/army-power.calculator';
import { deriveHeroStats } from '../heroes/hero.calculator';
import { HERO_CONTENT } from '../heroes/hero.config';
import { CAMPAIGN_STAGES, CAMPAIGN_STAR_REWARDS } from './campaign.config';

function stagePower(index: number): number {
  return CAMPAIGN_STAGES[index].formation.reduce((total, squad) => {
    const hero = HERO_CONTENT[squad.commanderKey];
    const stats = deriveHeroStats(hero, squad.commanderLevel);
    return total + calculateArmySquad({
      troopType: squad.troopType,
      unitCount: squad.unitCount,
      commanderKey: squad.commanderKey,
      commanderLevel: squad.commanderLevel,
      commanderSkillKey: hero.skillKey,
      commanderPower: stats.power,
    }).squadPower;
  }, 0);
}

describe('Campaign Chapter One config', () => {
  it('defines exactly nine ordered stages with the approved Castle gates and armies', () => {
    expect(CAMPAIGN_STAGES.map((stage) => stage.key)).toEqual([
      'FRONTIER_01', 'FRONTIER_02', 'FRONTIER_03', 'FRONTIER_04', 'FRONTIER_05',
      'FRONTIER_06', 'FRONTIER_07', 'FRONTIER_08', 'FRONTIER_09',
    ]);
    expect(CAMPAIGN_STAGES.map((stage) => stage.requiredCastleLevel)).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3]);
    expect(CAMPAIGN_STAGES.filter((stage) => stage.isBoss).map((stage) => stage.key)).toEqual(['FRONTIER_09']);
    expect(CAMPAIGN_STAGES.map((stage) => stage.formation.map((squad) => [squad.troopType, squad.unitCount]))).toEqual([
      [['INFANTRY', 12], ['INFANTRY', 8], ['ARCHER', 5]],
      [['ARCHER', 10], ['ARCHER', 12], ['INFANTRY', 6]],
      [['CAVALRY', 14], ['CAVALRY', 9], ['ARCHER', 8]],
      [['INFANTRY', 18], ['ARCHER', 14], ['CAVALRY', 8]],
      [['CAVALRY', 12], ['INFANTRY', 18], ['ARCHER', 12]],
      [['ARCHER', 20], ['CAVALRY', 12], ['INFANTRY', 15]],
      [['INFANTRY', 24], ['ARCHER', 16], ['CAVALRY', 18]],
      [['CAVALRY', 18], ['ARCHER', 24], ['INFANTRY', 20]],
      [['INFANTRY', 28], ['ARCHER', 24], ['CAVALRY', 22]],
    ]);
  });

  it('has generally rising authoritative Army power and no duplicate Commander per stage', () => {
    const powers = CAMPAIGN_STAGES.map((_, index) => stagePower(index));
    expect(powers.every((power) => power > 0)).toBe(true);
    expect(powers.at(-1)).toBeGreaterThan(powers[0]);
    for (let index = 1; index < powers.length; index += 1) expect(powers[index]).toBeGreaterThan(powers[index - 1] * 0.85);
    for (const stage of CAMPAIGN_STAGES) expect(new Set(stage.formation.map((squad) => squad.commanderKey))).toHaveLength(3);
  });

  it('uses only non-Gem rewards and exact 9/18/27 milestones', () => {
    expect(CAMPAIGN_STAR_REWARDS.map((reward) => reward.stars)).toEqual([9, 18, 27]);
    expect([...CAMPAIGN_STAGES.flatMap((stage) => stage.firstClearRewards), ...CAMPAIGN_STAR_REWARDS.flatMap((reward) => reward.rewards)]
      .every((reward) => reward.resource !== 'GEMS' && reward.amount > 0n)).toBe(true);
  });
});
