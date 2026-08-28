import type { RetentionClaimResponse, RetentionErrorResponse, RetentionStateResponse } from '@crown-and-coin/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class RetentionApiError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    cache: 'no-store',
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as RetentionErrorResponse | null;
    throw new RetentionApiError(body?.code ?? 'SERVER_ERROR', body?.message ?? 'Retention request failed.');
  }
  return response.json() as Promise<T>;
}

const claim = (path: string): Promise<RetentionClaimResponse> => request(path, {
  method: 'POST',
  headers: { 'Idempotency-Key': crypto.randomUUID() },
});

export function fetchRetention(signal?: AbortSignal): Promise<RetentionStateResponse> {
  return request('/retention', { signal });
}

export function claimMission(missionId: string): Promise<RetentionClaimResponse> {
  return claim(`/retention/missions/${encodeURIComponent(missionId)}/claim`);
}

export function claimDailyBonus(): Promise<RetentionClaimResponse> {
  return claim('/retention/daily/bonus/claim');
}

export function claimAchievement(achievementKey: string, tier: number): Promise<RetentionClaimResponse> {
  return claim(`/retention/achievements/${encodeURIComponent(achievementKey)}/${tier}/claim`);
}

export function claimDailyReturn(): Promise<RetentionClaimResponse> {
  return claim('/retention/daily-return/claim');
}
