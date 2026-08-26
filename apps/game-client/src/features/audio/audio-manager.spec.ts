import { describe, expect, it } from 'vitest';
import { DEFAULT_AUDIO_SETTINGS, MUSIC_TRACKS, normalizeAudioSettings, SFX_ASSETS } from './audio-manager';

describe('audio settings and catalog', () => {
  it('defaults to enabled bounded buses and clamps persisted volumes', () => {
    expect(normalizeAudioSettings(null)).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(normalizeAudioSettings({ masterEnabled: false, masterVolume: 4, musicVolume: -2, sfxVolume: Number.NaN }))
      .toMatchObject({ masterEnabled: false, masterVolume: 1, musicVolume: 0, sfxVolume: 0.5 });
  });

  it('routes two local music contexts and every required local SFX', () => {
    expect(Object.keys(MUSIC_TRACKS)).toEqual(['KINGDOM', 'BATTLE']);
    expect(Object.values(MUSIC_TRACKS).every((path) => path.startsWith('/assets/audio/') && path.endsWith('.mp3'))).toBe(true);
    expect(Object.keys(SFX_ASSETS)).toEqual(expect.arrayContaining([
      'ui_tap', 'panel_open', 'back', 'collect', 'upgrade_start', 'upgrade_complete', 'building_select',
      'hero_select', 'hero_upgrade', 'find_enemy', 'attack_start', 'sword_hit', 'arrow_shot', 'arrow_impact',
      'magic_cast', 'magic_impact', 'shield_wall', 'hero_defeated', 'victory', 'defeat', 'incoming_attack', 'revenge_available',
    ]));
  });
});
