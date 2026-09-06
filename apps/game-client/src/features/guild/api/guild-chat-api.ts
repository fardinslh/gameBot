import type {
  GuildChatFeedResponse,
  GuildChatMessageItem,
  GuildWarCalloutItem,
  SendGuildChatMessagePayload,
  SetWarCalloutPayload,
  WarRoomStrategyResponse,
} from '@crown-and-coin/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class GuildChatApiError extends Error {
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
    throw new GuildChatApiError(
      body?.code ?? (response.status === 400 ? 'BAD_REQUEST' : response.status === 403 ? 'FORBIDDEN' : 'SERVER_ERROR'),
      Array.isArray(body?.message) ? body.message.join('; ') : (body?.message ?? 'Request failed'),
    );
  }

  return response.json() as Promise<T>;
}

export function fetchGuildChatFeed(limit = 50, signal?: AbortSignal): Promise<GuildChatFeedResponse> {
  return request<GuildChatFeedResponse>(`/guilds/chat/feed?limit=${limit}`, { signal });
}

export function sendGuildChatMessage(payload: SendGuildChatMessagePayload): Promise<GuildChatMessageItem> {
  return request<GuildChatMessageItem>('/guilds/chat/messages', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchWarRoomStrategy(signal?: AbortSignal): Promise<WarRoomStrategyResponse> {
  return request<WarRoomStrategyResponse>('/guilds/war/strategy', { signal });
}

export function setWarRoomCallout(payload: SetWarCalloutPayload): Promise<GuildWarCalloutItem> {
  return request<GuildWarCalloutItem>('/guilds/war/callout', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
