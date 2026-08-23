'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchRaidInbox } from '../api/raid-api';

export function useInboxCount(): number {
  const [count, setCount] = useState(0);
  const refresh = useCallback(async () => {
    try { setCount((await fetchRaidInbox()).unreadCount); }
    catch { /* The Kingdom remains usable when the optional badge cannot load. */ }
  }, []);

  useEffect(() => {
    void refresh();
    const onVisibility = (): void => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [refresh]);

  return count;
}
