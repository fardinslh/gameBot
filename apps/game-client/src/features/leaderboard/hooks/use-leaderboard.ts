import { useCallback, useEffect, useState } from 'react';
import type { LeaderboardResponse } from '@crown-and-coin/shared';
import { fetchLeaderboard, LeaderboardApiError } from '../api/leaderboard-api';

export function useLeaderboard(isOpen: boolean) {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchLeaderboard(signal);
      setData(response);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (err instanceof LeaderboardApiError) {
        setError(err.message);
      } else {
        setError('Failed to load leaderboard.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [isOpen, load]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  return { data, loading, error, refresh };
}
