import type { TroopType } from '@crown-and-coin/shared';

export const GUILD_CREATE_COST_GOLD = '2500';
export const GUILD_MAX_MEMBERS = 50;
export const GUILD_REQUEST_MAX_TROOPS = 10;
export const GUILD_REQUEST_COOLDOWN_MS = 4 * 60 * 60 * 1000;
export const GUILD_REQUEST_EXPIRES_MS = 8 * 60 * 60 * 1000;

export const TROOP_DONATION_REWARDS: Record<TroopType, { xp: number; gold: string }> = {
  INFANTRY: { xp: 5, gold: '100' },
  ARCHER: { xp: 6, gold: '120' },
  CAVALRY: { xp: 12, gold: '250' },
};

/**
 * Calculates total guild score using standard competitive mobile clan formula:
 * Rank 1-10: 50% of trophies
 * Rank 11-20: 25% of trophies
 * Rank 21-30: 12% of trophies
 * Rank 31-40: 8% of trophies
 * Rank 41-50: 5% of trophies
 */
export function calculateGuildScore(memberTrophies: number[]): number {
  if (!memberTrophies.length) return 0;
  const sorted = [...memberTrophies].sort((a, b) => b - a);
  let totalScore = 0;

  for (let i = 0; i < sorted.length; i++) {
    const trophies = sorted[i];
    if (i < 10) {
      totalScore += trophies * 0.50;
    } else if (i < 20) {
      totalScore += trophies * 0.25;
    } else if (i < 30) {
      totalScore += trophies * 0.12;
    } else if (i < 40) {
      totalScore += trophies * 0.08;
    } else if (i < 50) {
      totalScore += trophies * 0.05;
    }
  }

  return Math.round(totalScore);
}

export function generateGuildTag(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `#${code}`;
}
