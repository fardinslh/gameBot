'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  GuildChatFeedResponse,
  GuildChatMessageItem,
  GuildWarCalloutItem,
  SetWarCalloutPayload,
  WarRoomStrategyResponse,
} from '@crown-and-coin/shared';
import {
  fetchGuildChatFeed,
  fetchWarRoomStrategy,
  sendGuildChatMessage,
  setWarRoomCallout,
} from '../api/guild-chat-api';

export function useGuildChat(inGuild: boolean, hasActiveWar: boolean) {
  const [feed, setFeed] = useState<GuildChatFeedResponse | null>(null);
  const [strategy, setStrategy] = useState<WarRoomStrategyResponse | null>(null);
  const [loading, setLoading] = useState(inGuild);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshChat = useCallback(async (signal?: AbortSignal) => {
    if (!inGuild) return;
    try {
      const data = await fetchGuildChatFeed(50, signal);
      setFeed(data);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message ?? 'Failed to load guild chat');
      }
    } finally {
      setLoading(false);
    }
  }, [inGuild]);

  const refreshStrategy = useCallback(async (signal?: AbortSignal) => {
    if (!inGuild || !hasActiveWar) {
      setStrategy(null);
      return;
    }
    try {
      const data = await fetchWarRoomStrategy(signal);
      setStrategy(data);
    } catch {
      // Benign if no war is active
    }
  }, [inGuild, hasActiveWar]);

  useEffect(() => {
    if (!inGuild) {
      setFeed(null);
      setStrategy(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    void refreshChat(controller.signal);
    void refreshStrategy(controller.signal);
    return () => controller.abort();
  }, [inGuild, refreshChat, refreshStrategy]);

  const sendMessage = useCallback(
    async (content: string, isAnnouncement?: boolean, isPinned?: boolean): Promise<GuildChatMessageItem> => {
      setPending(true);
      setError(null);
      try {
        const msg = await sendGuildChatMessage({
          content,
          isAnnouncement,
          isPinned,
        });
        await refreshChat();
        return msg;
      } catch (err: any) {
        setError(err.message ?? 'Failed to send message');
        throw err;
      } finally {
        setPending(false);
      }
    },
    [refreshChat],
  );

  const setCallout = useCallback(
    async (payload: SetWarCalloutPayload): Promise<GuildWarCalloutItem> => {
      setPending(true);
      setError(null);
      try {
        const callout = await setWarRoomCallout(payload);
        await Promise.all([refreshStrategy(), refreshChat()]);
        return callout;
      } catch (err: any) {
        setError(err.message ?? 'Failed to set strategy callout');
        throw err;
      } finally {
        setPending(false);
      }
    },
    [refreshChat, refreshStrategy],
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    feed,
    strategy,
    loading,
    pending,
    error,
    sendMessage,
    setCallout,
    refreshChat,
    refreshStrategy,
    clearError,
  };
}
