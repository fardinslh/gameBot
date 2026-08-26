export type MusicContext = 'KINGDOM' | 'BATTLE';
export type SfxKey =
  | 'ui_tap' | 'panel_open' | 'back'
  | 'collect' | 'upgrade_start' | 'upgrade_complete' | 'building_select'
  | 'hero_select' | 'hero_upgrade'
  | 'find_enemy' | 'attack_start'
  | 'sword_hit' | 'arrow_shot' | 'arrow_impact' | 'magic_cast' | 'magic_impact'
  | 'shield_wall' | 'hero_defeated' | 'victory' | 'defeat'
  | 'incoming_attack' | 'revenge_available';

export interface AudioSettings {
  masterEnabled: boolean;
  musicEnabled: boolean;
  sfxEnabled: boolean;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
}

export const AUDIO_STORAGE_KEY = 'crown-coin-audio-v1';
export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  masterEnabled: true,
  musicEnabled: true,
  sfxEnabled: true,
  masterVolume: 0.8,
  musicVolume: 0.42,
  sfxVolume: 0.72,
};

export const MUSIC_TRACKS: Record<MusicContext, string> = {
  KINGDOM: '/assets/audio/music/kingdom-hearth.mp3',
  BATTLE: '/assets/audio/music/battle-march.mp3',
};

export const SFX_ASSETS: Record<SfxKey, readonly string[]> = {
  ui_tap: ['/assets/audio/sfx/ui-tap.mp3'],
  panel_open: ['/assets/audio/sfx/panel-open.mp3'],
  back: ['/assets/audio/sfx/back.mp3'],
  collect: ['/assets/audio/sfx/collect.mp3'],
  upgrade_start: ['/assets/audio/sfx/upgrade-start.mp3'],
  upgrade_complete: ['/assets/audio/sfx/upgrade-complete.mp3'],
  building_select: ['/assets/audio/sfx/building-select.mp3'],
  hero_select: ['/assets/audio/sfx/hero-select.mp3'],
  hero_upgrade: ['/assets/audio/sfx/hero-upgrade.mp3'],
  find_enemy: ['/assets/audio/sfx/find-enemy.mp3'],
  attack_start: ['/assets/audio/sfx/attack-start.mp3'],
  sword_hit: ['/assets/audio/sfx/sword-hit.mp3'],
  arrow_shot: ['/assets/audio/sfx/arrow-shot.mp3'],
  arrow_impact: ['/assets/audio/sfx/arrow-impact.mp3'],
  magic_cast: ['/assets/audio/sfx/magic-cast.mp3'],
  magic_impact: ['/assets/audio/sfx/magic-impact.mp3'],
  shield_wall: ['/assets/audio/sfx/shield-wall.mp3'],
  hero_defeated: ['/assets/audio/sfx/hero-defeated.mp3'],
  victory: ['/assets/audio/sfx/victory.mp3'],
  defeat: ['/assets/audio/sfx/defeat.mp3'],
  incoming_attack: ['/assets/audio/sfx/incoming-attack.mp3'],
  revenge_available: ['/assets/audio/sfx/revenge-available.mp3'],
};

export function pickSfxAsset(key: SfxKey, previous?: string, random = Math.random): string {
  const assets = SFX_ASSETS[key];
  if (assets.length === 1) return assets[0];
  const alternatives = previous ? assets.filter((asset) => asset !== previous) : assets;
  return alternatives[Math.min(alternatives.length - 1, Math.floor(random() * alternatives.length))];
}

export function normalizeAudioSettings(value: unknown): AudioSettings {
  if (!value || typeof value !== 'object') return DEFAULT_AUDIO_SETTINGS;
  const input = value as Partial<AudioSettings>;
  return {
    masterEnabled: input.masterEnabled ?? true,
    musicEnabled: input.musicEnabled ?? true,
    sfxEnabled: input.sfxEnabled ?? true,
    masterVolume: clamp(input.masterVolume ?? DEFAULT_AUDIO_SETTINGS.masterVolume),
    musicVolume: clamp(input.musicVolume ?? DEFAULT_AUDIO_SETTINGS.musicVolume),
    sfxVolume: clamp(input.sfxVolume ?? DEFAULT_AUDIO_SETTINGS.sfxVolume),
  };
}

function clamp(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.5;
}

export class GameAudioManager {
  private settings = DEFAULT_AUDIO_SETTINGS;
  private context: MusicContext = 'KINGDOM';
  private currentMusic: HTMLAudioElement | null = null;
  private unlocked = false;
  private suspended = false;
  private fadeTimer: number | null = null;
  private readonly failedAssets = new Set<string>();
  private readonly lastSfx = new Map<SfxKey, string>();

  setSettings(settings: AudioSettings): void {
    this.settings = normalizeAudioSettings(settings);
    if (!this.settings.masterEnabled || !this.settings.musicEnabled) this.pauseMusic();
    else if (this.unlocked && !this.suspended) void this.ensureMusic();
    this.applyMusicVolume();
  }

  setContext(context: MusicContext): void {
    if (this.context === context) return;
    this.context = context;
    if (this.unlocked && !this.suspended && this.settings.masterEnabled && this.settings.musicEnabled) void this.crossfade(context);
  }

  async unlock(): Promise<void> {
    if (this.unlocked) return;
    this.unlocked = true;
    if (this.settings.masterEnabled && this.settings.musicEnabled && !this.suspended) await this.ensureMusic();
  }

  playSfx(key: SfxKey): void {
    if (!this.unlocked || this.suspended || !this.settings.masterEnabled || !this.settings.sfxEnabled) return;
    const source = pickSfxAsset(key, this.lastSfx.get(key));
    this.lastSfx.set(key, source);
    const audio = new Audio(source);
    audio.preload = 'none';
    audio.volume = this.settings.masterVolume * this.settings.sfxVolume;
    audio.play().catch(() => this.reportFailure(source));
  }

  suspend(): void {
    this.suspended = true;
    this.currentMusic?.pause();
  }

  resume(): void {
    this.suspended = false;
    if (this.unlocked && this.settings.masterEnabled && this.settings.musicEnabled) void this.ensureMusic();
  }

  destroy(): void {
    if (this.fadeTimer !== null) window.clearInterval(this.fadeTimer);
    this.currentMusic?.pause();
    this.currentMusic = null;
  }

  private async ensureMusic(): Promise<void> {
    const source = MUSIC_TRACKS[this.context];
    if (this.currentMusic?.dataset.source === source) {
      this.applyMusicVolume();
      if (this.currentMusic.paused) await this.currentMusic.play().catch(() => this.reportFailure(source));
      return;
    }
    await this.crossfade(this.context);
  }

  private async crossfade(context: MusicContext): Promise<void> {
    const source = MUSIC_TRACKS[context];
    if (this.currentMusic?.dataset.source === source) return;
    const previous = this.currentMusic;
    const next = new Audio(source);
    next.dataset.source = source;
    next.loop = true;
    next.preload = 'metadata';
    next.volume = 0;
    this.currentMusic = next;
    try {
      await next.play();
    } catch {
      if (this.currentMusic === next) this.currentMusic = previous;
      this.reportFailure(source);
      return;
    }
    if (this.fadeTimer !== null) window.clearInterval(this.fadeTimer);
    const target = this.settings.masterVolume * this.settings.musicVolume;
    let frame = 0;
    this.fadeTimer = window.setInterval(() => {
      frame += 1;
      const ratio = Math.min(1, frame / 12);
      next.volume = target * ratio;
      if (previous) previous.volume = Math.max(0, target * (1 - ratio));
      if (ratio >= 1) {
        if (this.fadeTimer !== null) window.clearInterval(this.fadeTimer);
        this.fadeTimer = null;
        previous?.pause();
      }
    }, 50);
  }

  private pauseMusic(): void {
    this.currentMusic?.pause();
  }

  private applyMusicVolume(): void {
    if (this.currentMusic) this.currentMusic.volume = this.settings.masterVolume * this.settings.musicVolume;
  }

  private reportFailure(source: string): void {
    if (this.failedAssets.has(source)) return;
    this.failedAssets.add(source);
    console.warn(`Audio asset unavailable: ${source}`);
  }
}
