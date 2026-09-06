export const GUILD_WAR_ATTACKS_PER_PLAYER = 2;
export const GUILD_WAR_DEFAULT_SIZE = 5;
export const GUILD_WAR_PREP_DURATION_MS = 12 * 60 * 60 * 1000;
export const GUILD_WAR_BATTLE_DURATION_MS = 24 * 60 * 60 * 1000;
export const GUILD_WAR_WIN_SPOILS_GOLD = '50000';
export const GUILD_WAR_LOSE_SPOILS_GOLD = '15000';
export const GUILD_WAR_STAR_BONUS_GOLD = '5000';
export const GUILD_WAR_WIN_XP = 150;
export const GUILD_WAR_LOSE_XP = 40;

export const GUILD_LEVEL_THRESHOLDS = [0, 250, 600, 1100, 1800, 2700, 3800, 5100, 6600, 8500];

export function calculateGuildLevel(xp: number): { level: number; currentXp: number; nextLevelXp: number } {
  let level = 1;
  for (let i = 0; i < GUILD_LEVEL_THRESHOLDS.length; i++) {
    if (xp >= GUILD_LEVEL_THRESHOLDS[i]) {
      level = i + 1;
    } else {
      break;
    }
  }
  const nextLevelXp = GUILD_LEVEL_THRESHOLDS[level] ?? GUILD_LEVEL_THRESHOLDS[GUILD_LEVEL_THRESHOLDS.length - 1];
  return { level, currentXp: xp, nextLevelXp };
}

export const SYSTEM_RIVAL_CLANS = [
  { name: 'Crimson Eclipse', tag: '#CRX888', motto: 'Eclipse the sun with arrows.', emblem: 'fire', primaryColor: '#b91c1c', secondaryColor: '#450a0a' },
  { name: 'Shadowfang Clan', tag: '#SFG555', motto: 'From the gloom we strike.', emblem: 'wolf', primaryColor: '#334155', secondaryColor: '#0f172a' },
  { name: 'Valiant Order', tag: '#VLT222', motto: 'Virtue through unyielding steel.', emblem: 'crown', primaryColor: '#d97706', secondaryColor: '#78350f' },
  { name: 'Frostguard Keep', tag: '#FRZ111', motto: 'Cold as the mountain peak.', emblem: 'shield', primaryColor: '#0284c7', secondaryColor: '#0c4a6e' },
  { name: 'Dragon Legion', tag: '#DRG999', motto: 'Wings of ash, claws of fire.', emblem: 'dragon', primaryColor: '#ea580c', secondaryColor: '#7c2d12' },
];
