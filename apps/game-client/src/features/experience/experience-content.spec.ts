import { describe, expect, it } from 'vitest';
import { en } from '../../i18n/messages/en';
import { fa } from '../../i18n/messages/fa';

describe('localized player experience content', () => {
  it('keeps the permanent Guide complete in English and Persian', () => {
    const expected = ['kingdom', 'resources', 'buildings', 'heroes', 'raid', 'trophies', 'shield', 'defense'];
    expect(Object.keys(en.experience.sections)).toEqual(expected);
    expect(Object.keys(fa.experience.sections)).toEqual(expected);
    expect(Object.values(fa.experience.sections).every((section) => section.title.length > 0 && section.body.length > 20)).toBe(true);
  });

  it('keeps the mandatory first session focused on Collect, Upgrade, and Raid', () => {
    expect(en.experience.collectBody).toContain('Collect');
    expect(en.experience.upgradeBody).toContain('upgrade');
    expect(en.experience.raidBody).toContain('Raid');
    expect(en.experience.welcomeBody).not.toContain('Heroes');
  });
});
