import type {
  CollectResponse,
  EconomyErrorResponse,
  KingdomStateResponse,
  UpdateKingdomIdentityRequest,
  UpdateKingdomIdentityResponse,
  UpgradeResponse,
} from '@crown-and-coin/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class KingdomApiError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    cache: 'no-store',
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as EconomyErrorResponse | null;
    throw new KingdomApiError(body?.code ?? 'SERVER_ERROR', body?.message ?? 'Kingdom request failed.');
  }
  return response.json() as Promise<T>;
}

export function fetchKingdom(signal?: AbortSignal): Promise<KingdomStateResponse> {
  return request('/kingdom', { signal });
}

export function updateKingdomIdentity(input: UpdateKingdomIdentityRequest): Promise<UpdateKingdomIdentityResponse> {
  return request('/kingdom/identity', { method: 'PUT', body: JSON.stringify(input) });
}

export function collectKingdom(): Promise<CollectResponse> {
  return request('/kingdom/collect', {
    method: 'POST',
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  });
}

export function upgradeBuilding(buildingId: string): Promise<UpgradeResponse> {
  return request(`/kingdom/buildings/${encodeURIComponent(buildingId)}/upgrade`, {
    method: 'POST',
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  });
}

export function collectCompletedBuildingUpgrade(buildingId: string): Promise<UpgradeResponse> {
  return request(`/kingdom/buildings/${encodeURIComponent(buildingId)}/upgrade/collect`, {
    method: 'POST',
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  });
}
