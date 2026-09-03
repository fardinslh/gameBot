import type { HeroKey } from '@crown-and-coin/shared';

export const HERO_WORLD_ASSET: Readonly<Record<HeroKey, string>> = {
  KNIGHT: '/assets/kingdom/characters/heroes/hero-atlas-v2.webp#knight',
  RANGER: '/assets/kingdom/characters/heroes/hero-atlas-v2.webp#ranger',
  MAGE: '/assets/kingdom/characters/heroes/hero-atlas-v2.webp#mage',
};

export const HERO_WORLD_ATLAS = '/assets/kingdom/characters/heroes/hero-atlas-v2.webp';
export const HERO_WORLD_ATLAS_ROW: Readonly<Record<HeroKey, number>> = { KNIGHT: 0, RANGER: 1, MAGE: 2 };

export const HERO_WORLD_ANIMATION = {
  KNIGHT: { idle: { fps: 2, loop: true }, walk: { fps: 4, loop: true } },
  RANGER: { idle: { fps: 2, loop: true }, walk: { fps: 5, loop: true } },
  MAGE: { idle: { fps: 3, loop: true }, magicIdle: { fps: 4, loop: true } },
} as const;
