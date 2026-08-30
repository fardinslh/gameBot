import { describe, expect, it } from 'vitest';
import { en } from '../../i18n/messages/en';
import { fa } from '../../i18n/messages/fa';

describe('localized player experience content', () => {
  it('keeps the permanent Guide complete in English and Persian', () => {
    const expected = ['kingdom', 'resources', 'buildings', 'heroes', 'raid', 'trophies', 'shield', 'defense', 'campaign'];
    expect(Object.keys(en.experience.sections)).toEqual(expected);
    expect(Object.keys(fa.experience.sections)).toEqual(expected);
    expect(Object.values(fa.experience.sections).every((section) => section.title.length > 0 && section.body.length > 20)).toBe(true);
  });

  it('keeps the mandatory first session focused on Collect, Upgrade, and Raid', () => {
    expect(en.experience.advisor.collect).toContain('Collect');
    expect(en.experience.advisor.upgrade.toLowerCase()).toContain('upgrade');
    expect(en.experience.advisor.raid).toContain('Raid');
    expect(en.experience.advisor.welcome).not.toContain('Heroes');
  });

  it('localizes Aren and every mandatory or contextual counsel line', () => {
    const expected = ['name', 'role', 'guideRole', 'welcome', 'collect', 'upgrade', 'raid', 'findEnemy', 'attack', 'battle', 'result', 'complete', 'heroes', 'castle', 'shield', 'defense', 'revenge', 'campaign', 'reminder', 'gotIt'];
    expect(Object.keys(en.experience.advisor)).toEqual(expected);
    expect(Object.keys(fa.experience.advisor)).toEqual(expected);
    expect(fa.experience.advisor.name).toBe('آرِن');
    expect(Object.values(fa.experience.advisor).every((line) => line.length > 0)).toBe(true);
  });
});
