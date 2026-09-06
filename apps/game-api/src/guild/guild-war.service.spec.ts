import { describe, expect, it } from 'vitest';
import {
  calculateGuildLevel,
  GUILD_WAR_ATTACKS_PER_PLAYER,
  GUILD_WAR_DEFAULT_SIZE,
  GUILD_WAR_WIN_SPOILS_GOLD,
  SYSTEM_RIVAL_CLANS,
} from './guild-war.config';

describe('Guild War Config & Progression', () => {
  it('starts at level 1 with 0 XP', () => {
    const levelInfo = calculateGuildLevel(0);
    expect(levelInfo.level).toBe(1);
    expect(levelInfo.currentXp).toBe(0);
    expect(levelInfo.nextLevelXp).toBe(250);
  });

  it('correctly calculates higher guild levels from XP', () => {
    expect(calculateGuildLevel(100).level).toBe(1);
    expect(calculateGuildLevel(250).level).toBe(2);
    expect(calculateGuildLevel(600).level).toBe(3);
    expect(calculateGuildLevel(2000).level).toBe(5);
    expect(calculateGuildLevel(2700).level).toBe(6);
  });

  it('provides default war parameters', () => {
    expect(GUILD_WAR_ATTACKS_PER_PLAYER).toBe(2);
    expect(GUILD_WAR_DEFAULT_SIZE).toBe(5);
    expect(BigInt(GUILD_WAR_WIN_SPOILS_GOLD)).toBeGreaterThan(0n);
  });

  it('contains curated system rival clans with valid emblems', () => {
    expect(SYSTEM_RIVAL_CLANS.length).toBeGreaterThanOrEqual(3);
    for (const clan of SYSTEM_RIVAL_CLANS) {
      expect(clan.name).toBeTruthy();
      expect(clan.tag).toMatch(/^#[A-Z0-9]+$/);
      expect(clan.emblem).toBeTruthy();
    }
  });
});
