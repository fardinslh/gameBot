'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { HeroesResponse } from '@crown-and-coin/shared';
import { fetchHeroes, HeroApiError, saveRaidTeam, upgradeHero } from '../api/hero-api';
import { useGameAudio } from '@/features/audio/audio-provider';

type HeroAction = 'idle' | 'saving-team' | 'upgrading';

export function useHeroState() {
  const audio = useGameAudio();
  const [state, setState] = useState<HeroesResponse | null>(null);
  const [draftHeroIds, setDraftHeroIds] = useState<string[]>([]);
  const [action, setAction] = useState<HeroAction>('idle');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [teamSaved, setTeamSaved] = useState(false);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetchHeroes(signal);
      setState(response);
      setDraftHeroIds(response.team.slots.map((slot) => slot.playerHeroId));
      setErrorCode(null);
      audio.playSfx('hero_upgrade');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setErrorCode(error instanceof HeroApiError ? error.code : 'SERVER_ERROR');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  const assignHero = useCallback((heroId: string, targetSlot: number) => {
    setDraftHeroIds((current) => {
      if (current.length !== 3 || targetSlot < 0 || targetSlot > 2) return current;
      const sourceSlot = current.indexOf(heroId);
      if (sourceSlot === targetSlot) return current;
      const next = [...current];
      const replaced = next[targetSlot];
      next[targetSlot] = heroId;
      if (sourceSlot >= 0) next[sourceSlot] = replaced;
      return next;
    });
    setTeamSaved(false);
  }, []);

  const saveTeam = useCallback(async () => {
    if (!state || draftHeroIds.length !== 3 || action !== 'idle') return;
    setAction('saving-team');
    try {
      const response = await saveRaidTeam(draftHeroIds);
      setState((current) => current ? { ...current, team: response.team, serverTime: response.serverTime } : current);
      setTeamSaved(true);
      setErrorCode(null);
      window.setTimeout(() => setTeamSaved(false), 2_000);
    } catch (error) {
      setErrorCode(error instanceof HeroApiError ? error.code : 'SERVER_ERROR');
    } finally {
      setAction('idle');
    }
  }, [state, draftHeroIds, action]);

  const upgrade = useCallback(async (heroId: string) => {
    if (!state || action !== 'idle') return;
    setAction('upgrading');
    try {
      const response = await upgradeHero(heroId);
      setState((current) => current ? {
        ...current,
        heroes: current.heroes.map((hero) => hero.id === response.hero.id ? response.hero : hero),
        balances: response.balances,
        team: response.team,
        serverTime: response.serverTime,
      } : current);
      setErrorCode(null);
    } catch (error) {
      setErrorCode(error instanceof HeroApiError ? error.code : 'SERVER_ERROR');
    } finally {
      setAction('idle');
    }
  }, [state, action, audio]);

  const persistedIds = useMemo(() => state?.team.slots.map((slot) => slot.playerHeroId) ?? [], [state]);
  const teamDirty = draftHeroIds.join('|') !== persistedIds.join('|');
  return { state, draftHeroIds, action, errorCode, teamSaved, teamDirty, assignHero, saveTeam, upgrade, refresh };
}
