import type { HeroCombatClass, HeroKey, HeroSkillKey } from '@crown-and-coin/shared';

export interface HeroContentConfig {
  key: HeroKey;
  combatClass: HeroCombatClass;
  baseHp: number;
  baseAtk: number;
  baseDef: number;
  hpGrowthBps: number;
  atkGrowthBps: number;
  defGrowthBps: number;
  skillKey: HeroSkillKey;
  portraitAsset: string;
  sortOrder: number;
}

export const HERO_MAXIMUM_LEVEL = 20;
export const HERO_UPGRADE_BASE_GOLD = 300;
export const HERO_UPGRADE_GROWTH_BPS = 13_500;

export const HERO_CONTENT: Record<HeroKey, HeroContentConfig> = {
  KNIGHT: {
    key: 'KNIGHT',
    combatClass: 'TANK',
    baseHp: 1_500,
    baseAtk: 110,
    baseDef: 170,
    hpGrowthBps: 11_100,
    atkGrowthBps: 10_700,
    defGrowthBps: 11_000,
    skillKey: 'SHIELD_WALL',
    portraitAsset: '/assets/heroes/knight.webp',
    sortOrder: 1,
  },
  RANGER: {
    key: 'RANGER',
    combatClass: 'SINGLE_TARGET_DPS',
    baseHp: 1_050,
    baseAtk: 170,
    baseDef: 90,
    hpGrowthBps: 10_800,
    atkGrowthBps: 11_100,
    defGrowthBps: 10_700,
    skillKey: 'POWER_SHOT',
    portraitAsset: '/assets/heroes/ranger.webp',
    sortOrder: 2,
  },
  MAGE: {
    key: 'MAGE',
    combatClass: 'AOE_BURST',
    baseHp: 850,
    baseAtk: 210,
    baseDef: 70,
    hpGrowthBps: 10_700,
    atkGrowthBps: 11_300,
    defGrowthBps: 10_600,
    skillKey: 'ARCANE_BLAST',
    portraitAsset: '/assets/heroes/mage.webp',
    sortOrder: 3,
  },
};

export const STARTER_HERO_KEYS: HeroKey[] = ['KNIGHT', 'RANGER', 'MAGE'];

