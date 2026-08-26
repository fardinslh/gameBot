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
  const [settings, setSettingsState] = useState<AudioSettings>(DEFAULT_AUDIO_SETTINGS);

  useEffect(() => {
    let stored = DEFAULT_AUDIO_SETTINGS;
    try { stored = normalizeAudioSettings(JSON.parse(localStorage.getItem(AUDIO_STORAGE_KEY) ?? 'null')); } catch { /* defaults */ }
    setSettingsState(stored);
    managerRef.current?.setSettings(stored);
  }, []);

  useEffect(() => {
    const unlock = (): void => { void managerRef.current?.unlock(); };
    window.addEventListener('pointerdown', unlock, { once: true, capture: true });
    window.addEventListener('keydown', unlock, { once: true, capture: true });
    const visibility = (): void => { document.hidden ? managerRef.current?.suspend() : managerRef.current?.resume(); };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
      document.removeEventListener('visibilitychange', visibility);
      managerRef.current?.destroy();
    };
  }, []);

  const setSettings = useCallback((next: AudioSettings) => {
    const normalized = normalizeAudioSettings(next);
    setSettingsState(normalized);
    localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(normalized));
    managerRef.current?.setSettings(normalized);
  }, []);
  const playSfx = useCallback((key: SfxKey) => managerRef.current?.playSfx(key), []);
  const setMusicContext = useCallback((context: MusicContext) => managerRef.current?.setContext(context), []);
  const unlock = useCallback(() => { void managerRef.current?.unlock(); }, []);
  const value = useMemo(() => ({ settings, setSettings, playSfx, setMusicContext, unlock }), [settings, setSettings, playSfx, setMusicContext, unlock]);
  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
}

export function useGameAudio(): AudioContextValue {
  const value = useContext(AudioContext);
  if (!value) throw new Error('useGameAudio must be used inside AudioProvider.');
  return value;
}
