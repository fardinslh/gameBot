'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  AcceptFriendlyChallengeResult,
  GuildFriendlyChallengeItem,
  WarBattleReplay,
} from '@crown-and-coin/shared';
import {
  acceptFriendlyChallenge,
  fetchBattleReplay,
  fetchFriendlyChallenges,
  postFriendlyChallenge,
} from '../api/guild-scrimmage-api';

export function useGuildScrimmages(inGuild: boolean) {
  const [challenges, setChallenges] = useState<GuildFriendlyChallengeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeReplay, setActiveReplay] = useState<WarBattleReplay | null>(null);
  const [replayLoading, setReplayLoading] = useState(false);
  const [lastResult, setLastResult] = useState<AcceptFriendlyChallengeResult | null>(null);

  const refreshChallenges = useCallback(
    async (signal?: AbortSignal) => {
      if (!inGuild) return;
      try {
        setError(null);
        const data = await fetchFriendlyChallenges(signal);
        setChallenges(data.challenges);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setError(err.message ?? 'Failed to load friendly challenges');
        }
      } finally {
        setLoading(false);
      }
    },
    [inGuild],
  );

  useEffect(() => {
    if (!inGuild) return;
    setLoading(true);
    const controller = new AbortController();
    void refreshChallenges(controller.signal);
    return () => controller.abort();
  }, [inGuild, refreshChallenges]);

  const handlePostChallenge = useCallback(
    async (message?: string) => {
      setPending(true);
      setError(null);
      try {
        const created = await postFriendlyChallenge({ message });
        setChallenges((prev) => [created, ...prev]);
        return created;
      } catch (err: any) {
        setError(err.message ?? 'Failed to issue friendly challenge');
        throw err;
      } finally {
        setPending(false);
      }
    },
    [],
  );

  const handleAttackChallenge = useCallback(
    async (challengeId: string) => {
      setPending(true);
      setError(null);
      try {
        const result = await acceptFriendlyChallenge(challengeId);
        setLastResult(result);
        setActiveReplay(result.replay);
        await refreshChallenges();
        return result;
      } catch (err: any) {
        setError(err.message ?? 'Failed to complete friendly scrimmage');
        throw err;
      } finally {
        setPending(false);
      }
    },
    [refreshChallenges],
  );

  const handleWatchReplay = useCallback(async (replayId: string) => {
    setReplayLoading(true);
    setError(null);
    try {
      const replay = await fetchBattleReplay(replayId);
      setActiveReplay(replay);
      return replay;
    } catch (err: any) {
      setError(err.message ?? 'Failed to load battle replay');
      throw err;
    } finally {
      setReplayLoading(false);
    }
  }, []);

  return {
    challenges,
    loading,
    pending,
    error,
    activeReplay,
    replayLoading,
    lastResult,
    refreshChallenges,
    postChallenge: handlePostChallenge,
    attackChallenge: handleAttackChallenge,
    watchReplay: handleWatchReplay,
    closeReplay: () => setActiveReplay(null),
    clearResult: () => setLastResult(null),
    clearError: () => setError(null),
  };
}
