import type { OnboardingStateResponse } from '@crown-and-coin/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function request(path: string, method = 'GET', signal?: AbortSignal): Promise<OnboardingStateResponse> {
  const response = await fetch(`${API_URL}${path}`, { method, cache: 'no-store', signal });
  if (!response.ok) throw new Error(`Onboarding request failed (${response.status}).`);
  return response.json() as Promise<OnboardingStateResponse>;
}

export function fetchOnboarding(signal?: AbortSignal): Promise<OnboardingStateResponse> {
  return request('/onboarding', 'GET', signal);
}

export function startOnboarding(): Promise<OnboardingStateResponse> {
  return request('/onboarding/start', 'POST');
}

export function skipOnboarding(): Promise<OnboardingStateResponse> {
  return request('/onboarding/skip', 'POST');
}
