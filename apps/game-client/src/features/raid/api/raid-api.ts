import type {
  BattleReplayResponse,
  DefenseInboxResponse,
  RaidErrorResponse,
  RaidOverviewResponse,
  RaidSearchResponse,
  RevengePreviewResponse,
} from '@crown-and-coin/shared';

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

export function fetchRaidInbox(signal?: AbortSignal): Promise<DefenseInboxResponse> {
  return request('/raid/inbox', { signal });
}

export function markRaidInboxRead(): Promise<{ readCount: number }> {
  return request('/raid/inbox/read', { method: 'POST' });
}

export function fetchRevengePreview(revengeTargetId: string): Promise<RevengePreviewResponse> {
  return request(`/raid/revenge/${revengeTargetId}`);
}

export function startRevenge(revengeTargetId: string): Promise<BattleReplayResponse> {
  return request('/raid/revenge/start', {
    method: 'POST',
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({ revengeTargetId }),
  });
}

export function fetchBattle(battleId: string): Promise<BattleReplayResponse> {
  return request(`/battles/${battleId}`);
}
