import type {
  ArmyErrorResponse,
  ArmyFormationSlotInput,
  ArmyResponse,
  ArmyTrainResponse,
  TroopType,
} from '@crown-and-coin/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ArmyApiError extends Error {
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
    const body = await response.json().catch(() => null) as ArmyErrorResponse | null;
    throw new ArmyApiError(body?.code ?? 'SERVER_ERROR', body?.message ?? 'Army request failed.');
  }
  return response.json() as Promise<T>;
}

export function fetchArmy(signal?: AbortSignal): Promise<ArmyResponse> {
  return request('/army', { signal });
}

export function trainTroops(troopType: TroopType, quantity: number): Promise<ArmyTrainResponse> {
  return request('/army/train', {
    method: 'POST',
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({ troopType, quantity }),
  });
}

export function saveArmyFormation(slots: ArmyFormationSlotInput[]): Promise<ArmyResponse> {
  return request('/army/formation', { method: 'PUT', body: JSON.stringify({ slots }) });
}
