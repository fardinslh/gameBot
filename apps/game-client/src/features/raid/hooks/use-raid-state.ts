'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  BattleReplayResponse,
  DefenseInboxResponse,
  RaidOverviewResponse,
  RaidSearchResponse,
  RevengePreviewResponse,
} from '@crown-and-coin/shared';
import {
  fetchBattle,
  fetchRaid,
  fetchRaidInbox,
  fetchRevengePreview,
  markRaidInboxRead,
  RaidApiError,
  searchRaid,
  startRaid,
  startRevenge,
} from '../api/raid-api';
import { trackRaidEvent } from '../analytics/raid-analytics';
import { useGameAudio } from '@/features/audio/audio-provider';

export type RaidView = 'overview' | 'inbox';

export function useRaidState(initialView: RaidView = 'overview') {
  const audio = useGameAudio();
  const [overview, setOverview] = useState<RaidOverviewResponse | null>(null);
  const [offer, setOffer] = useState<RaidSearchResponse['offer'] | null>(null);
  const [battle, setBattle] = useState<BattleReplayResponse | null>(null);
  const [inbox, setInbox] = useState<DefenseInboxResponse | null>(null);
  const [revengePreview, setRevengePreview] = useState<RevengePreviewResponse | null>(null);
  const [battleDetail, setBattleDetail] = useState<BattleReplayResponse | null>(null);
  const [view, setView] = useState<RaidView>(initialView);
  const [action, setAction] = useState<'loading' | 'idle' | 'searching' | 'attacking' | 'loading-inbox' | 'loading-preview'>('loading');
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

  const openInbox = useCallback(async () => {
    setView('inbox');
    setAction('loading-inbox');
    setRevengePreview(null);
    setBattleDetail(null);
    try {
      const response = await fetchRaidInbox();
      setInbox(response);
      if (response.unreadCount > 0) audio.playSfx(response.entries.some((entry) => entry.revengeStatus === 'AVAILABLE') ? 'revenge_available' : 'incoming_attack');
      setErrorCode(null);
      if (response.unreadCount > 0) {
        await markRaidInboxRead();
        setInbox((current) => current ? { ...current, unreadCount: 0 } : current);
      }
    } catch (error) {
      setErrorCode(error instanceof RaidApiError ? error.code : 'SERVER_ERROR');
    } finally { setAction('idle'); }
  }, [audio]);

  useEffect(() => {
    if (initialView === 'inbox') void openInbox();
  }, [initialView, openInbox]);

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
      audio.playSfx('find_enemy');
      trackRaidEvent('raid_offer_received', { playerId: response.player.id, opponentPower: response.offer.opponent.teamPower, ownPower: response.offer.ownPower });
    } catch (error) { setErrorCode(error instanceof RaidApiError ? error.code : 'SERVER_ERROR'); }
    finally { setAction('idle'); }
  }, [action, audio]);

  const attack = useCallback(async () => {
    if (!offer || action !== 'idle') return;
    setAction('attacking');
    audio.playSfx('attack_start');
    trackRaidEvent('raid_started', { playerId: overview?.player.id ?? 'unknown', offerId: offer.id, opponentPower: offer.opponent.teamPower, ownPower: offer.ownPower });
    try {
      const response = await startRaid(offer.id);
      setBattle(response);
      setOffer(null);
      setErrorCode(null);
    } catch (error) { setErrorCode(error instanceof RaidApiError ? error.code : 'SERVER_ERROR'); }
    finally { setAction('idle'); }
  }, [offer, action, overview, audio]);

  const openRevengePreview = useCallback(async (revengeTargetId: string) => {
    if (action !== 'idle') return;
    setAction('loading-preview');
    try {
      setRevengePreview(await fetchRevengePreview(revengeTargetId));
      setErrorCode(null);
    } catch (error) { setErrorCode(error instanceof RaidApiError ? error.code : 'SERVER_ERROR'); }
    finally { setAction('idle'); }
  }, [action]);

  const revenge = useCallback(async () => {
    if (!revengePreview || action !== 'idle') return;
    setAction('attacking');
    audio.playSfx('attack_start');
    try {
      setBattle(await startRevenge(revengePreview.revengeTargetId));
      setRevengePreview(null);
      setBattleDetail(null);
      setErrorCode(null);
    } catch (error) { setErrorCode(error instanceof RaidApiError ? error.code : 'SERVER_ERROR'); }
    finally { setAction('idle'); }
  }, [revengePreview, action, audio]);

  const openBattleDetail = useCallback(async (battleId: string) => {
    if (action !== 'idle') return;
    setAction('loading-preview');
    try {
      setBattleDetail(await fetchBattle(battleId));
      setErrorCode(null);
    } catch (error) { setErrorCode(error instanceof RaidApiError ? error.code : 'SERVER_ERROR'); }
    finally { setAction('idle'); }
  }, [action]);

  const finishBattle = useCallback(() => {
    if (!battle || trackedBattles.current.has(battle.id)) return;
    trackedBattles.current.add(battle.id);
    const lootTotal = Object.values(battle.loot).reduce((total, value) => total + Number(value), 0);
    const properties = { playerId: battle.attacker.playerId, battleId: battle.id, result: battle.result, duration: battle.durationMs, lootTotal, trophyDelta: battle.attacker.trophyDelta };
    trackRaidEvent('raid_finished', properties);
    trackRaidEvent(battle.result === 'ATTACKER_WIN' ? 'raid_win' : 'raid_loss', properties);
  }, [battle]);

  const clearBattle = useCallback(() => {
    const wasRevenge = battle?.type === 'REVENGE';
    setBattle(null);
    setOffer(null);
    if (wasRevenge) void openInbox();
    else void refresh();
  }, [battle, openInbox, refresh]);

  const closeInbox = useCallback(() => {
    setView('overview');
    setRevengePreview(null);
    setBattleDetail(null);
  }, []);

  return {
    overview, offer, battle, inbox, revengePreview, battleDetail, view, action, errorCode,
    refresh, search, attack, openInbox, closeInbox, openRevengePreview, revenge,
    openBattleDetail, closeBattleDetail: () => setBattleDetail(null),
    closeRevengePreview: () => setRevengePreview(null), finishBattle, clearBattle,
  };
}
