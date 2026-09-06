'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  DonateToTreasuryResponse,
  GuildPerkType,
  GuildTreasuryOverviewResponse,
  UpgradeGuildPerkResponse,
} from '@crown-and-coin/shared';
import {
  donateToTreasury as apiDonateToTreasury,
  fetchTreasuryOverview,
  upgradeGuildPerk as apiUpgradeGuildPerk,
} from '../api/guild-treasury-api';

export function useGuildTreasury(inGuild: boolean) {
  const [treasury, setTreasury] = useState<GuildTreasuryOverviewResponse | null>(null);
  const [loading, setLoading] = useState(inGuild);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastDonationResult, setLastDonationResult] = useState<DonateToTreasuryResponse | null>(null);
  const [lastUpgradeResult, setLastUpgradeResult] = useState<UpgradeGuildPerkResponse | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!inGuild) return;
    try {
      setError(null);
      const data = await fetchTreasuryOverview(signal);
      setTreasury(data);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message ?? 'Failed to load guild treasury');
      }
    } finally {
      setLoading(false);
    }
  }, [inGuild]);

  useEffect(() => {
    if (!inGuild) {
      setTreasury(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [inGuild, refresh]);

  const donate = useCallback(
    async (amount: string) => {
      setPending(true);
      setError(null);
      try {
        const result = await apiDonateToTreasury({ amount });
        setLastDonationResult(result);
        await refresh();
        return result;
      } catch (err: any) {
        setError(err.message ?? 'Failed to donate to treasury');
        throw err;
      } finally {
        setPending(false);
      }
    },
    [refresh],
  );

  const upgrade = useCallback(
    async (perkType: GuildPerkType) => {
      setPending(true);
      setError(null);
      try {
        const result = await apiUpgradeGuildPerk({ perkType });
        setLastUpgradeResult(result);
        await refresh();
        return result;
      } catch (err: any) {
        setError(err.message ?? 'Failed to upgrade perk');
        throw err;
      } finally {
        setPending(false);
      }
    },
    [refresh],
  );

  const clearDonationResult = useCallback(() => setLastDonationResult(null), []);
  const clearUpgradeResult = useCallback(() => setLastUpgradeResult(null), []);
  const clearError = useCallback(() => setError(null), []);

  return {
    treasury,
    loading,
    pending,
    error,
    lastDonationResult,
    lastUpgradeResult,
    donate,
    upgrade,
    refresh,
    clearDonationResult,
    clearUpgradeResult,
    clearError,
  };
}
