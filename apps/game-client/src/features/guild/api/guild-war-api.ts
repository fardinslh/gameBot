import type {
  GuildWarDetails,
  GuildWarOverviewResponse,
  StartWarPayload,
  WarAttackPayload,
  WarAttackResult,
} from '@crown-and-coin/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    let errorMsg = 'Failed to execute war operation';
    try {
      const err = await res.json();
      errorMsg = err.message || errorMsg;
    } catch {}
    throw new Error(errorMsg);
  }

  return res.json();
}

export const guildWarApi = {
  async getWarOverview(): Promise<GuildWarOverviewResponse> {
    return request<GuildWarOverviewResponse>('/guilds/war');
  },

  async startWar(payload?: StartWarPayload): Promise<GuildWarDetails> {
    return request<GuildWarDetails>('/guilds/war/start', {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    });
  },

  async attackBase(payload: WarAttackPayload): Promise<WarAttackResult> {
    return request<WarAttackResult>('/guilds/war/attack', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async simulateBattleDay(): Promise<GuildWarDetails> {
    return request<GuildWarDetails>('/guilds/war/simulate-battle-day', {
      method: 'POST',
    });
  },

  async simulateWarEnd(): Promise<GuildWarDetails> {
    return request<GuildWarDetails>('/guilds/war/simulate-war-end', {
      method: 'POST',
    });
  },

  async claimSpoils(): Promise<{ goldClaimed: string; newBalance: string }> {
    return request<{ goldClaimed: string; newBalance: string }>('/guilds/war/claim-spoils', {
      method: 'POST',
    });
  },
};
