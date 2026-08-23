import type {
  HeroErrorResponse,
  HeroesResponse,
  HeroUpgradeResponse,
  RaidTeamResponse,
} from '@crown-and-coin/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class HeroApiError extends Error {
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
    const body = await response.json().catch(() => null) as HeroErrorResponse | null;
    throw new HeroApiError(body?.code ?? 'SERVER_ERROR', body?.message ?? 'Hero request failed.');
  }
  return response.json() as Promise<T>;
}

export function fetchHeroes(signal?: AbortSignal): Promise<HeroesResponse> {
  return request('/heroes', { signal });
}

export function saveRaidTeam(heroIds: string[]): Promise<RaidTeamResponse> {
  return request('/heroes/team', { method: 'PUT', body: JSON.stringify({ heroIds }) });
}

export function upgradeHero(playerHeroId: string): Promise<HeroUpgradeResponse> {
  return request(`/heroes/${encodeURIComponent(playerHeroId)}/upgrade`, {
    method: 'POST',
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  });
}

