import type {
  DonateToTreasuryPayload,
  DonateToTreasuryResponse,
  GuildPerkType,
  GuildTreasuryOverviewResponse,
  UpgradeGuildPerkPayload,
  UpgradeGuildPerkResponse,
} from '@crown-and-coin/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class GuildTreasuryApiError extends Error {
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
    throw new GuildTreasuryApiError(
      body?.code ?? (response.status === 400 ? 'BAD_REQUEST' : response.status === 403 ? 'FORBIDDEN' : 'SERVER_ERROR'),
      Array.isArray(body?.message) ? body.message.join('; ') : (body?.message ?? 'Request failed'),
    );
  }

  return response.json() as Promise<T>;
}

export function fetchTreasuryOverview(signal?: AbortSignal): Promise<GuildTreasuryOverviewResponse> {
  return request<GuildTreasuryOverviewResponse>('/guilds/treasury/overview', { signal });
}

export function donateToTreasury(payload: DonateToTreasuryPayload): Promise<DonateToTreasuryResponse> {
  return request<DonateToTreasuryResponse>('/guilds/treasury/donate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function upgradeGuildPerk(payload: UpgradeGuildPerkPayload): Promise<UpgradeGuildPerkResponse> {
  return request<UpgradeGuildPerkResponse>('/guilds/perks/upgrade', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
