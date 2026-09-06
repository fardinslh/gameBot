import { describe, expect, it } from 'vitest';
import { calculateGuildScore, generateGuildTag } from './guild.config';

describe('Guild Config & Calculations', () => {
  it('returns 0 for empty member trophies', () => {
    expect(calculateGuildScore([])).toBe(0);
  });

  it('weights top 10 member trophies at 50%', () => {
    const trophies = [1000];
    expect(calculateGuildScore(trophies)).toBe(500);

    const tenMembers = Array(10).fill(1000);
    expect(calculateGuildScore(tenMembers)).toBe(5000);
  });

  it('correctly calculates weighted score across all tiers', () => {
    // 10 members @ 2000 => 10 * 2000 * 0.50 = 10,000
    // 10 members @ 1000 => 10 * 1000 * 0.25 = 2,500
    // 10 members @ 500  => 10 * 500 * 0.12  = 600
    // total = 13,100
    const members = [
      ...Array(10).fill(2000),
      ...Array(10).fill(1000),
      ...Array(10).fill(500),
    ];
    expect(calculateGuildScore(members)).toBe(13100);
  });

  it('generates valid 6-char guild tag prefixed with #', () => {
    const tag = generateGuildTag();
    expect(tag).toMatch(/^#[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
  });
});
