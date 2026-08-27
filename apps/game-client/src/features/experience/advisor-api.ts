import type { AdvisorTipKey, AdvisorTipsResponse } from '@crown-and-coin/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function request(path: string, method = 'GET', signal?: AbortSignal): Promise<AdvisorTipsResponse> {
  const response = await fetch(`${API_URL}${path}`, { method, cache: 'no-store', signal });
  if (!response.ok) throw new Error(`Advisor tip request failed (${response.status}).`);
  return response.json() as Promise<AdvisorTipsResponse>;
}

export function fetchAdvisorTips(signal?: AbortSignal): Promise<AdvisorTipsResponse> {
  return request('/onboarding/advisor-tips', 'GET', signal);
}

export function dismissAdvisorTip(tipKey: AdvisorTipKey): Promise<AdvisorTipsResponse> {
  return request(`/onboarding/advisor-tips/${tipKey}`, 'POST');
}
