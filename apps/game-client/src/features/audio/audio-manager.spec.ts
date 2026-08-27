import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_AUDIO_SETTINGS, GameAudioManager, MUSIC_CONTEXT_FADE_SECONDS, MUSIC_TRACKS, normalizeAudioSettings, pickSfxAsset, SFX_ASSETS, validLoopPoints } from './audio-manager';

function webAudioHarness() {
  const sources: Array<{ start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; loop: boolean; loopStart: number; loopEnd: number }> = [];
  const gains: Array<{ value: number; setValueAtTime: ReturnType<typeof vi.fn>; linearRampToValueAtTime: ReturnType<typeof vi.fn> }> = [];
  const context = {
    currentTime: 4, state: 'running', destination: {},
    resume: vi.fn(async () => undefined), suspend: vi.fn(async () => undefined), close: vi.fn(async () => undefined),
    decodeAudioData: vi.fn(async () => ({ duration: 200 })),
    createBufferSource: vi.fn(() => { const source = { buffer: null, loop: false, loopStart: 0, loopEnd: 0, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() }; sources.push(source); return source; }),
    createGain: vi.fn(() => { const gainParam = { value: 0.336, setValueAtTime: vi.fn((value: number) => { gainParam.value = value; }), linearRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() }; gains.push(gainParam); return { gain: gainParam, connect: vi.fn(), disconnect: vi.fn() }; }),
  };
  const fetch = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) }));
  return { context, fetch, gains, sources };
}

describe('audio settings and catalog', () => {
  it('defaults to enabled bounded buses and clamps persisted volumes', () => {
    expect(normalizeAudioSettings(null)).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(normalizeAudioSettings({ masterEnabled: false, masterVolume: 4, musicVolume: -2, sfxVolume: Number.NaN })).toMatchObject({ masterEnabled: false, masterVolume: 1, musicVolume: 0, sfxVolume: 0.5 });
  });
  it('centralizes local loop-ready music metadata and approved SFX', () => {
    expect(MUSIC_TRACKS.KINGDOM).toMatchObject({ src: '/assets/audio/approved/music/loop-ready/kingdom-loop.mp3', loopStart: 0, loopEnd: 47.451383 });
    expect(MUSIC_TRACKS.BATTLE).toMatchObject({ src: '/assets/audio/approved/music/loop-ready/battle-loop.mp3', loopStart: 0, loopEnd: 105.5 });
    expect(Object.values(MUSIC_TRACKS).every((track) => validLoopPoints(track, track.loopEnd))).toBe(true);
    expect(Object.keys(SFX_ASSETS)).toHaveLength(22);
    expect(Object.values(SFX_ASSETS).every((assets) => assets.length === 1 && assets[0].startsWith('/assets/audio/approved/'))).toBe(true);
  });
  it('keeps approved single-asset SFX selection stable', () => { expect(pickSfxAsset('sword_hit', undefined, () => 0)).toBe('/assets/audio/approved/sfx/sword-hit.mp3'); });
});

describe('Web Audio music lifecycle', () => {
  it('does not recreate music for the same context, rerender-equivalent settings, or volume changes', async () => {
    const h = webAudioHarness(); const manager = new GameAudioManager({ createContext: () => h.context as unknown as AudioContext, fetch: h.fetch as unknown as typeof fetch });
    await manager.unlock(); manager.setContext('KINGDOM'); manager.setSettings({ ...DEFAULT_AUDIO_SETTINGS, musicVolume: 0.2 });
    await vi.waitFor(() => expect(h.sources).toHaveLength(1));
    expect(h.gains[0].setValueAtTime.mock.calls.some(([value, time]) => Math.abs(Number(value) - 0.16) < 0.0001 && time === 4)).toBe(true);
  });
  it('performs one context crossfade and schedules the old source to stop', async () => {
    const h = webAudioHarness(); const manager = new GameAudioManager({ createContext: () => h.context as unknown as AudioContext, fetch: h.fetch as unknown as typeof fetch });
    await manager.unlock(); manager.setContext('BATTLE'); await vi.waitFor(() => expect(h.sources).toHaveLength(2));
    expect(h.sources[0].stop).toHaveBeenCalledTimes(1); expect(h.sources[0].stop).toHaveBeenCalledWith(4 + MUSIC_CONTEXT_FADE_SECONDS);
    expect(h.sources[1].loop).toBe(true); expect(h.sources[1].loopEnd).toBe(MUSIC_TRACKS.BATTLE.loopEnd);
    manager.setContext('BATTLE'); await Promise.resolve(); expect(h.sources).toHaveLength(2);
  });
  it('suspends and resumes the intended source without duplicating it', async () => {
    const h = webAudioHarness(); const manager = new GameAudioManager({ createContext: () => h.context as unknown as AudioContext, fetch: h.fetch as unknown as typeof fetch });
    await manager.unlock(); manager.suspend(); manager.resume(); await vi.waitFor(() => expect(h.context.resume).toHaveBeenCalled());
    expect(h.context.suspend).toHaveBeenCalledTimes(1); expect(h.sources).toHaveLength(1);
  });
  it('falls back safely to one HTMLAudio source when Web Audio fails', async () => {
    const audios: Array<{ dataset: DOMStringMap; paused: boolean; pause: ReturnType<typeof vi.fn>; play: ReturnType<typeof vi.fn> }> = [];
    const manager = new GameAudioManager({ createContext: () => { throw new Error('unsupported'); }, createAudio: (src) => { const audio = { dataset: { source: '' } as DOMStringMap, paused: false, pause: vi.fn(), play: vi.fn(async () => undefined), loop: false, preload: '', volume: 0, src }; audios.push(audio); return audio as unknown as HTMLAudioElement; } });
    await manager.unlock(); manager.setContext('KINGDOM'); expect(audios).toHaveLength(1);
    manager.setContext('BATTLE'); await vi.waitFor(() => expect(audios).toHaveLength(2)); expect(audios[0].pause).toHaveBeenCalledTimes(1);
  });
});
