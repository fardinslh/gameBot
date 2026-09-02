import { afterEach, describe, expect, it, vi } from 'vitest';
import { Assets, Texture } from 'pixi.js';
import type { ArmyResponse, HeroKey } from '@crown-and-coin/shared';
import { createHeroPresenceArtwork, deriveKingdomHeroPresences } from './hero-presence';

const commanders = (['KNIGHT', 'RANGER', 'MAGE'] as const).map((key, index) => ({ playerHeroId: `hero-${index}`, key, level: index + 1, power: 100, portraitAsset: `/assets/heroes/${key.toLowerCase()}.webp` }));
const army: ArmyResponse = {
  serverTime: new Date(0).toISOString(), power: 300, capacity: { maximum: 60, ready: 45, training: 0, available: 15 }, training: null,
  troops: [], commanders,
  formation: { slots: commanders.map((commander, index) => ({ slot: (index + 1) as 1 | 2 | 3, troopType: (['INFANTRY', 'ARCHER', 'CAVALRY'] as const)[index], unitCount: 10, commander, squadPower: 100 })) },
};
const building = (locked = false) => ({ indicator: null, level: 1, locked, appearanceVariant: 'WOOD' as const });

describe('Kingdom Hero presence', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

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

  it('owns reduced-motion return completion after cold asynchronous assets resolve', async () => {
    vi.useFakeTimers();
    let resolveTexture: ((texture: Texture) => void) | undefined;
    const coldTexture = new Promise<Texture>((resolve) => { resolveTexture = resolve; });
    vi.spyOn(Assets, 'load').mockImplementation(() => coldTexture as unknown as ReturnType<typeof Assets.load>);
    const artwork = createHeroPresenceArtwork();
    const onComplete = vi.fn();

    artwork.playReturn({
      battleId: 'cold-return',
      commanders: commanders.map(({ key, portraitAsset }) => ({ key, portraitAsset })),
      loot: { GOLD: '100', FOOD: '50', WOOD: '25', STONE: '10' },
      outcome: 'VICTORY',
    }, true, onComplete);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(onComplete).not.toHaveBeenCalled();
    expect(artwork.returnContainer.children).toHaveLength(0);

    resolveTexture?.(Texture.WHITE);
    await vi.advanceTimersByTimeAsync(0);
    expect(artwork.returnContainer.children).toHaveLength(1);
    expect(onComplete).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(180);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(artwork.returnContainer.children).toHaveLength(0);
    await vi.runAllTimersAsync();
    expect(onComplete).toHaveBeenCalledTimes(1);
    artwork.destroy();
  });
});
