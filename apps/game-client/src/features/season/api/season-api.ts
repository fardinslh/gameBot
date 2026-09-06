import type {
  ClaimSeasonRewardResponse,
  SeasonOverviewResponse,
  SeasonSummary,
} from '@crown-and-coin/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    let errorMsg = 'Failed to execute season operation';
    try {
      const err = await response.json();
      errorMsg = err.message || errorMsg;
    } catch {}
    throw new Error(errorMsg);
  }

  return response.json() as Promise<T>;
}

export const seasonApi = {
  getOverview(): Promise<SeasonOverviewResponse> {
    return request<SeasonOverviewResponse>('/seasons/overview');
  },

  claimRewards(): Promise<ClaimSeasonRewardResponse> {
    return request<ClaimSeasonRewardResponse>('/seasons/claim', {
      method: 'POST',
    });
  },

  simulateEndSeason(): Promise<SeasonSummary> {
    return request<SeasonSummary>('/seasons/simulate-end', {
      method: 'POST',
    });
  },
};
