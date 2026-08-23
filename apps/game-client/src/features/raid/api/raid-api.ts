import type { BattleReplayResponse, RaidErrorResponse, RaidOverviewResponse, RaidSearchResponse } from '@crown-and-coin/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class RaidApiError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    cache: 'no-store',
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as RaidErrorResponse | null;
    throw new RaidApiError(body?.code ?? 'SERVER_ERROR', body?.message ?? 'Raid request failed.');
  }
  return response.json() as Promise<T>;
}

export function fetchRaid(signal?: AbortSignal): Promise<RaidOverviewResponse> {
  return request('/raid', { signal });
}

export function searchRaid(): Promise<RaidSearchResponse> {
  return request('/raid/search', { method: 'POST' });
}

export function startRaid(matchOfferId: string): Promise<BattleReplayResponse> {
  return request('/raid/start', {
    method: 'POST',
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({ matchOfferId }),
  });
}

