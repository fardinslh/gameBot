'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CollectResponse, KingdomStateResponse, ResourceAmounts } from '@crown-and-coin/shared';
import { BUILDING_TYPE_TO_ID } from '../data/building-layout';
import type { KingdomBuildingView } from '../domain/kingdom-types';
import { collectKingdom, fetchKingdom, KingdomApiError, upgradeBuilding } from '../api/kingdom-api';

type ActionState = 'idle' | 'collecting' | 'upgrading';

export function useKingdomState() {
  const [state, setState] = useState<KingdomStateResponse | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [action, setAction] = useState<ActionState>('idle');
  const [lastGains, setLastGains] = useState<ResourceAmounts | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const initialLoadStarted = useRef(false);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetchKingdom(signal);
      setState(response);
      setServerOffsetMs(Date.parse(response.serverTime) - Date.now());
      setErrorCode(null);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setErrorCode(error instanceof KingdomApiError ? error.code : 'SERVER_ERROR');
    }
  }, []);

  useEffect(() => {
    if (initialLoadStarted.current) return;
    initialLoadStarted.current = true;
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const interval = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(interval);
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
    const finishTimes = state.buildings.flatMap((building) => building.activeUpgrade ? [Date.parse(building.activeUpgrade.finishAt)] : []);
    if (finishTimes.length === 0) return;
    const nextFinish = Math.min(...finishTimes);
    const serverOffset = Date.parse(state.serverTime) - Date.now();
    const delay = Math.max(0, nextFinish - (Date.now() + serverOffset)) + 250;
    const timeout = window.setTimeout(() => void refresh(), delay);
    return () => window.clearTimeout(timeout);
  }, [state, refresh]);

  const collect = useCallback(async () => {
    if (!state || action !== 'idle') return;
    setAction('collecting');
    try {
      const response: CollectResponse = await collectKingdom();
      setState((current) => current ? {
        ...current,
        balances: response.balances,
        buildings: response.buildings,
        kingdom: { ...current.kingdom, lastCollectedAt: response.lastCollectedAt },
        serverTime: response.serverTime,
      } : current);
      setLastGains(response.gains);
      setServerOffsetMs(Date.parse(response.serverTime) - Date.now());
      setErrorCode(null);
      window.setTimeout(() => setLastGains(null), 2_400);
    } catch (error) {
      setErrorCode(error instanceof KingdomApiError ? error.code : 'SERVER_ERROR');
    } finally {
      setAction('idle');
    }
  }, [state, action]);

  const upgrade = useCallback(async (buildingId: string) => {
    if (!state || action !== 'idle') return;
    setAction('upgrading');
    try {
      const response = await upgradeBuilding(buildingId);
      setState((current) => current ? {
        ...current,
        balances: response.balances,
        buildings: current.buildings.map((building) => building.id === response.building.id ? response.building : building),
        serverTime: response.serverTime,
      } : current);
      setServerOffsetMs(Date.parse(response.serverTime) - Date.now());
      setErrorCode(null);
    } catch (error) {
      setErrorCode(error instanceof KingdomApiError ? error.code : 'SERVER_ERROR');
    } finally {
      setAction('idle');
    }
  }, [state, action]);

  const buildings = useMemo<KingdomBuildingView[]>(() => state?.buildings.map((building) => ({
    ...building,
    visualId: BUILDING_TYPE_TO_ID[building.type],
  })) ?? [], [state]);

  const serverNow = clock + serverOffsetMs;
  return { state, buildings, errorCode, action, lastGains, serverNow, collect, upgrade, refresh };
}
