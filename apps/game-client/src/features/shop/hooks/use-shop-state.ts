'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ProfileCrestKey, ShopPurchaseItemKey, ShopStateResponse } from '@crown-and-coin/shared';
import { trackClientEvent } from '@/features/analytics/analytics-client';
import { equipProfileCrest, fetchShop, purchaseShopItem, ShopApiError } from '../api/shop-api';

type ShopAction = 'idle' | 'purchasing' | 'equipping';

export function useShopState(trackOpen = true) {
  const [state, setState] = useState<ShopStateResponse | null>(null);
  const [action, setAction] = useState<ShopAction>('idle');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetchShop(signal);
      setState(response);
      setErrorCode(null);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setErrorCode(error instanceof ShopApiError ? error.code : 'SERVER_ERROR');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    if (trackOpen) trackClientEvent('shop_opened');
    return () => controller.abort();
  }, [refresh, trackOpen]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(null), 2_200);
    return () => window.clearTimeout(timer);
  }, [success]);

  const purchase = useCallback(async (itemKey: ShopPurchaseItemKey, targetId?: string) => {
    if (action !== 'idle') return false;
    setAction('purchasing');
    setSuccess(null);
    try {
      const response = await purchaseShopItem(itemKey, targetId);
      setState(response.shop);
      setErrorCode(null);
      setSuccess(response.target.type);
      window.dispatchEvent(new CustomEvent('crown:shop-updated', { detail: response }));
      return true;
    } catch (error) {
      const code = error instanceof ShopApiError ? error.code : 'SERVER_ERROR';
      setErrorCode(code);
      trackClientEvent('shop_purchase_failed', { itemKey, errorCode: code });
      return false;
    } finally { setAction('idle'); }
  }, [action]);

  const equip = useCallback(async (itemKey: ProfileCrestKey) => {
    if (action !== 'idle') return false;
    setAction('equipping');
    setSuccess(null);
    try {
      const response = await equipProfileCrest(itemKey);
      setState(response.shop);
      setErrorCode(null);
      setSuccess('PROFILE_CREST_EQUIPPED');
      window.dispatchEvent(new CustomEvent('crown:crest-changed', { detail: response.equippedProfileCrest }));
      return true;
    } catch (error) {
      setErrorCode(error instanceof ShopApiError ? error.code : 'SERVER_ERROR');
      return false;
    } finally { setAction('idle'); }
  }, [action]);

  return { state, action, errorCode, success, refresh, purchase, equip, clearError: () => setErrorCode(null) };
}
