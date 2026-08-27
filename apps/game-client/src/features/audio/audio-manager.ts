import { CrossfadeLoopPlayer } from './crossfade-loop-player';

export type MusicContext = 'KINGDOM' | 'BATTLE';
export type SfxKey =
  | 'ui_tap' | 'panel_open' | 'back' | 'collect' | 'upgrade_start' | 'upgrade_complete' | 'building_select'
  | 'hero_select' | 'hero_upgrade' | 'find_enemy' | 'attack_start' | 'sword_hit' | 'arrow_shot' | 'arrow_impact'
  | 'magic_cast' | 'magic_impact' | 'shield_wall' | 'hero_defeated' | 'victory' | 'defeat'
  | 'incoming_attack' | 'revenge_available';

export interface AudioSettings {
  masterEnabled: boolean; musicEnabled: boolean; sfxEnabled: boolean;
  masterVolume: number; musicVolume: number; sfxVolume: number;
}

export interface MusicTrackConfig {
  src: string; loopStart: number; loopEnd: number; sourceDuration: number; crossfadeSeconds: number;
}

interface PlayingMusic { context: MusicContext; player: CrossfadeLoopPlayer; }
interface AudioDependencies {
  createContext(): AudioContext;
  fetch(input: RequestInfo | URL): Promise<Response>;
  createAudio(src: string): HTMLAudioElement;
}

export const AUDIO_STORAGE_KEY = 'crown-coin-audio-v1';
export const MUSIC_CONTEXT_FADE_SECONDS = 0.6;
export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  masterEnabled: true, musicEnabled: true, sfxEnabled: true,
  masterVolume: 0.8, musicVolume: 0.42, sfxVolume: 0.72,
};

export const MUSIC_TRACKS: Record<MusicContext, MusicTrackConfig> = {
  KINGDOM: { src: '/assets/audio/approved/music/kingdom.mp3', loopStart: 0, loopEnd: 49.951383, sourceDuration: 49.951383, crossfadeSeconds: 3.5 },
  BATTLE: { src: '/assets/audio/approved/music/battle.mp3', loopStart: 0, loopEnd: 108, sourceDuration: 108, crossfadeSeconds: 2.5 },
};

export const SFX_ASSETS: Record<SfxKey, readonly string[]> = {
  ui_tap: ['/assets/audio/approved/sfx/ui-tap.mp3'], panel_open: ['/assets/audio/approved/sfx/panel-open.mp3'], back: ['/assets/audio/approved/sfx/back.mp3'],
  collect: ['/assets/audio/approved/sfx/collect.mp3'], upgrade_start: ['/assets/audio/approved/sfx/upgrade-start.mp3'], upgrade_complete: ['/assets/audio/approved/sfx/upgrade-complete.mp3'],
  building_select: ['/assets/audio/approved/sfx/building-select.mp3'], hero_select: ['/assets/audio/approved/sfx/hero-select.mp3'], hero_upgrade: ['/assets/audio/approved/sfx/hero-upgrade.mp3'],
  find_enemy: ['/assets/audio/approved/sfx/find-enemy.mp3'], attack_start: ['/assets/audio/approved/sfx/attack-start.mp3'], sword_hit: ['/assets/audio/approved/sfx/sword-hit.mp3'],
  arrow_shot: ['/assets/audio/approved/sfx/arrow-shot.mp3'], arrow_impact: ['/assets/audio/approved/sfx/arrow-impact.mp3'], magic_cast: ['/assets/audio/approved/sfx/magic-cast.mp3'],
  magic_impact: ['/assets/audio/approved/sfx/magic-impact.mp3'], shield_wall: ['/assets/audio/approved/sfx/shield-wall.mp3'], hero_defeated: ['/assets/audio/approved/sfx/hero-defeated.mp3'],
  victory: ['/assets/audio/approved/sfx/victory.mp3'], defeat: ['/assets/audio/approved/sfx/defeat.mp3'], incoming_attack: ['/assets/audio/approved/sfx/incoming-attack.mp3'],
  revenge_available: ['/assets/audio/approved/sfx/revenge-available.mp3'],
};

export function pickSfxAsset(key: SfxKey, previous?: string, random = Math.random): string | undefined {
  const assets = SFX_ASSETS[key];
  if (assets.length === 0) return undefined;
  if (assets.length === 1) return assets[0];
  const alternatives = previous ? assets.filter((asset) => asset !== previous) : assets;
  return alternatives[Math.min(alternatives.length - 1, Math.floor(random() * alternatives.length))];
}

export function normalizeAudioSettings(value: unknown): AudioSettings {
  if (!value || typeof value !== 'object') return DEFAULT_AUDIO_SETTINGS;
  const input = value as Partial<AudioSettings>;
  return {
    masterEnabled: input.masterEnabled ?? true, musicEnabled: input.musicEnabled ?? true, sfxEnabled: input.sfxEnabled ?? true,
    masterVolume: clamp(input.masterVolume ?? DEFAULT_AUDIO_SETTINGS.masterVolume),
    musicVolume: clamp(input.musicVolume ?? DEFAULT_AUDIO_SETTINGS.musicVolume),
    sfxVolume: clamp(input.sfxVolume ?? DEFAULT_AUDIO_SETTINGS.sfxVolume),
  };
}

export function validLoopPoints(track: MusicTrackConfig, decodedDuration: number): boolean {
  return track.loopStart >= 0 && track.loopStart < track.loopEnd && track.loopEnd <= decodedDuration;
}

function clamp(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.5;
}

export class GameAudioManager {
  private settings = DEFAULT_AUDIO_SETTINGS;
  private context: MusicContext = 'KINGDOM';
  private webContext: AudioContext | null = null;
  private musicBus: GainNode | null = null;
  private currentMusic: PlayingMusic | null = null;
  private fallbackMusic: HTMLAudioElement | null = null;
  private readonly buffers = new Map<MusicContext, AudioBuffer>();
  private pending: Promise<void> | null = null;
  private pendingContext: MusicContext | null = null;
  private unlocked = false;
  private suspended = false;
  private transitionVersion = 0;
  private webAudioFailed = false;
  private readonly failedAssets = new Set<string>();
  private readonly lastSfx = new Map<SfxKey, string>();
  private readonly dependencies: AudioDependencies;

  constructor(dependencies: Partial<AudioDependencies> = {}) {
    this.dependencies = {
      createContext: dependencies.createContext ?? (() => {
        const Constructor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Constructor) throw new Error('Web Audio unavailable');
        return new Constructor();
      }),
      fetch: dependencies.fetch ?? ((input) => window.fetch(input)),
      createAudio: dependencies.createAudio ?? ((src) => new Audio(src)),
    };
  }

  setSettings(settings: AudioSettings): void {
    this.settings = normalizeAudioSettings(settings);
    if (!this.musicAllowed()) this.pauseMusic();
    else if (this.unlocked && !this.suspended) void this.ensureMusic();
    this.applyMusicVolume();
  }

  setContext(context: MusicContext): void {
    if (this.context === context) return;
    this.context = context;
    this.transitionVersion += 1;
    if (this.unlocked && !this.suspended && this.musicAllowed()) void this.ensureMusic();
  }

  async unlock(): Promise<void> {
    if (this.unlocked) return;
    this.unlocked = true;
    if (this.musicAllowed() && !this.suspended) await this.ensureMusic();
  }

  async previewLoopBoundary(context: MusicContext): Promise<void> {
    this.unlocked = true;
    this.context = context;
    this.transitionVersion += 1;
    const version = this.transitionVersion;
    await this.startWebMusic(context, version, true);
  }

  stopMusic(): void {
    this.transitionVersion += 1;
    this.stopCurrent();
    this.fallbackMusic?.pause();
    this.fallbackMusic = null;
  }

  playSfx(key: SfxKey): void {
    if (!this.unlocked || this.suspended || !this.settings.masterEnabled || !this.settings.sfxEnabled) return;
    const source = pickSfxAsset(key, this.lastSfx.get(key));
    if (!source) return;
    this.lastSfx.set(key, source);
    const audio = this.dependencies.createAudio(source);
    audio.preload = 'none';
    audio.volume = this.settings.masterVolume * this.settings.sfxVolume;
    audio.play().catch(() => this.reportFailure(source));
  }

  suspend(): void {
    if (this.suspended) return;
    this.suspended = true;
    this.fallbackMusic?.pause();
    void this.webContext?.suspend();
  }

  resume(): void {
    if (!this.suspended) return;
    this.suspended = false;
    if (!this.unlocked || !this.musicAllowed()) return;
    if (this.webContext) void this.webContext.resume().then(() => this.ensureMusic());
    else void this.ensureMusic();
  }

  destroy(): void {
    this.transitionVersion += 1;
    this.stopCurrent();
    this.fallbackMusic?.pause();
    this.fallbackMusic = null;
    void this.webContext?.close();
    this.webContext = null;
    this.musicBus = null;
    this.buffers.clear();
  }

  private musicAllowed(): boolean { return this.settings.masterEnabled && this.settings.musicEnabled; }

  private ensureMusic(): Promise<void> {
    if (this.currentMusic?.context === this.context || this.fallbackMusic?.dataset.source === MUSIC_TRACKS[this.context].src) {
      this.applyMusicVolume();
      if (this.fallbackMusic?.paused) void this.fallbackMusic.play().catch(() => undefined);
      if (this.currentMusic && this.webContext?.state === 'suspended' && !this.suspended) return this.webContext.resume().then(() => undefined);
      return Promise.resolve();
    }
    if (this.pending && this.pendingContext === this.context) return this.pending;
    const requested = this.context;
    const version = this.transitionVersion;
    this.pendingContext = requested;
    this.pending = this.startWebMusic(requested, version).catch(() => {
      this.webAudioFailed = true;
      return this.startFallback(requested, version);
    }).finally(() => {
      if (this.pendingContext === requested) { this.pending = null; this.pendingContext = null; }
    });
    return this.pending;
  }

  private async startWebMusic(context: MusicContext, version: number, previewBoundary = false): Promise<void> {
    if (this.webAudioFailed) throw new Error('Web Audio disabled after initialization failure');
    const audioContext = this.webContext ?? this.dependencies.createContext();
    this.webContext = audioContext;
    if (!this.musicBus) {
      this.musicBus = audioContext.createGain();
      this.musicBus.connect(audioContext.destination);
      this.musicBus.gain.setValueAtTime(this.musicVolume(), audioContext.currentTime);
    }
    if (audioContext.state === 'suspended') await audioContext.resume();
    let buffer = this.buffers.get(context);
    if (!buffer) {
      const response = await this.dependencies.fetch(MUSIC_TRACKS[context].src);
      if (!response.ok) throw new Error(`Music request failed (${response.status})`);
      buffer = await audioContext.decodeAudioData(await response.arrayBuffer());
      this.buffers.set(context, buffer);
    }
    if (version !== this.transitionVersion || context !== this.context || this.suspended || !this.musicAllowed()) return;
    const track = MUSIC_TRACKS[context];
    const decodedTrack = { ...track, loopEnd: Math.min(track.loopEnd, buffer.duration) };
    if (!validLoopPoints(decodedTrack, buffer.duration)) throw new Error('Music loop metadata is outside decoded duration');
    const now = audioContext.currentTime;
    const player = new CrossfadeLoopPlayer(audioContext, buffer, decodedTrack, this.musicBus);
    player.setOutputGain(0, now);
    const previewOffset = Math.max(decodedTrack.loopStart, decodedTrack.loopEnd - 8);
    player.start(previewBoundary ? { when: now, offset: previewOffset, stopAfterSeconds: decodedTrack.loopEnd - previewOffset + 8 } : { when: now });
    player.setOutputGain(1, now, MUSIC_CONTEXT_FADE_SECONDS);
    const previous = this.currentMusic;
    this.currentMusic = { context, player };
    if (previous) {
      previous.player.fadeOutAndStop(now, MUSIC_CONTEXT_FADE_SECONDS);
    }
    this.fallbackMusic?.pause(); this.fallbackMusic = null;
  }

  private async startFallback(context: MusicContext, version: number): Promise<void> {
    const track = MUSIC_TRACKS[context];
    const next = this.dependencies.createAudio(track.src);
    next.dataset.source = track.src; next.loop = true; next.preload = 'auto'; next.volume = this.musicVolume();
    try { await next.play(); } catch { this.reportFailure(track.src); return; }
    if (version !== this.transitionVersion || context !== this.context || this.suspended || !this.musicAllowed()) { next.pause(); return; }
    this.fallbackMusic?.pause(); this.stopCurrent(); this.fallbackMusic = next;
  }

  private pauseMusic(): void {
    this.fallbackMusic?.pause();
    this.applyMusicVolume();
  }

  private applyMusicVolume(): void {
    const volume = this.musicVolume();
    if (this.fallbackMusic) this.fallbackMusic.volume = volume;
    if (this.musicBus && this.webContext) {
      this.musicBus.gain.cancelScheduledValues(this.webContext.currentTime);
      this.musicBus.gain.setValueAtTime(volume, this.webContext.currentTime);
    }
  }

  private musicVolume(): number { return this.musicAllowed() ? this.settings.masterVolume * this.settings.musicVolume : 0; }
  private stopCurrent(): void {
    if (!this.currentMusic) return;
    this.currentMusic.player.stop(); this.currentMusic = null;
  }
  private reportFailure(source: string): void {
    if (this.failedAssets.has(source)) return;
    this.failedAssets.add(source); console.warn(`Audio asset unavailable: ${source}`);
  }
}
