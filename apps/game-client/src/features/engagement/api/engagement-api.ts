import type {
  EngagementErrorResponse,
  EngagementOverviewResponse,
  EngagementSessionResponse,
  RoyalDecreeClaimResponse,
} from '@crown-and-coin/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class EngagementApiError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    cache: 'no-store',
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as EngagementErrorResponse | null;
    throw new EngagementApiError(body?.code ?? 'SERVER_ERROR', body?.message ?? 'Engagement request failed.');
  }
  return response.json() as Promise<T>;
}

export function fetchEngagement(signal?: AbortSignal): Promise<EngagementOverviewResponse> {
  return request('/engagement', { signal });
}

export function openEngagementSession(idempotencyKey: string, signal?: AbortSignal): Promise<EngagementSessionResponse> {
  return request('/engagement/session', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, signal });
}

export function claimRoyalDecree(): Promise<RoyalDecreeClaimResponse> {
  return request('/engagement/royal-decree/claim', { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() } });
}

export function heartbeatEngagement(): Promise<{ serverTime: string }> {
  return request('/engagement/heartbeat', { method: 'POST', keepalive: true });
}
