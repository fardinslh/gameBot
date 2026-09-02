import { describe, expect, it } from 'vitest';
import type { ArmyResponse, HeroKey } from '@crown-and-coin/shared';
import { deriveKingdomHeroPresences } from './hero-presence';

const commanders = (['KNIGHT', 'RANGER', 'MAGE'] as const).map((key, index) => ({ playerHeroId: `hero-${index}`, key, level: index + 1, power: 100, portraitAsset: `/assets/heroes/${key.toLowerCase()}.webp` }));
const army: ArmyResponse = {
  serverTime: new Date(0).toISOString(), power: 300, capacity: { maximum: 60, ready: 45, training: 0, available: 15 }, training: null,
  troops: [], commanders,
  formation: { slots: commanders.map((commander, index) => ({ slot: (index + 1) as 1 | 2 | 3, troopType: (['INFANTRY', 'ARCHER', 'CAVALRY'] as const)[index], unitCount: 10, commander, squadPower: 100 })) },
};
const building = (locked = false) => ({ indicator: null, level: 1, locked, appearanceVariant: 'WOOD' as const });

describe('Kingdom Hero presence', () => {
  it('derives the three recognizable residents from the active owned Commanders', () => {
    const result = deriveKingdomHeroPresences(army, { castle: building(), lumberMill: building(), academy: building() });
    expect(result.map(({ key }) => key)).toEqual<HeroKey[]>(['KNIGHT', 'RANGER', 'MAGE']);
    expect(new Set(result.map(({ portraitAsset }) => portraitAsset)).size).toBe(3);
  });

  it('does not place a Hero at locked or unavailable content', () => {
    const result = deriveKingdomHeroPresences(army, { castle: building(), lumberMill: building(), academy: building(true) });
    expect(result.map(({ key }) => key)).toEqual(['KNIGHT', 'RANGER']);
    expect(deriveKingdomHeroPresences(null, { castle: building() })).toEqual([]);
  });
});
