import type {
  AcceptFriendlyChallengeResult,
  FriendlyChallengesResponse,
  GuildFriendlyChallengeItem,
  PostFriendlyChallengePayload,
  WarBattleReplay,
} from '@crown-and-coin/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function fetchFriendlyChallenges(
  signal?: AbortSignal,
): Promise<FriendlyChallengesResponse> {
  const res = await fetch(`${API_BASE}/guilds/scrimmages`, {
    signal,
    headers: { 'content-type': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to fetch friendly challenges' }));
    throw new Error(err.message ?? 'Failed to fetch friendly challenges');
  }
  return res.json();
}

export async function postFriendlyChallenge(
  payload: PostFriendlyChallengePayload,
): Promise<GuildFriendlyChallengeItem> {
  const res = await fetch(`${API_BASE}/guilds/scrimmages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to issue friendly challenge' }));
    throw new Error(err.message ?? 'Failed to issue friendly challenge');
  }
  return res.json();
}

export async function acceptFriendlyChallenge(
  challengeId: string,
): Promise<AcceptFriendlyChallengeResult> {
  const res = await fetch(`${API_BASE}/guilds/scrimmages/${challengeId}/attack`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to attack scrimmage challenge' }));
    throw new Error(err.message ?? 'Failed to attack scrimmage challenge');
  }
  return res.json();
}

export async function fetchBattleReplay(replayId: string): Promise<WarBattleReplay> {
  const res = await fetch(`${API_BASE}/guilds/replays/${replayId}`, {
    headers: { 'content-type': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to load battle replay' }));
    throw new Error(err.message ?? 'Failed to load battle replay');
  }
  return res.json();
}
