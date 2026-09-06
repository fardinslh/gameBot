'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  GuildWarDetails,
  GuildWarOverviewResponse,
  WarAttackResult,
} from '@crown-and-coin/shared';
import { guildWarApi } from '../api/guild-war-api';

export function useGuildWar(inGuild: boolean) {
  const [overview, setOverview] = useState<GuildWarOverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [lastAttackResult, setLastAttackResult] = useState<WarAttackResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    if (!inGuild) return;
    try {
      setLoading(true);
      setError(null);
      const res = await guildWarApi.getWarOverview();
      setOverview(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load war overview');
    } finally {
      setLoading(false);
    }
  }, [inGuild]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const declareWar = useCallback(
    async (warSize = 5): Promise<boolean> => {
      try {
        setPending(true);
        setError(null);
        const details = await guildWarApi.startWar({ warSize });
        setOverview((prev) =>
          prev
            ? {
                ...prev,
                activeWar: details,
              }
            : null,
        );
        return true;
      } catch (err: any) {
        setError(err.message || 'Failed to declare war');
        return false;
      } finally {
        setPending(false);
      }
    },
    [],
  );

  const attackBase = useCallback(
    async (defenderPlayerId: string): Promise<WarAttackResult | null> => {
      try {
        setPending(true);
        setError(null);
        const result = await guildWarApi.attackBase({ defenderPlayerId });
        setLastAttackResult(result);
        await fetchOverview();
        return result;
      } catch (err: any) {
        setError(err.message || 'Attack failed');
        return null;
      } finally {
        setPending(false);
      }
    },
    [fetchOverview],
  );

  const fastForwardBattleDay = useCallback(async () => {
    try {
      setPending(true);
      const details = await guildWarApi.simulateBattleDay();
      setOverview((prev) => (prev ? { ...prev, activeWar: details } : null));
    } catch (err: any) {
      setError(err.message || 'Failed to fast-forward');
    } finally {
      setPending(false);
    }
  }, []);

  const fastForwardWarEnd = useCallback(async () => {
    try {
      setPending(true);
      const details = await guildWarApi.simulateWarEnd();
      setOverview((prev) => (prev ? { ...prev, activeWar: details } : null));
    } catch (err: any) {
      setError(err.message || 'Failed to fast-forward');
    } finally {
      setPending(false);
    }
  }, []);

  const claimSpoils = useCallback(async (): Promise<boolean> => {
    try {
      setPending(true);
      setError(null);
      await guildWarApi.claimSpoils();
      await fetchOverview();
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to claim spoils');
      return false;
    } finally {
      setPending(false);
    }
  }, [fetchOverview]);

  return {
    overview,
    war: overview?.activeWar ?? null,
    warRecord: overview?.warRecord ?? null,
    canDeclareWar: overview?.canDeclareWar ?? false,
    loading,
    pending,
    error,
    lastAttackResult,
    clearAttackResult: () => setLastAttackResult(null),
    declareWar,
    attackBase,
    fastForwardBattleDay,
    fastForwardWarEnd,
    claimSpoils,
    refreshWar: fetchOverview,
  };
}
