'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchRaidInbox } from '../api/raid-api';
import { useGameAudio } from '@/features/audio/audio-provider';

export function useInboxCount(): number {
  const audio = useGameAudio();
  const [count, setCount] = useState(0);
  const previousCount = useRef(0);
  const refresh = useCallback(async () => {
    try {
      const inbox = await fetchRaidInbox();
      setCount(inbox.unreadCount);
      if (inbox.unreadCount > previousCount.current) {
        audio.playSfx(inbox.entries.some((entry) => entry.revengeStatus === 'AVAILABLE') ? 'revenge_available' : 'incoming_attack');
      }
      previousCount.current = inbox.unreadCount;
    }
    catch { /* The Kingdom remains usable when the optional badge cannot load. */ }
  }, [audio]);

  useEffect(() => {
    void refresh();
    const onVisibility = (): void => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [refresh]);

  return count;
}
