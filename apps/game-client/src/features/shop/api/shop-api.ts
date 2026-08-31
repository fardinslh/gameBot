import type {
  EquipProfileCrestResponse,
  ProfileCrestKey,
  ShopErrorResponse,
  ShopPurchaseItemKey,
  ShopPurchaseResponse,
  ShopStateResponse,
} from '@crown-and-coin/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ShopApiError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    cache: 'no-store',
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as ShopErrorResponse | null;
    throw new ShopApiError(body?.code ?? 'SERVER_ERROR', body?.message ?? 'Shop request failed.');
  }
  return response.json() as Promise<T>;
}

export function fetchShop(signal?: AbortSignal): Promise<ShopStateResponse> {
  return request('/shop', { signal });
}

export function purchaseShopItem(itemKey: ShopPurchaseItemKey, targetId?: string): Promise<ShopPurchaseResponse> {
  return request('/shop/purchases', {
    method: 'POST',
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({ itemKey, ...(targetId ? { targetId } : {}) }),
  });
}

export function equipProfileCrest(itemKey: ProfileCrestKey): Promise<EquipProfileCrestResponse> {
  return request('/shop/cosmetics/profile-crest', { method: 'PUT', body: JSON.stringify({ itemKey }) });
}
