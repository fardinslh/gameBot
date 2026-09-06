import type {
  CreateGuildRequest,
  DonateTroopsPayload,
  DonateTroopsResult,
  GuildDetailsResponse,
  GuildLeaderboardResponse,
  GuildOverviewResponse,
  GuildSummary,
  RequestTroopsPayload,
} from '@crown-and-coin/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class GuildApiError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

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
    const body = (await response.json().catch(() => null)) as { code?: string; message?: string } | null;
    throw new GuildApiError(
      body?.code ?? (response.status === 400 ? 'BAD_REQUEST' : response.status === 404 ? 'NOT_FOUND' : 'SERVER_ERROR'),
      Array.isArray(body?.message) ? body.message.join('; ') : (body?.message ?? 'Request failed'),
    );
  }

  return response.json() as Promise<T>;
}

export function fetchGuildOverview(signal?: AbortSignal): Promise<GuildOverviewResponse> {
  return request<GuildOverviewResponse>('/guilds/overview', { signal });
}

export function createGuild(payload: CreateGuildRequest): Promise<GuildOverviewResponse> {
  return request<GuildOverviewResponse>('/guilds', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function searchGuilds(query?: string, minTrophies?: number): Promise<GuildSummary[]> {
  const params = new URLSearchParams();
  if (query) params.set('query', query);
  if (minTrophies !== undefined) params.set('minTrophies', minTrophies.toString());
  const queryStr = params.toString() ? `?${params.toString()}` : '';
  return request<GuildSummary[]>(`/guilds/search${queryStr}`);
}

export function joinGuild(guildId: string): Promise<GuildOverviewResponse> {
  return request<GuildOverviewResponse>(`/guilds/${guildId}/join`, {
    method: 'POST',
  });
}

export function leaveGuild(): Promise<GuildOverviewResponse> {
  return request<GuildOverviewResponse>('/guilds/leave', {
    method: 'POST',
  });
}

export function kickMember(memberPlayerId: string): Promise<GuildDetailsResponse> {
  return request<GuildDetailsResponse>('/guilds/kick', {
    method: 'POST',
    body: JSON.stringify({ memberPlayerId }),
  });
}

export function setMemberRole(memberPlayerId: string, role: 'OFFICER' | 'MEMBER'): Promise<GuildDetailsResponse> {
  return request<GuildDetailsResponse>('/guilds/role', {
    method: 'POST',
    body: JSON.stringify({ memberPlayerId, role }),
  });
}

export function requestTroops(payload: RequestTroopsPayload): Promise<GuildDetailsResponse> {
  return request<GuildDetailsResponse>('/guilds/request-troops', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function donateTroops(payload: DonateTroopsPayload): Promise<DonateTroopsResult> {
  return request<DonateTroopsResult>('/guilds/donate-troops', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchGuildLeaderboard(signal?: AbortSignal): Promise<GuildLeaderboardResponse> {
  return request<GuildLeaderboardResponse>('/guilds/leaderboard', { signal });
}
