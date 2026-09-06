'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  CreateGuildRequest,
  DonateTroopsResult,
  GuildLeaderboardResponse,
  GuildOverviewResponse,
  GuildSummary,
  TroopType,
} from '@crown-and-coin/shared';
import {
  createGuild as apiCreateGuild,
  donateTroops as apiDonateTroops,
  fetchGuildLeaderboard,
  fetchGuildOverview,
  joinGuild as apiJoinGuild,
  kickMember as apiKickMember,
  leaveGuild as apiLeaveGuild,
  requestTroops as apiRequestTroops,
  searchGuilds as apiSearchGuilds,
  setMemberRole as apiSetMemberRole,
} from '../api/guild-api';

export type GuildTab = 'requests' | 'war' | 'perks' | 'chat' | 'roster' | 'leaderboard';

export function useGuildState() {
  const [overview, setOverview] = useState<GuildOverviewResponse | null>(null);
  const [leaderboard, setLeaderboard] = useState<GuildLeaderboardResponse | null>(null);
  const [searchResults, setSearchResults] = useState<GuildSummary[]>([]);
  const [activeTab, setActiveTab] = useState<GuildTab>('requests');
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [donationReward, setDonationReward] = useState<DonateTroopsResult | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      setError(null);
      const data = await fetchGuildOverview(signal);
      setOverview(data);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message ?? 'Failed to load guild data');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  const loadLeaderboard = useCallback(async () => {
    try {
      const data = await fetchGuildLeaderboard();
      setLeaderboard(data);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load guild leaderboard');
    }
  }, []);

  const search = useCallback(async (query?: string, minTrophies?: number) => {
    try {
      setError(null);
      const data = await apiSearchGuilds(query, minTrophies);
      setSearchResults(data);
    } catch (err: any) {
      setError(err.message ?? 'Failed to search guilds');
    }
  }, []);

  const handleCreateGuild = useCallback(async (payload: CreateGuildRequest) => {
    setActionPending(true);
    setError(null);
    try {
      const res = await apiCreateGuild(payload);
      setOverview(res);
      setActiveTab('requests');
      return true;
    } catch (err: any) {
      setError(err.message ?? 'Failed to create guild');
      return false;
    } finally {
      setActionPending(false);
    }
  }, []);

  const handleJoinGuild = useCallback(async (guildId: string) => {
    setActionPending(true);
    setError(null);
    try {
      const res = await apiJoinGuild(guildId);
      setOverview(res);
      setActiveTab('requests');
      return true;
    } catch (err: any) {
      setError(err.message ?? 'Failed to join guild');
      return false;
    } finally {
      setActionPending(false);
    }
  }, []);

  const handleLeaveGuild = useCallback(async () => {
    setActionPending(true);
    setError(null);
    try {
      const res = await apiLeaveGuild();
      setOverview(res);
      return true;
    } catch (err: any) {
      setError(err.message ?? 'Failed to leave guild');
      return false;
    } finally {
      setActionPending(false);
    }
  }, []);

  const handleKickMember = useCallback(async (memberPlayerId: string) => {
    setActionPending(true);
    setError(null);
    try {
      const details = await apiKickMember(memberPlayerId);
      setOverview((prev) => (prev ? { ...prev, guild: details } : null));
      return true;
    } catch (err: any) {
      setError(err.message ?? 'Failed to kick member');
      return false;
    } finally {
      setActionPending(false);
    }
  }, []);

  const handleSetRole = useCallback(async (memberPlayerId: string, role: 'OFFICER' | 'MEMBER') => {
    setActionPending(true);
    setError(null);
    try {
      const details = await apiSetMemberRole(memberPlayerId, role);
      setOverview((prev) => (prev ? { ...prev, guild: details } : null));
      return true;
    } catch (err: any) {
      setError(err.message ?? 'Failed to update member role');
      return false;
    } finally {
      setActionPending(false);
    }
  }, []);

  const handleRequestTroops = useCallback(async (troopType: TroopType) => {
    setActionPending(true);
    setError(null);
    try {
      const details = await apiRequestTroops({ troopType });
      setOverview((prev) => (prev ? { ...prev, guild: details } : null));
      return true;
    } catch (err: any) {
      setError(err.message ?? 'Failed to request reinforcements');
      return false;
    } finally {
      setActionPending(false);
    }
  }, []);

  const handleDonateTroops = useCallback(async (requestId: string, amount = 1) => {
    setActionPending(true);
    setError(null);
    try {
      const result = await apiDonateTroops({ requestId, amount });
      setDonationReward(result);
      await refresh();
      return true;
    } catch (err: any) {
      setError(err.message ?? 'Failed to donate troops');
      return false;
    } finally {
      setActionPending(false);
    }
  }, [refresh]);

  return {
    overview,
    leaderboard,
    searchResults,
    activeTab,
    loading,
    actionPending,
    error,
    donationReward,
    clearDonationReward: () => setDonationReward(null),
    setActiveTab,
    refresh,
    loadLeaderboard,
    search,
    createGuild: handleCreateGuild,
    joinGuild: handleJoinGuild,
    leaveGuild: handleLeaveGuild,
    kickMember: handleKickMember,
    setRole: handleSetRole,
    requestTroops: handleRequestTroops,
    donateTroops: handleDonateTroops,
    clearError: () => setError(null),
  };
}
