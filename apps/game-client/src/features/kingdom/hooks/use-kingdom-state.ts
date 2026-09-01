'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CollectResponse, KingdomBuildingState, KingdomStateResponse, ResourceAmounts } from '@crown-and-coin/shared';
import { BUILDING_TYPE_TO_ID } from '../data/building-layout';
import type { KingdomBuildingView } from '../domain/kingdom-types';
import { collectCompletedBuildingUpgrade, collectKingdom, fetchKingdom, KingdomApiError, upgradeBuilding } from '../api/kingdom-api';
import { useGameAudio } from '@/features/audio/audio-provider';
import { usePlayerExperience } from '@/features/experience/player-experience-provider';
import { easeOutCubic, interpolateResourceBalances } from '../domain/collection-presentation';

type ActionState = 'idle' | 'collecting' | 'upgrading' | 'finishing-upgrade';

export function useKingdomState() {
  const audio = useGameAudio();
  const experience = usePlayerExperience();
  const [state, setState] = useState<KingdomStateResponse | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [action, setAction] = useState<ActionState>('idle');
  const [lastGains, setLastGains] = useState<ResourceAmounts | null>(null);
  const [displayedBalances, setDisplayedBalances] = useState<ResourceAmounts | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [completedUpgrade, setCompletedUpgrade] = useState<{ before: KingdomBuildingState; after: KingdomBuildingState; xpGained: number; storageGained: string; effectGainedBps: number } | null>(null);
  const stateRef = useRef<KingdomStateResponse | null>(null);
  const initialLoadStarted = useRef(false);
  const balanceAnimationFrame = useRef<number | null>(null);
  const feedbackTimeout = useRef<number | null>(null);

  const cancelCollectionPresentation = useCallback((balances?: ResourceAmounts) => {
    if (balanceAnimationFrame.current !== null) window.cancelAnimationFrame(balanceAnimationFrame.current);
    if (feedbackTimeout.current !== null) window.clearTimeout(feedbackTimeout.current);
    balanceAnimationFrame.current = null;
    feedbackTimeout.current = null;
    setLastGains(null);
    if (balances) setDisplayedBalances(balances);
  }, []);

  const presentCollection = useCallback((start: ResourceAmounts, end: ResourceAmounts, gains: ResourceAmounts) => {
    cancelCollectionPresentation();
    setLastGains(gains);
    feedbackTimeout.current = window.setTimeout(() => setLastGains(null), 1_100);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayedBalances(end);
      return;
    }
    setDisplayedBalances(start);
    let startedAt: number | null = null;
    const frame = (timestamp: number) => {
      startedAt ??= timestamp;
      const progress = Math.min(1, (timestamp - startedAt) / 900);
      setDisplayedBalances(interpolateResourceBalances(start, end, easeOutCubic(progress)));
      if (progress < 1) balanceAnimationFrame.current = window.requestAnimationFrame(frame);
      else {
        balanceAnimationFrame.current = null;
        setDisplayedBalances(end);
      }
    };
    balanceAnimationFrame.current = window.requestAnimationFrame(frame);
  }, [cancelCollectionPresentation]);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetchKingdom(signal);
      const previous = stateRef.current;
      if (previous) {
        const changed = response.buildings.find((building) => {
          const before = previous.buildings.find((item) => item.id === building.id);
          return before && building.level > before.level;
        });
        const before = changed ? previous.buildings.find((item) => item.id === changed.id) : null;
        if (changed && before) {
          const previousEffect = before.effects[0]?.valueBps ?? 0;
          const nextEffect = changed.effects[0]?.valueBps ?? 0;
          setCompletedUpgrade({
            before,
            after: changed,
            xpGained: Math.max(0, response.progression.xp - previous.progression.xp),
            storageGained: changed.type === 'CASTLE' ? (BigInt(response.storageCapacities.GOLD ?? '0') - BigInt(previous.storageCapacities.GOLD ?? '0')).toString() : '0',
            effectGainedBps: Math.max(0, nextEffect - previousEffect),
          });
        }
      }
      stateRef.current = response;
      cancelCollectionPresentation(response.balances);
      setState(response);
      setServerOffsetMs(Date.parse(response.serverTime) - Date.now());
      setErrorCode(null);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setErrorCode(error instanceof KingdomApiError ? error.code : 'SERVER_ERROR');
    }
  }, [cancelCollectionPresentation]);

  const finishUpgrade = useCallback(async (buildingId: string) => {
    setAction('finishing-upgrade');
    try {
      await collectCompletedBuildingUpgrade(buildingId);
      audio.playSfx('upgrade_complete');
      await refresh();
      window.dispatchEvent(new Event('crown:engagement-refresh'));
      setErrorCode(null);
    } catch (error) {
      setErrorCode(error instanceof KingdomApiError ? error.code : 'SERVER_ERROR');
    } finally {
      setAction('idle');
    }
  }, [refresh, audio]);

  useEffect(() => {
    if (initialLoadStarted.current) return;
    initialLoadStarted.current = true;
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const gameplay = (): void => { void refresh(); };
    window.addEventListener('crown:kingdom-refresh', gameplay);
    return () => window.removeEventListener('crown:kingdom-refresh', gameplay);
  }, [refresh]);

  useEffect(() => {
    const interval = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => () => {
    if (balanceAnimationFrame.current !== null) window.cancelAnimationFrame(balanceAnimationFrame.current);
    if (feedbackTimeout.current !== null) window.clearTimeout(feedbackTimeout.current);
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [refresh]);

  useEffect(() => {
    if (!state) return;
    const nextBuilding = state.buildings
      .filter((building) => building.activeUpgrade)
      .sort((left, right) => Date.parse(left.activeUpgrade!.finishAt) - Date.parse(right.activeUpgrade!.finishAt))[0];
    if (!nextBuilding?.activeUpgrade) return;
    const nextFinish = Date.parse(nextBuilding.activeUpgrade.finishAt);
    const serverOffset = Date.parse(state.serverTime) - Date.now();
    const delay = Math.max(0, nextFinish - (Date.now() + serverOffset)) + 250;
    const timeout = window.setTimeout(() => void finishUpgrade(nextBuilding.id), delay);
    return () => window.clearTimeout(timeout);
  }, [state, finishUpgrade]);

  const collect = useCallback(async () => {
    if (!state || action !== 'idle') return;
    setAction('collecting');
    try {
      const previousBalances = state.balances;
      const response: CollectResponse = await collectKingdom();
      setState((current) => current ? {
        ...current,
        balances: response.balances,
        buildings: response.buildings,
        kingdom: { ...current.kingdom, lastCollectedAt: response.lastCollectedAt },
        serverTime: response.serverTime,
      } : current);
      stateRef.current = stateRef.current ? {
        ...stateRef.current,
        balances: response.balances,
        buildings: response.buildings,
        kingdom: { ...stateRef.current.kingdom, lastCollectedAt: response.lastCollectedAt },
        serverTime: response.serverTime,
      } : stateRef.current;
      presentCollection(previousBalances, response.balances, response.gains);
      setServerOffsetMs(Date.parse(response.serverTime) - Date.now());
      setErrorCode(null);
      audio.playSfx('collect');
      await experience.refreshOnboarding();
      window.dispatchEvent(new Event('crown:retention-refresh'));
      window.dispatchEvent(new Event('crown:engagement-refresh'));
    } catch (error) {
      setErrorCode(error instanceof KingdomApiError ? error.code : 'SERVER_ERROR');
    } finally {
      setAction('idle');
    }
  }, [state, action, audio, experience, presentCollection]);

  const upgrade = useCallback(async (buildingId: string) => {
    if (!state || action !== 'idle') return;
    setAction('upgrading');
    try {
      const response = await upgradeBuilding(buildingId);
      cancelCollectionPresentation(response.balances);
      setState((current) => current ? {
        ...current,
        balances: response.balances,
        buildings: current.buildings.map((building) => building.id === response.building.id ? response.building : building),
        serverTime: response.serverTime,
      } : current);
      stateRef.current = stateRef.current ? {
        ...stateRef.current,
        balances: response.balances,
        buildings: stateRef.current.buildings.map((building) => building.id === response.building.id ? response.building : building),
        serverTime: response.serverTime,
      } : stateRef.current;
      setServerOffsetMs(Date.parse(response.serverTime) - Date.now());
      setErrorCode(null);
      audio.playSfx('upgrade_start');
      await experience.refreshOnboarding();
      window.dispatchEvent(new Event('crown:retention-refresh'));
      window.dispatchEvent(new Event('crown:engagement-refresh'));
    } catch (error) {
      setErrorCode(error instanceof KingdomApiError ? error.code : 'SERVER_ERROR');
    } finally {
      setAction('idle');
    }
  }, [state, action, audio, experience, cancelCollectionPresentation]);

  const buildings = useMemo<KingdomBuildingView[]>(() => state?.buildings.map((building) => ({
    ...building,
    visualId: BUILDING_TYPE_TO_ID[building.type],
  })) ?? [], [state]);

  const serverNow = clock + serverOffsetMs;
  return { state, buildings, errorCode, action, lastGains, displayedBalances, serverNow, completedUpgrade, dismissCompletedUpgrade: () => setCompletedUpgrade(null), collect, upgrade, refresh };
}
