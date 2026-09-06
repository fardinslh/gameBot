import type {
  GuildPerkDefinition,
  GuildPerkType,
} from '@crown-and-coin/shared';

export const GUILD_LEVEL_XP_THRESHOLDS: number[] = [
  0,      // Level 1
  500,    // Level 2
  1500,   // Level 3
  3500,   // Level 4
  7000,   // Level 5
  12000,  // Level 6
  19000,  // Level 7
  28000,  // Level 8
  40000,  // Level 9
  55000,  // Level 10
];

export const MAX_GUILD_LEVEL = GUILD_LEVEL_XP_THRESHOLDS.length;

export const GUILD_TREASURY_DEFAULT_CAPACITY = '5000000'; // 5,000,000 Gold
export const MIN_TREASURY_DONATION_GOLD = 100;
export const GUILD_XP_PER_GOLD_DONATION = 100; // 1 XP per 100 Gold donated
export const GUILD_XP_PER_TROOP_DONATION = 15; // 15 XP per donated unit
export const GUILD_XP_PER_WAR_STAR = 50; // 50 XP per star
export const GUILD_XP_WAR_VICTORY = 600;
export const GUILD_XP_WAR_DRAW = 300;
export const GUILD_XP_WAR_DEFEAT = 150;

export interface GuildLevelProgression {
  level: number;
  currentXp: number;
  nextLevelXp: number;
  xpInCurrentLevel: number;
  xpNeededForNextLevel: number;
  progressPct: number;
}

export function calculateGuildLevelProgression(totalXp: number): GuildLevelProgression {
  const safeXp = Math.max(0, totalXp);
  let currentLevel = 1;

  for (let i = 0; i < GUILD_LEVEL_XP_THRESHOLDS.length; i++) {
    if (safeXp >= GUILD_LEVEL_XP_THRESHOLDS[i]) {
      currentLevel = i + 1;
    } else {
      break;
    }
  }

  const isMax = currentLevel >= MAX_GUILD_LEVEL;
  const currentLevelMinXp = GUILD_LEVEL_XP_THRESHOLDS[currentLevel - 1];
  const nextLevelMinXp = isMax
    ? GUILD_LEVEL_XP_THRESHOLDS[GUILD_LEVEL_XP_THRESHOLDS.length - 1]
    : GUILD_LEVEL_XP_THRESHOLDS[currentLevel];

  const xpInCurrentLevel = safeXp - currentLevelMinXp;
  const xpNeededForNextLevel = isMax ? 0 : nextLevelMinXp - currentLevelMinXp;
  const progressPct = isMax
    ? 100
    : Math.min(100, Math.round((xpInCurrentLevel / xpNeededForNextLevel) * 100));

  return {
    level: currentLevel,
    currentXp: safeXp,
    nextLevelXp: nextLevelMinXp,
    xpInCurrentLevel,
    xpNeededForNextLevel,
    progressPct,
  };
}

export const GUILD_PERK_DEFINITIONS: Record<GuildPerkType, GuildPerkDefinition> = {
  GOLD_BOOST: {
    type: 'GOLD_BOOST',
    name: 'Royal Mint',
    maxLevel: 3,
    levels: [
      {
        level: 1,
        requiredGuildLevel: 1,
        costTreasuryGold: '5000',
        bonusValue: 5,
        description: '+5% Kingdom Gold Production',
      },
      {
        level: 2,
        requiredGuildLevel: 3,
        costTreasuryGold: '20000',
        bonusValue: 10,
        description: '+10% Kingdom Gold Production',
      },
      {
        level: 3,
        requiredGuildLevel: 6,
        costTreasuryGold: '60000',
        bonusValue: 15,
        description: '+15% Kingdom Gold Production',
      },
    ],
  },
  DONATION_CAPACITY: {
    type: 'DONATION_CAPACITY',
    name: 'Expanded Garrison',
    maxLevel: 3,
    levels: [
      {
        level: 1,
        requiredGuildLevel: 2,
        costTreasuryGold: '10000',
        bonusValue: 2,
        description: '+2 Reinforcement Troops Request Capacity',
      },
      {
        level: 2,
        requiredGuildLevel: 4,
        costTreasuryGold: '30000',
        bonusValue: 4,
        description: '+4 Reinforcement Troops Request Capacity',
      },
      {
        level: 3,
        requiredGuildLevel: 7,
        costTreasuryGold: '75000',
        bonusValue: 6,
        description: '+6 Reinforcement Troops Request Capacity',
      },
    ],
  },
  WAR_LOOT_BONUS: {
    type: 'WAR_LOOT_BONUS',
    name: 'War Plunder',
    maxLevel: 3,
    levels: [
      {
        level: 1,
        requiredGuildLevel: 2,
        costTreasuryGold: '10000',
        bonusValue: 10,
        description: '+10% War Spoils Gold Bonus',
      },
      {
        level: 2,
        requiredGuildLevel: 5,
        costTreasuryGold: '40000',
        bonusValue: 20,
        description: '+20% War Spoils Gold Bonus',
      },
      {
        level: 3,
        requiredGuildLevel: 8,
        costTreasuryGold: '90000',
        bonusValue: 30,
        description: '+30% War Spoils Gold Bonus',
      },
    ],
  },
  TROOP_TRAINING_SPEED: {
    type: 'TROOP_TRAINING_SPEED',
    name: 'Master Drillmaster',
    maxLevel: 3,
    levels: [
      {
        level: 1,
        requiredGuildLevel: 3,
        costTreasuryGold: '15000',
        bonusValue: 10,
        description: '+10% Faster Troop Training Speed',
      },
      {
        level: 2,
        requiredGuildLevel: 6,
        costTreasuryGold: '50000',
        bonusValue: 20,
        description: '+20% Faster Troop Training Speed',
      },
      {
        level: 3,
        requiredGuildLevel: 9,
        costTreasuryGold: '120000',
        bonusValue: 30,
        description: '+30% Faster Troop Training Speed',
      },
    ],
  },
};
