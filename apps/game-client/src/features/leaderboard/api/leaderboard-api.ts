import type { LeaderboardResponse } from '@crown-and-coin/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class LeaderboardApiError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

export async function fetchLeaderboard(signal?: AbortSignal): Promise<LeaderboardResponse> {
  const response = await fetch(`${API_URL}/leaderboard`, {
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    signal,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { code?: string; message?: string } | null;
    throw new LeaderboardApiError(body?.code ?? 'SERVER_ERROR', body?.message ?? 'Failed to load leaderboard.');
  }
  return response.json() as Promise<LeaderboardResponse>;
}
