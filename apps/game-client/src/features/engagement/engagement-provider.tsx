'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { EngagementOverviewResponse, EngagementReturnSummary } from '@crown-and-coin/shared';
import { usePlayerExperience } from '@/features/experience/player-experience-provider';
import { useGameAudio } from '@/features/audio/audio-provider';
import { claimRoyalDecree, EngagementApiError, fetchEngagement, heartbeatEngagement, openEngagementSession } from './api/engagement-api';

interface EngagementContextValue {
  state: EngagementOverviewResponse | null;
  returnSummary: EngagementReturnSummary | null;
  action: 'idle' | 'claiming';
  errorCode: string | null;
  dismissReturnSummary(): void;
  refresh(signal?: AbortSignal): Promise<void>;
  claimDecree(): Promise<boolean>;
}

const EngagementContext = createContext<EngagementContextValue | null>(null);

export function EngagementProvider({ children }: { children: ReactNode }) {
  const experience = usePlayerExperience();
  const audio = useGameAudio();
  const enabled = experience.onboarding?.status === 'COMPLETED' || experience.onboarding?.status === 'SKIPPED';
  const [state, setState] = useState<EngagementOverviewResponse | null>(null);
  const [returnSummary, setReturnSummary] = useState<EngagementReturnSummary | null>(null);
  const [action, setAction] = useState<'idle' | 'claiming'>('idle');
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!enabled) return;
    try {
      const response = await fetchEngagement(signal);
      setState(response);
      setErrorCode(null);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setErrorCode(error instanceof EngagementApiError ? error.code : 'SERVER_ERROR');
    }
  }, [enabled]);

  const openSession = useCallback((signal?: AbortSignal): void => {
    void openEngagementSession(crypto.randomUUID(), signal).then((response) => {
      setState(response);
      if (response.returnSummary) setReturnSummary(response.returnSummary);
      setErrorCode(null);
      if (response.returnSummary) audio.playSfx('panel_open');
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setErrorCode(error instanceof EngagementApiError ? error.code : 'SERVER_ERROR');
    });
  }, [audio]);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    openSession(controller.signal);
    return () => controller.abort();
  }, [enabled, openSession]);

  useEffect(() => {
    if (!enabled) return;
    const heartbeat = (): void => { if (document.visibilityState === 'visible') void heartbeatEngagement().catch(() => undefined); };
    const visibility = (): void => {
      if (document.visibilityState === 'hidden') void heartbeatEngagement().catch(() => undefined);
      else openSession();
    };
    const timer = window.setInterval(heartbeat, 60_000);
    document.addEventListener('visibilitychange', visibility);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', visibility); };
  }, [enabled, openSession]);

  useEffect(() => {
    if (!enabled) return;
    const gameplay = (): void => { void refresh(); };
    window.addEventListener('crown:engagement-refresh', gameplay);
    return () => window.removeEventListener('crown:engagement-refresh', gameplay);
  }, [enabled, refresh]);

  const claimDecree = useCallback(async (): Promise<boolean> => {
    if (action !== 'idle') return false;
    setAction('claiming');
    try {
      const response = await claimRoyalDecree();
      setState(response.engagement);
      setErrorCode(null);
      audio.playSfx('collect');
      window.dispatchEvent(new Event('crown:retention-refresh'));
      window.dispatchEvent(new Event('crown:kingdom-refresh'));
      return true;
    } catch (error) {
      setErrorCode(error instanceof EngagementApiError ? error.code : 'SERVER_ERROR');
      return false;
    } finally { setAction('idle'); }
  }, [action, audio]);

  const value = useMemo<EngagementContextValue>(() => ({
    state, returnSummary, action, errorCode,
    dismissReturnSummary: () => setReturnSummary(null), refresh, claimDecree,
  }), [state, returnSummary, action, errorCode, refresh, claimDecree]);
  return <EngagementContext.Provider value={value}>{children}</EngagementContext.Provider>;
}

export function useEngagement(): EngagementContextValue {
  const value = useContext(EngagementContext);
  if (!value) throw new Error('useEngagement must be used inside EngagementProvider.');
  return value;
}

declare global {
  interface WindowEventMap {
    'crown:engagement-refresh': Event;
    'crown:kingdom-refresh': Event;
  }
}
