import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_AUDIO_SETTINGS, GameAudioManager, MUSIC_CONTEXT_FADE_SECONDS, MUSIC_TRACKS, normalizeAudioSettings, pickSfxAsset, SFX_ASSETS, validLoopPoints } from './audio-manager';

function webAudioHarness() {
  const sources: Array<{ start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; loop: boolean; onended: (() => void) | null }> = [];
  const gains: Array<{ value: number; setValueAtTime: ReturnType<typeof vi.fn>; linearRampToValueAtTime: ReturnType<typeof vi.fn>; setValueCurveAtTime: ReturnType<typeof vi.fn> }> = [];
  const context = {
    currentTime: 4, state: 'running', destination: {},
    resume: vi.fn(async () => undefined), suspend: vi.fn(async () => undefined), close: vi.fn(async () => undefined),
    decodeAudioData: vi.fn(async () => ({ duration: 200 })),
    createBufferSource: vi.fn(() => {
      const source = { buffer: null, loop: false, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null as (() => void) | null };
      sources.push(source);
      return source;
    }),
    createGain: vi.fn(() => {
      const gainParam = {
        value: 1,
        setValueAtTime: vi.fn((value: number) => { gainParam.value = value; }),
        linearRampToValueAtTime: vi.fn(), setValueCurveAtTime: vi.fn(), cancelScheduledValues: vi.fn(),
      };
      gains.push(gainParam);
      return { gain: gainParam, connect: vi.fn(), disconnect: vi.fn() };
    }),
  };
  const fetch = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) }));
  return { context, fetch, gains, sources };
}

describe('audio settings and catalog', () => {
  it('defaults to enabled bounded buses and clamps persisted volumes', () => {
    expect(normalizeAudioSettings(null)).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(normalizeAudioSettings({ masterEnabled: false, masterVolume: 4, musicVolume: -2, sfxVolume: Number.NaN })).toMatchObject({ masterEnabled: false, masterVolume: 1, musicVolume: 0, sfxVolume: 0.5 });
  });
  it('centralizes approved clean-source loop metadata and SFX', () => {
    expect(MUSIC_TRACKS.KINGDOM).toMatchObject({ src: '/assets/audio/approved/music/kingdom.mp3', loopStart: 0, loopEnd: 49.951383, crossfadeSeconds: 3.5 });
    expect(MUSIC_TRACKS.BATTLE).toMatchObject({ src: '/assets/audio/approved/music/battle.mp3', loopStart: 0, loopEnd: 108, crossfadeSeconds: 2.5 });
    expect(Object.values(MUSIC_TRACKS).every((track) => validLoopPoints(track, track.loopEnd))).toBe(true);
    expect(Object.keys(SFX_ASSETS)).toHaveLength(22);
    expect(Object.values(SFX_ASSETS).every((assets) => assets.length === 1 && assets[0].startsWith('/assets/audio/approved/'))).toBe(true);
  });
  it('keeps approved single-asset SFX selection stable', () => { expect(pickSfxAsset('sword_hit', undefined, () => 0)).toBe('/assets/audio/approved/sfx/sword-hit.mp3'); });
});

describe('Web Audio music lifecycle', () => {
  it('starts one audible instance, one future overlap, and never uses native looping', async () => {
    const h = webAudioHarness();
    const manager = new GameAudioManager({ createContext: () => h.context as unknown as AudioContext, fetch: h.fetch as unknown as typeof fetch });
    await manager.unlock();
    expect(h.sources).toHaveLength(2);
    expect(h.sources[0].start).toHaveBeenCalledWith(4, 0, MUSIC_TRACKS.KINGDOM.loopEnd);
    expect(h.sources[1].start).toHaveBeenCalledWith(4 + MUSIC_TRACKS.KINGDOM.loopEnd - MUSIC_TRACKS.KINGDOM.crossfadeSeconds, 0, MUSIC_TRACKS.KINGDOM.loopEnd);
    expect(h.sources.every((source) => source.loop === false)).toBe(true);
  });

  it('does not recreate music for same context, rerenders, volume, mute, or unmute', async () => {
    const h = webAudioHarness();
    const manager = new GameAudioManager({ createContext: () => h.context as unknown as AudioContext, fetch: h.fetch as unknown as typeof fetch });
    await manager.unlock(); manager.setContext('KINGDOM'); manager.setSettings({ ...DEFAULT_AUDIO_SETTINGS, musicVolume: 0.2 });
    manager.setSettings({ ...DEFAULT_AUDIO_SETTINGS, masterEnabled: false }); manager.setSettings(DEFAULT_AUDIO_SETTINGS);
    await vi.waitFor(() => expect(h.sources).toHaveLength(2));
    expect(h.gains[0].setValueAtTime.mock.calls.some(([value]) => value === 0)).toBe(true);
    expect(h.gains[0].setValueAtTime.mock.calls.some(([value]) => Math.abs(Number(value) - 0.336) < 0.0001)).toBe(true);
  });

  it('changes shared music bus volume without overwriting loop fade curves', async () => {
    const h = webAudioHarness();
    const manager = new GameAudioManager({ createContext: () => h.context as unknown as AudioContext, fetch: h.fetch as unknown as typeof fetch });
    await manager.unlock();
    const fadeCurveCalls = h.gains.slice(2).map((gain) => gain.setValueCurveAtTime.mock.calls.length);
    manager.setSettings({ ...DEFAULT_AUDIO_SETTINGS, musicVolume: 0.25 });
    expect(h.gains.slice(2).map((gain) => gain.setValueCurveAtTime.mock.calls.length)).toEqual(fadeCurveCalls);
    expect(h.gains[0].setValueAtTime).toHaveBeenLastCalledWith(0.2, 4);
  });

  it('context change cancels all old scheduled sources and starts new context once', async () => {
    const h = webAudioHarness();
    const manager = new GameAudioManager({ createContext: () => h.context as unknown as AudioContext, fetch: h.fetch as unknown as typeof fetch });
    await manager.unlock(); manager.setContext('BATTLE'); await vi.waitFor(() => expect(h.sources).toHaveLength(4));
    for (const source of h.sources.slice(0, 2)) expect(source.stop.mock.calls.some(([time]) => time === 4 + MUSIC_CONTEXT_FADE_SECONDS)).toBe(true);
    manager.setContext('BATTLE'); await Promise.resolve(); expect(h.sources).toHaveLength(4);
  });

  it('suspends and resumes without duplicate schedules', async () => {
    const h = webAudioHarness();
    const manager = new GameAudioManager({ createContext: () => h.context as unknown as AudioContext, fetch: h.fetch as unknown as typeof fetch });
    await manager.unlock(); manager.suspend(); manager.resume(); await vi.waitFor(() => expect(h.context.resume).toHaveBeenCalled());
    expect(h.context.suspend).toHaveBeenCalledTimes(1); expect(h.sources).toHaveLength(2);
  });

  it('uses production scheduler for short Kingdom boundary preview', async () => {
    const h = webAudioHarness();
    const manager = new GameAudioManager({ createContext: () => h.context as unknown as AudioContext, fetch: h.fetch as unknown as typeof fetch });
    await manager.previewLoopBoundary('KINGDOM');
    expect(h.sources[0].start).toHaveBeenCalledWith(4, MUSIC_TRACKS.KINGDOM.loopEnd - 8, 8);
    expect(h.sources[1].start.mock.calls[0][0]).toBeCloseTo(4 + 8 - MUSIC_TRACKS.KINGDOM.crossfadeSeconds);
  });

  it('destroy cancels all scheduled sources and closes context', async () => {
    const h = webAudioHarness();
    const manager = new GameAudioManager({ createContext: () => h.context as unknown as AudioContext, fetch: h.fetch as unknown as typeof fetch });
    await manager.unlock(); manager.destroy();
    expect(h.sources.every((source) => source.stop.mock.calls.some(([time]) => time === 4))).toBe(true);
    expect(h.context.close).toHaveBeenCalledTimes(1);
  });

  it('falls back safely to one HTMLAudio source when Web Audio fails', async () => {
    const audios: Array<{ dataset: DOMStringMap; paused: boolean; pause: ReturnType<typeof vi.fn>; play: ReturnType<typeof vi.fn> }> = [];
    const manager = new GameAudioManager({ createContext: () => { throw new Error('unsupported'); }, createAudio: (src) => { const audio = { dataset: { source: '' } as DOMStringMap, paused: false, pause: vi.fn(), play: vi.fn(async () => undefined), loop: false, preload: '', volume: 0, src }; audios.push(audio); return audio as unknown as HTMLAudioElement; } });
    await manager.unlock(); manager.setContext('KINGDOM'); expect(audios).toHaveLength(1);
    manager.setContext('BATTLE'); await vi.waitFor(() => expect(audios).toHaveLength(2)); expect(audios[0].pause).toHaveBeenCalledTimes(1);
  });
});
