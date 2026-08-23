'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BattleReplayResponse, RaidOverviewResponse, RaidSearchResponse } from '@crown-and-coin/shared';
import { fetchRaid, RaidApiError, searchRaid, startRaid } from '../api/raid-api';
import { trackRaidEvent } from '../analytics/raid-analytics';

export function useRaidState() {
  const [overview, setOverview] = useState<RaidOverviewResponse | null>(null);
  const [offer, setOffer] = useState<RaidSearchResponse['offer'] | null>(null);
  const [battle, setBattle] = useState<BattleReplayResponse | null>(null);
  const [action, setAction] = useState<'loading' | 'idle' | 'searching' | 'attacking'>('loading');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const trackedBattles = useRef(new Set<string>());

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setAction('loading');
    try {
      const response = await fetchRaid(signal);
      setOverview(response);
      setErrorCode(null);
      trackRaidEvent('raid_opened');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setErrorCode(error instanceof RaidApiError ? error.code : 'SERVER_ERROR');
    } finally { setAction('idle'); }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  const search = useCallback(async () => {
    if (action !== 'idle') return;
    setAction('searching');
    setBattle(null);
    trackRaidEvent('raid_search');
    try {
      const response = await searchRaid();
      setOverview(response);
      setOffer(response.offer);
      setErrorCode(null);
      trackRaidEvent('raid_offer_received', { playerId: response.player.id, opponentPower: response.offer.opponent.teamPower, ownPower: response.offer.ownPower });
    } catch (error) { setErrorCode(error instanceof RaidApiError ? error.code : 'SERVER_ERROR'); }
    finally { setAction('idle'); }
  }, [action]);

  const attack = useCallback(async () => {
    if (!offer || action !== 'idle') return;
    setAction('attacking');
    trackRaidEvent('raid_started', { playerId: overview?.player.id ?? 'unknown', offerId: offer.id, opponentPower: offer.opponent.teamPower, ownPower: offer.ownPower });
    try {
      const response = await startRaid(offer.id);
      setBattle(response);
      setOffer(null);
      setErrorCode(null);
    } catch (error) { setErrorCode(error instanceof RaidApiError ? error.code : 'SERVER_ERROR'); }
    finally { setAction('idle'); }
  }, [offer, action, overview]);

  const finishBattle = useCallback(() => {
    if (!battle || trackedBattles.current.has(battle.id)) return;
    trackedBattles.current.add(battle.id);
    const lootTotal = Object.values(battle.loot).reduce((total, value) => total + Number(value), 0);
    const properties = { playerId: battle.attacker.playerId, battleId: battle.id, result: battle.result, duration: battle.durationMs, lootTotal, trophyDelta: battle.attacker.trophyDelta };
    trackRaidEvent('raid_finished', properties);
    trackRaidEvent(battle.result === 'ATTACKER_WIN' ? 'raid_win' : 'raid_loss', properties);
  }, [battle]);

  const clearBattle = useCallback(() => {
    setBattle(null);
    setOffer(null);
    void refresh();
  }, [refresh]);

  return { overview, offer, battle, action, errorCode, refresh, search, attack, finishBattle, clearBattle };
}
