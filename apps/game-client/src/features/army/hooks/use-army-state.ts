'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ArmyFormationSlotInput, ArmyResponse, HeroesResponse, TroopType } from '@crown-and-coin/shared';
import { fetchArmy, ArmyApiError, saveArmyFormation, trainTroops } from '../api/army-api';
import { fetchHeroes, HeroApiError, upgradeHero } from '@/features/heroes/api/hero-api';

type ArmyAction = 'idle' | 'saving' | 'training' | 'upgrading';

export function useArmyState() {
  const [army, setArmy] = useState<ArmyResponse | null>(null);
  const [heroes, setHeroes] = useState<HeroesResponse | null>(null);
  const [draftSlots, setDraftSlots] = useState<ArmyFormationSlotInput[]>([]);
  const [action, setAction] = useState<ArmyAction>('idle');
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const [armyResponse, heroResponse] = await Promise.all([fetchArmy(signal), fetchHeroes(signal)]);
      setArmy(armyResponse);
      setHeroes(heroResponse);
      setDraftSlots(armyResponse.formation.slots.map((slot) => ({
        slot: slot.slot,
        troopType: slot.troopType,
        unitCount: slot.unitCount,
        commanderPlayerHeroId: slot.commander.playerHeroId,
      })));
      setErrorCode(null);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setErrorCode(error instanceof ArmyApiError || error instanceof HeroApiError ? error.code : 'SERVER_ERROR');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  useEffect(() => {
    if (!army?.training) return;
    const remaining = Date.parse(army.training.completesAt) - Date.now();
    const timer = window.setTimeout(() => void refresh(), Math.max(500, remaining + 250));
    return () => window.clearTimeout(timer);
  }, [army?.training, refresh]);

  const updateSlot = useCallback((slotNumber: number, change: Partial<ArmyFormationSlotInput>) => {
    setDraftSlots((current) => current.map((slot) => slot.slot === slotNumber ? { ...slot, ...change } : slot));
  }, []);

  const save = useCallback(async () => {
    if (action !== 'idle' || draftSlots.length !== 3) return;
    setAction('saving');
    try {
      const response = await saveArmyFormation(draftSlots);
      setArmy(response);
      setDraftSlots(response.formation.slots.map((slot) => ({ slot: slot.slot, troopType: slot.troopType, unitCount: slot.unitCount, commanderPlayerHeroId: slot.commander.playerHeroId })));
      setErrorCode(null);
    } catch (error) {
      setErrorCode(error instanceof ArmyApiError ? error.code : 'SERVER_ERROR');
    } finally { setAction('idle'); }
  }, [action, draftSlots]);

  const train = useCallback(async (type: TroopType, quantity: number) => {
    if (action !== 'idle') return;
    setAction('training');
    try {
      const response = await trainTroops(type, quantity);
      setArmy(response);
      setHeroes((current) => current ? {
        ...current,
        balances: response.balances,
        serverTime: response.serverTime,
      } : current);
      setErrorCode(null);
    } catch (error) {
      setErrorCode(error instanceof ArmyApiError ? error.code : 'SERVER_ERROR');
    } finally { setAction('idle'); }
  }, [action]);

  const upgrade = useCallback(async (heroId: string) => {
    if (action !== 'idle') return;
    setAction('upgrading');
    try {
      const response = await upgradeHero(heroId);
      setHeroes((current) => current ? { ...current, heroes: current.heroes.map((hero) => hero.id === response.hero.id ? response.hero : hero), balances: response.balances, serverTime: response.serverTime } : current);
      await refresh();
    } catch (error) {
      setErrorCode(error instanceof HeroApiError ? error.code : 'SERVER_ERROR');
    } finally { setAction('idle'); }
  }, [action, refresh]);

  const persisted = army?.formation.slots.map((slot) => `${slot.slot}:${slot.troopType}:${slot.unitCount}:${slot.commander.playerHeroId}`).join('|') ?? '';
  const draft = draftSlots.map((slot) => `${slot.slot}:${slot.troopType}:${slot.unitCount}:${slot.commanderPlayerHeroId}`).join('|');
  return { army, heroes, draftSlots, action, errorCode, dirty: persisted !== draft, refresh, updateSlot, save, train, upgrade };
}
