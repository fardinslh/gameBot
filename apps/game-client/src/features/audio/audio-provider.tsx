'use client';

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AUDIO_STORAGE_KEY,
  DEFAULT_AUDIO_SETTINGS,
  GameAudioManager,
  normalizeAudioSettings,
  type AudioSettings,
  type MusicContext,
  type SfxKey,
} from './audio-manager';

import { AmbientSoundtrack } from './ambient-soundtrack';

interface AudioContextValue {
  settings: AudioSettings;
  setSettings(settings: AudioSettings): void;
  playSfx(key: SfxKey): void;
  setMusicContext(context: MusicContext): void;
  unlock(): void;
}

const AudioContext = createContext<AudioContextValue | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const managerRef = useRef<GameAudioManager | null>(null);
  if (!managerRef.current) managerRef.current = new GameAudioManager();
  const ambientRef = useRef<AmbientSoundtrack | null>(null);
  if (!ambientRef.current) ambientRef.current = new AmbientSoundtrack();
  const [settings, setSettingsState] = useState<AudioSettings>(DEFAULT_AUDIO_SETTINGS);

  useEffect(() => {
    let stored = DEFAULT_AUDIO_SETTINGS;
    try { stored = normalizeAudioSettings(JSON.parse(localStorage.getItem(AUDIO_STORAGE_KEY) ?? 'null')); } catch { /* defaults */ }
    setSettingsState(stored);
    managerRef.current?.setSettings(stored);
    const isMuted = !stored.masterEnabled || !stored.musicEnabled;
    ambientRef.current?.setEnabled(!isMuted);
    ambientRef.current?.setVolume(stored.musicVolume * stored.masterVolume);
  }, []);

  useEffect(() => {
    const isMuted = !settings.masterEnabled || !settings.musicEnabled;
    ambientRef.current?.setEnabled(!isMuted);
    ambientRef.current?.setVolume(settings.musicVolume * settings.masterVolume);
  }, [settings]);

  useEffect(() => {
    const unlock = (): void => {
      void managerRef.current?.unlock().then(() => {
        const ctx = managerRef.current?.getWebAudioContext();
        if (ctx) {
          ambientRef.current?.setAudioContext(ctx);
          if (settings.masterEnabled && settings.musicEnabled) {
            ambientRef.current?.start();
          }
        }
      });
    };
    window.addEventListener('pointerdown', unlock, { once: true, capture: true });
    window.addEventListener('keydown', unlock, { once: true, capture: true });
    const visibility = (): void => {
      if (document.hidden) {
        managerRef.current?.suspend();
        ambientRef.current?.stop();
      } else {
        managerRef.current?.resume();
        if (settings.masterEnabled && settings.musicEnabled) {
          ambientRef.current?.start();
        }
      }
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
      document.removeEventListener('visibilitychange', visibility);
      ambientRef.current?.stop();
      managerRef.current?.destroy();
    };
  }, [settings]);

  const setSettings = useCallback((next: AudioSettings) => {
    const normalized = normalizeAudioSettings(next);
    setSettingsState(normalized);
    localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(normalized));
    managerRef.current?.setSettings(normalized);
    const isMuted = !normalized.masterEnabled || !normalized.musicEnabled;
    ambientRef.current?.setEnabled(!isMuted);
    ambientRef.current?.setVolume(normalized.musicVolume * normalized.masterVolume);
  }, []);
  const playSfx = useCallback((key: SfxKey) => managerRef.current?.playSfx(key), []);
  const setMusicContext = useCallback((context: MusicContext) => {
    managerRef.current?.setContext(context);
    if (context === 'KINGDOM' && settings.masterEnabled && settings.musicEnabled) {
      ambientRef.current?.start();
    } else {
      ambientRef.current?.stop();
    }
  }, [settings]);
  const unlock = useCallback(() => {
    void managerRef.current?.unlock().then(() => {
      const ctx = managerRef.current?.getWebAudioContext();
      if (ctx) {
        ambientRef.current?.setAudioContext(ctx);
        if (settings.masterEnabled && settings.musicEnabled) {
          ambientRef.current?.start();
        }
      }
    });
  }, [settings]);
  const value = useMemo(() => ({ settings, setSettings, playSfx, setMusicContext, unlock }), [settings, setSettings, playSfx, setMusicContext, unlock]);
  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
}

export function useGameAudio(): AudioContextValue {
  const value = useContext(AudioContext);
  if (!value) throw new Error('useGameAudio must be used inside AudioProvider.');
  return value;
}
