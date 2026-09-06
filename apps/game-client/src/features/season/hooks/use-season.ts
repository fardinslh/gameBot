'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  ClaimSeasonRewardResponse,
  SeasonOverviewResponse,
} from '@crown-and-coin/shared';
import { seasonApi } from '../api/season-api';

export function useSeason(enabled = true) {
  const [overview, setOverview] = useState<SeasonOverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimSuccess, setClaimSuccess] = useState<ClaimSeasonRewardResponse | null>(null);

  const fetchOverview = useCallback(async () => {
    if (!enabled) return;
    try {
      setLoading(true);
      setError(null);
      const res = await seasonApi.getOverview();
      setOverview(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load season details');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const claimRewards = useCallback(async (): Promise<boolean> => {
    try {
      setPending(true);
      setError(null);
      const res = await seasonApi.claimRewards();
      setClaimSuccess(res);
      await fetchOverview();
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to claim season rewards');
      return false;
    } finally {
      setPending(false);
    }
  }, [fetchOverview]);

  const simulateEndSeason = useCallback(async (): Promise<boolean> => {
    try {
      setPending(true);
      setError(null);
      await seasonApi.simulateEndSeason();
      await fetchOverview();
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to simulate season conclusion');
      return false;
    } finally {
      setPending(false);
    }
  }, [fetchOverview]);

  return {
    overview,
    loading,
    pending,
    error,
    claimSuccess,
    clearClaimSuccess: () => setClaimSuccess(null),
    claimRewards,
    simulateEndSeason,
    refresh: fetchOverview,
  };
}
