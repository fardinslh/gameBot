import type { RaidResourceType } from '@crown-and-coin/shared';

export type SystemOpponentTierId = 1 | 2 | 3 | 4 | 5 | 6;

export interface SystemOpponentDefinition {
  externalId: string;
  displayName: string;
  kingdomName: string;
  trophies: number;
  heroLevels: readonly [number, number, number];
}

export interface SystemOpponentTier {
  id: SystemOpponentTierId;
  castleLevel: number;
  buildingLevel: number;
  resourceTargets: Record<RaidResourceType, bigint>;
  resourceThresholds: Record<RaidResourceType, bigint>;
  opponents: readonly SystemOpponentDefinition[];
}

const resources = (
  gold: bigint,
  food: bigint,
  wood: bigint,
  stone: bigint,
): Record<RaidResourceType, bigint> => ({ GOLD: gold, FOOD: food, WOOD: wood, STONE: stone });

const tier = (
  id: SystemOpponentTierId,
  castleLevel: number,
  buildingLevel: number,
  targets: Record<RaidResourceType, bigint>,
  opponents: readonly SystemOpponentDefinition[],
): SystemOpponentTier => ({
  id,
  castleLevel,
  buildingLevel,
  resourceTargets: targets,
  resourceThresholds: Object.fromEntries(
    Object.entries(targets).map(([resource, target]) => [resource, target / 2n]),
  ) as Record<RaidResourceType, bigint>,
  opponents,
});

export const SYSTEM_OPPONENT_TIERS: readonly SystemOpponentTier[] = [
  tier(1, 1, 1, resources(12_000n, 10_000n, 8_000n, 6_000n), [
    { externalId: 'system-opponent:t1-dawn-scout', displayName: 'Dawn Scout', kingdomName: 'Oakrest', trophies: 780, heroLevels: [1, 1, 1] },
    { externalId: 'system-opponent:t1-moss-guard', displayName: 'Moss Guard', kingdomName: 'Greenbarrow', trophies: 820, heroLevels: [1, 1, 2] },
    { externalId: 'raid-fixture:iron-wolf', displayName: 'Iron Wolf', kingdomName: 'Ironhold', trophies: 860, heroLevels: [1, 2, 1] },
    { externalId: 'system-opponent:t1-amber-rook', displayName: 'Amber Rook', kingdomName: 'Westfield', trophies: 900, heroLevels: [2, 1, 1] },
    { externalId: 'system-opponent:t1-pine-hart', displayName: 'Pine Hart', kingdomName: 'Pinewatch', trophies: 940, heroLevels: [2, 2, 1] },
  ]),
  tier(2, 2, 2, resources(18_000n, 14_000n, 12_000n, 9_000n), [
    { externalId: 'system-opponent:t2-red-badger', displayName: 'Red Badger', kingdomName: 'Briarwall', trophies: 900, heroLevels: [2, 2, 2] },
    { externalId: 'raid-fixture:silver-fox', displayName: 'Silver Fox', kingdomName: 'Moonwatch', trophies: 940, heroLevels: [2, 2, 3] },
    { externalId: 'system-opponent:t2-river-stag', displayName: 'River Stag', kingdomName: 'Fordhaven', trophies: 980, heroLevels: [2, 3, 2] },
    { externalId: 'system-opponent:t2-ash-spear', displayName: 'Ash Spear', kingdomName: 'Ashenford', trophies: 1_020, heroLevels: [3, 2, 2] },
    { externalId: 'system-opponent:t2-copper-owl', displayName: 'Copper Owl', kingdomName: 'Coppergate', trophies: 1_060, heroLevels: [3, 3, 2] },
  ]),
  tier(3, 3, 3, resources(26_000n, 20_000n, 17_000n, 13_000n), [
    { externalId: 'system-opponent:t3-grey-boar', displayName: 'Grey Boar', kingdomName: 'Stonefield', trophies: 1_040, heroLevels: [3, 3, 3] },
    { externalId: 'system-opponent:t3-golden-hawk', displayName: 'Golden Hawk', kingdomName: 'Highmeadow', trophies: 1_080, heroLevels: [3, 3, 4] },
    { externalId: 'raid-fixture:lion-heart', displayName: 'Lion Heart', kingdomName: 'Sunspire', trophies: 1_120, heroLevels: [3, 4, 3] },
    { externalId: 'system-opponent:t3-cedar-shield', displayName: 'Cedar Shield', kingdomName: 'Cedarhold', trophies: 1_160, heroLevels: [4, 3, 3] },
    { externalId: 'system-opponent:t3-ivory-pike', displayName: 'Ivory Pike', kingdomName: 'Whiteford', trophies: 1_200, heroLevels: [4, 4, 3] },
  ]),
  tier(4, 4, 4, resources(38_000n, 29_000n, 24_000n, 18_000n), [
    { externalId: 'system-opponent:t4-winter-wolf', displayName: 'Winter Wolf', kingdomName: 'Frostmere', trophies: 1_180, heroLevels: [4, 4, 4] },
    { externalId: 'system-opponent:t4-bronze-bull', displayName: 'Bronze Bull', kingdomName: 'Bronzefort', trophies: 1_220, heroLevels: [4, 4, 5] },
    { externalId: 'raid-fixture:black-raven', displayName: 'Black Raven', kingdomName: 'Nightfall', trophies: 1_260, heroLevels: [4, 5, 4] },
    { externalId: 'system-opponent:t4-crimson-ram', displayName: 'Crimson Ram', kingdomName: 'Redmarch', trophies: 1_300, heroLevels: [5, 4, 4] },
    { externalId: 'system-opponent:t4-iron-heron', displayName: 'Iron Heron', kingdomName: 'Marshguard', trophies: 1_340, heroLevels: [5, 5, 4] },
  ]),
  tier(5, 5, 5, resources(54_000n, 40_000n, 33_000n, 25_000n), [
    { externalId: 'system-opponent:t5-sable-hart', displayName: 'Sable Hart', kingdomName: 'Darkgrove', trophies: 1_320, heroLevels: [5, 5, 5] },
    { externalId: 'system-opponent:t5-white-lion', displayName: 'White Lion', kingdomName: 'Snowcrown', trophies: 1_360, heroLevels: [5, 5, 6] },
    { externalId: 'raid-fixture:storm-keep', displayName: 'Storm Keep', kingdomName: 'Stormkeep', trophies: 1_400, heroLevels: [5, 6, 5] },
    { externalId: 'system-opponent:t5-gilded-wolf', displayName: 'Gilded Wolf', kingdomName: 'Goldbarrow', trophies: 1_440, heroLevels: [6, 5, 5] },
    { externalId: 'system-opponent:t5-oaken-bear', displayName: 'Oaken Bear', kingdomName: 'Deepwood', trophies: 1_480, heroLevels: [6, 6, 5] },
  ]),
  tier(6, 6, 5, resources(75_000n, 56_000n, 46_000n, 35_000n), [
    { externalId: 'system-opponent:t6-obsidian-crown', displayName: 'Obsidian Crown', kingdomName: 'Obsidian Reach', trophies: 1_460, heroLevels: [6, 6, 6] },
    { externalId: 'system-opponent:t6-thunder-stag', displayName: 'Thunder Stag', kingdomName: 'Thunderhall', trophies: 1_500, heroLevels: [6, 6, 7] },
    { externalId: 'system-opponent:t6-royal-griffin', displayName: 'Royal Griffin', kingdomName: 'Griffinspire', trophies: 1_540, heroLevels: [6, 7, 6] },
    { externalId: 'system-opponent:t6-steel-drake', displayName: 'Steel Drake', kingdomName: 'Drakefort', trophies: 1_580, heroLevels: [7, 6, 6] },
    { externalId: 'system-opponent:t6-sun-crown', displayName: 'Sun Crown', kingdomName: 'Highcrown', trophies: 1_620, heroLevels: [7, 7, 6] },
  ]),
] as const;

export interface ConfiguredSystemOpponent extends SystemOpponentDefinition {
  tier: SystemOpponentTier;
}

export const SYSTEM_OPPONENTS: readonly ConfiguredSystemOpponent[] = SYSTEM_OPPONENT_TIERS.flatMap(
  (configuredTier) => configuredTier.opponents.map((opponent) => ({ ...opponent, tier: configuredTier })),
);

export const SYSTEM_OPPONENT_EXTERNAL_IDS = SYSTEM_OPPONENTS.map((opponent) => opponent.externalId);
