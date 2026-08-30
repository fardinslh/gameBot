import type {
  CampaignBattleStartResponse,
  CampaignErrorResponse,
  CampaignResponse,
  CampaignRewardClaimResponse,
  CampaignStageKey,
} from '@crown-and-coin/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class CampaignApiError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    cache: 'no-store',
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as CampaignErrorResponse | null;
    throw new CampaignApiError(body?.code ?? 'SERVER_ERROR', body?.message ?? 'Campaign request failed.');
  }
  return response.json() as Promise<T>;
}

export function fetchCampaign(signal?: AbortSignal): Promise<CampaignResponse> {
  return request('/campaign', { signal });
}

export function startCampaignStage(stageKey: CampaignStageKey): Promise<CampaignBattleStartResponse> {
  return request(`/campaign/stages/${stageKey}/start`, {
    method: 'POST',
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  });
}

export function claimCampaignReward(stars: 9 | 18 | 27): Promise<CampaignRewardClaimResponse> {
  return request(`/campaign/rewards/${stars}/claim`, {
    method: 'POST',
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  });
}
