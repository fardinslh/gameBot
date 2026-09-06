'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Bell,
  CheckCircle2,
  Crown,
  Flame,
  MessageSquare,
  Pin,
  Send,
  Shield,
  Sparkles,
  Users,
} from 'lucide-react';
import type { Dictionary } from '@/i18n/config';
import { BidiValue } from '@/i18n/bidi';
import type {
  GuildChatFeedResponse,
  GuildChatMessageItem,
  GuildRole,
} from '@crown-and-coin/shared';

interface GuildChatViewProps {
  dictionary: Dictionary;
  feed: GuildChatFeedResponse | null;
  loading: boolean;
  pending: boolean;
  currentUserId?: string;
  onSendMessage(content: string, isAnnouncement?: boolean, isPinned?: boolean): Promise<any>;
}

type ChatFilter = 'ALL' | 'CHAT' | 'SYSTEM';

export function GuildChatView({
  dictionary: t,
  feed,
  loading,
  pending,
  currentUserId,
  onSendMessage,
}: GuildChatViewProps) {
  const [filter, setFilter] = useState<ChatFilter>('ALL');
  const [text, setText] = useState('');
  const [isAnnouncement, setIsAnnouncement] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [feed?.messages.length]);

  if (loading || !feed) {
    return (
      <div className="guild-loading">
        <div className="leaderboard-spinner" />
        <p>{t.guildUi.loadingGuild}</p>
      </div>
    );
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || pending) return;
    try {
      await onSendMessage(text.trim(), isAnnouncement, isPinned);
      setText('');
      setIsAnnouncement(false);
      setIsPinned(false);
    } catch {
      // Error handled by parent hook
    }
  };

  const filteredMessages = feed.messages.filter((m) => {
    if (filter === 'CHAT') return m.type === 'TEXT' || m.type === 'ANNOUNCEMENT';
    if (filter === 'SYSTEM') return m.type === 'SYSTEM';
    return true;
  });

  const getRoleBadge = (role: GuildRole | null) => {
    if (role === 'LEADER') {
      return (
        <span className="guild-chat-role-badge guild-chat-role-badge--leader">
          <Crown size={10} /> {t.guildChatUi.leaderBadge}
        </span>
      );
    }
    if (role === 'OFFICER') {
      return (
        <span className="guild-chat-role-badge guild-chat-role-badge--officer">
          <Shield size={10} /> {t.guildChatUi.officerBadge}
        </span>
      );
    }
    return null;
  };

  return (
    <div className="guild-chat-viewport">
      {/* 1. Pinned Command Announcement */}
      {feed.pinnedAnnouncement ? (
        <div className="guild-chat-pinned-banner">
          <div className="guild-chat-pinned-banner__icon">
            <Pin size={16} />
          </div>
          <div className="guild-chat-pinned-banner__body">
            <div className="guild-chat-pinned-banner__header">
              <strong>{t.guildChatUi.pinnedAnnouncementTitle}</strong>
              <small>
                <BidiValue>{feed.pinnedAnnouncement.senderName}</BidiValue>
              </small>
            </div>
            <p><BidiValue>{feed.pinnedAnnouncement.content}</BidiValue></p>
          </div>
        </div>
      ) : null}

      {/* 2. Filter Navigation */}
      <div className="guild-chat-filters">
        <button
          type="button"
          className={`guild-chat-filter-btn ${filter === 'ALL' ? 'guild-chat-filter-btn--active' : ''}`}
          onClick={() => setFilter('ALL')}
        >
          {t.guildChatUi.filterAll}
        </button>
        <button
          type="button"
          className={`guild-chat-filter-btn ${filter === 'CHAT' ? 'guild-chat-filter-btn--active' : ''}`}
          onClick={() => setFilter('CHAT')}
        >
          <MessageSquare size={13} /> {t.guildChatUi.filterChat}
        </button>
        <button
          type="button"
          className={`guild-chat-filter-btn ${filter === 'SYSTEM' ? 'guild-chat-filter-btn--active' : ''}`}
          onClick={() => setFilter('SYSTEM')}
        >
          <Bell size={13} /> {t.guildChatUi.filterSystem}
        </button>
      </div>

      {/* 3. Message Feed Container */}
      <div className="guild-chat-feed">
        {filteredMessages.length === 0 ? (
          <div className="guild-chat-empty">
            <MessageSquare size={32} />
            <p>{t.guildChatUi.noMessages}</p>
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const isOwnMessage = msg.senderId === currentUserId;

            if (msg.type === 'SYSTEM') {
              return (
                <div key={msg.id} className="guild-chat-system-row">
                  <span className="guild-chat-system-badge">
                    <Sparkles size={12} /> {t.guildChatUi.systemBadge}
                  </span>
                  <span className="guild-chat-system-text">
                    <BidiValue>{msg.content}</BidiValue>
                  </span>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`guild-chat-message-row ${isOwnMessage ? 'guild-chat-message-row--own' : ''}`}
              >
                <div className={`guild-chat-bubble ${msg.type === 'ANNOUNCEMENT' ? 'guild-chat-bubble--announcement' : ''}`}>
                  <div className="guild-chat-bubble__meta">
                    <strong className="guild-chat-bubble__author">
                      <BidiValue>{msg.senderName}</BidiValue>
                    </strong>
                    {getRoleBadge(msg.senderRole)}
                    {msg.isPinned ? (
                      <span className="guild-chat-bubble__pin-tag">
                        <Pin size={10} />
                      </span>
                    ) : null}
                  </div>
                  <p className="guild-chat-bubble__text">
                    <BidiValue>{msg.content}</BidiValue>
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 4. Message Input Composer */}
      <form onSubmit={handleSend} className="guild-chat-composer">
        {feed.canPostAnnouncement ? (
          <div className="guild-chat-composer__options">
            <label className="guild-chat-checkbox-label">
              <input
                type="checkbox"
                checked={isAnnouncement}
                onChange={(e) => {
                  setIsAnnouncement(e.target.checked);
                  if (!e.target.checked) setIsPinned(false);
                }}
              />
              <span>{t.guildChatUi.pinnedAnnouncementTitle}</span>
            </label>

            {isAnnouncement ? (
              <label className="guild-chat-checkbox-label">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                />
                <span>{t.guildChatUi.pinToggle}</span>
              </label>
            ) : null}
          </div>
        ) : null}

        <div className="guild-chat-composer__input-row">
          <input
            type="text"
            maxLength={280}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t.guildChatUi.placeholder}
            className="guild-chat-input"
            disabled={pending}
          />
          <button
            type="submit"
            disabled={pending || !text.trim()}
            className="guild-chat-send-btn"
          >
            <Send size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}
