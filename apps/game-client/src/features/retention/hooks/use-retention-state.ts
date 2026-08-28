'use client';

import { useCallback, useEffect, useState } from 'react';
import type { RetentionClaimResponse, RetentionStateResponse } from '@crown-and-coin/shared';
import { useGameAudio } from '@/features/audio/audio-provider';
import { claimAchievement, claimDailyBonus, claimDailyReturn, claimMission, fetchRetention, RetentionApiError } from '../api/retention-api';

type RetentionAction = 'idle' | `mission:${string}` | 'daily-bonus' | `achievement:${string}:${number}` | 'daily-return';

export function useRetentionState(enabled: boolean, onBalancesChanged: () => Promise<void>) {
  const audio = useGameAudio();
  const [state, setState] = useState<RetentionStateResponse | null>(null);
  const [action, setAction] = useState<RetentionAction>('idle');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [serverOffsetMs, setServerOffsetMs] = useState(0);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!enabled) return;
    try {
      const response = await fetchRetention(signal);
      setState(response);
      setServerOffsetMs(Date.parse(response.serverTime) - Date.now());
      setErrorCode(null);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setErrorCode(error instanceof RetentionApiError ? error.code : 'SERVER_ERROR');
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) { setState(null); return; }
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1_000);
    const visibility = (): void => { if (document.visibilityState === 'visible') void refresh(); };
    const gameplay = (): void => { void refresh(); };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('crown:retention-refresh', gameplay);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('crown:retention-refresh', gameplay);
    };
  }, [enabled, refresh]);

  const settle = useCallback(async (nextAction: RetentionAction, operation: () => Promise<RetentionClaimResponse>) => {
    if (action !== 'idle') return;
    setAction(nextAction);
    try {
      const response = await operation();
      setState(response.retention);
      setServerOffsetMs(Date.parse(response.retention.serverTime) - Date.now());
      setErrorCode(null);
      audio.playSfx('collect');
      await onBalancesChanged();
    } catch (error) {
      setErrorCode(error instanceof RetentionApiError ? error.code : 'SERVER_ERROR');
    } finally { setAction('idle'); }
  }, [action, audio, onBalancesChanged]);

  return {
    state,
    action,
    errorCode,
    serverNow: clock + serverOffsetMs,
    refresh,
    claimMission: (id: string) => settle(`mission:${id}`, () => claimMission(id)),
    claimDailyBonus: () => settle('daily-bonus', claimDailyBonus),
    claimAchievement: (achievementKey: string, tier: number) => settle(`achievement:${achievementKey}:${tier}`, () => claimAchievement(achievementKey, tier)),
    claimDailyReturn: () => settle('daily-return', claimDailyReturn),
  };
}

declare global {
  interface WindowEventMap { 'crown:retention-refresh': Event; }
}
