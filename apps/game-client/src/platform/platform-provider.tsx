'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { useGameAudio } from '@/features/audio/audio-provider';
import type {
  ClientPlatformAdapter,
  HapticImpactStyle,
  HapticNotificationType,
} from './client-platform-adapter';
import { createClientPlatformAdapter } from './client-platform';

const PlatformContext = createContext<ClientPlatformAdapter | null>(null);

export function ClientPlatformProvider({
  children,
  adapter,
}: {
  children: ReactNode;
  adapter?: ClientPlatformAdapter;
}) {
  const adapterRef = useRef<ClientPlatformAdapter | null>(adapter ?? null);
  if (!adapterRef.current) {
    adapterRef.current = createClientPlatformAdapter();
  }

  useEffect(() => {
    const current = adapterRef.current;
    if (!current) return;

    void current.initialize().then(() => {
      current.ready();
    });
  }, []);

  return (
    <PlatformContext.Provider value={adapterRef.current}>
      {children}
    </PlatformContext.Provider>
  );
}

export function useClientPlatform(): ClientPlatformAdapter {
  const adapter = useContext(PlatformContext);
  if (!adapter) {
    throw new Error('useClientPlatform must be used within a ClientPlatformProvider');
  }
  return adapter;
}

export interface SensoryFeedback {
  /** Light tap for normal button clicks and list items */
  tap(): void;
  /** Selection tick for building / target focus */
  select(): void;
  /** Panel / drawer / modal opening feedback */
  panelOpen(): void;
  /** Back / close sheet feedback */
  back(): void;
  /** Satisfying medium bounce for resource harvesting */
  collect(): void;
  /** Tactile thump when starting a building upgrade */
  upgradeStart(): void;
  /** Triumphant success fanfare and vibration for completed upgrades */
  upgradeComplete(): void;
  /** Hero selection feedback */
  heroSelect(): void;
  /** Hero level upgrade feedback */
  heroUpgrade(): void;
  /** Victory feedback */
  victory(): void;
  /** Defeat feedback */
  defeat(): void;
  /** Error feedback */
  error(): void;
  /** Custom impact vibration with optional audio */
  impact(style: HapticImpactStyle): void;
  /** Custom notification vibration with optional audio */
  notify(type: HapticNotificationType): void;
}

export function useSensoryFeedback(): SensoryFeedback {
  const platform = useClientPlatform();
  const audio = useGameAudio();

  const tap = useCallback(() => {
    platform.hapticImpact('light');
    audio.playSfx('ui_tap');
  }, [platform, audio]);

  const select = useCallback(() => {
    platform.hapticSelection();
    audio.playSfx('building_select');
  }, [platform, audio]);

  const panelOpen = useCallback(() => {
    platform.hapticImpact('light');
    audio.playSfx('panel_open');
  }, [platform, audio]);

  const back = useCallback(() => {
    platform.hapticImpact('light');
    audio.playSfx('back');
  }, [platform, audio]);

  const collect = useCallback(() => {
    platform.hapticImpact('medium');
    audio.playSfx('collect');
  }, [platform, audio]);

  const upgradeStart = useCallback(() => {
    platform.hapticImpact('medium');
    audio.playSfx('upgrade_start');
  }, [platform, audio]);

  const upgradeComplete = useCallback(() => {
    platform.hapticNotification('success');
    audio.playSfx('upgrade_complete');
  }, [platform, audio]);

  const heroSelect = useCallback(() => {
    platform.hapticSelection();
    audio.playSfx('hero_select');
  }, [platform, audio]);

  const heroUpgrade = useCallback(() => {
    platform.hapticNotification('success');
    audio.playSfx('hero_upgrade');
  }, [platform, audio]);

  const victory = useCallback(() => {
    platform.hapticNotification('success');
    audio.playSfx('victory');
  }, [platform, audio]);

  const defeat = useCallback(() => {
    platform.hapticNotification('error');
    audio.playSfx('defeat');
  }, [platform, audio]);

  const error = useCallback(() => {
    platform.hapticNotification('error');
  }, [platform]);

  const impact = useCallback(
    (style: HapticImpactStyle) => {
      platform.hapticImpact(style);
    },
    [platform]
  );

  const notify = useCallback(
    (type: HapticNotificationType) => {
      platform.hapticNotification(type);
    },
    [platform]
  );

  return useMemo(
    () => ({
      tap,
      select,
      panelOpen,
      back,
      collect,
      upgradeStart,
      upgradeComplete,
      heroSelect,
      heroUpgrade,
      victory,
      defeat,
      error,
      impact,
      notify,
    }),
    [
      tap,
      select,
      panelOpen,
      back,
      collect,
      upgradeStart,
      upgradeComplete,
      heroSelect,
      heroUpgrade,
      victory,
      defeat,
      error,
      impact,
      notify,
    ]
  );
}
