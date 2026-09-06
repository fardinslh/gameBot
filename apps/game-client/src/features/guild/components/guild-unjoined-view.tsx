'use client';

import { useState } from 'react';
import { Plus, Search, Shield, Trophy, Users } from 'lucide-react';
import type {
  GuildLeaderboardResponse,
  GuildSummary,
} from '@crown-and-coin/shared';
import type { Dictionary } from '@/i18n/config';
import { BidiValue } from '@/i18n/bidi';
import { GuildCrestBadge } from './guild-crest';
import { GuildLeaderboardView } from './guild-leaderboard-view';

interface GuildUnjoinedViewProps {
  suggestedGuilds: GuildSummary[];
  searchResults: GuildSummary[];
  leaderboard: GuildLeaderboardResponse | null;
  dictionary: Dictionary;
  onSearch(query: string): void;
  onJoin(guildId: string): Promise<boolean>;
  onOpenCreate(): void;
  onLoadLeaderboard(): Promise<void>;
  pending: boolean;
}

export function GuildUnjoinedView({
  suggestedGuilds,
  searchResults,
  leaderboard,
  dictionary: t,
  onSearch,
  onJoin,
  onOpenCreate,
  onLoadLeaderboard,
  pending,
}: GuildUnjoinedViewProps) {
  const [tab, setTab] = useState<'browse' | 'leaderboard'>('browse');
  const [searchQuery, setSearchQuery] = useState('');

  const displayGuilds = searchQuery.trim() ? searchResults : suggestedGuilds;

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    onSearch(val);
  };

  return (
    <div className="guild-unjoined-view">
      {/* Hero Header */}
      <div className="guild-unjoined-hero">
        <div className="guild-unjoined-hero__icon">
          <Shield size={32} />
        </div>
        <h2>{t.guildUi.unjoinedTitle}</h2>
        <p>{t.guildUi.unjoinedSubtitle}</p>
        <button
          className="guild-btn guild-btn--primary guild-create-trigger"
          onClick={onOpenCreate}
          type="button"
        >
          <Plus size={16} /> {t.guildUi.createGuild}
        </button>
      </div>

      {/* Tabs: Browse vs Leaderboard */}
      <div className="guild-tabs" role="tablist">
        <button
          className={`guild-tab-btn ${tab === 'browse' ? 'guild-tab-btn--active' : ''}`}
          onClick={() => setTab('browse')}
          role="tab"
          type="button"
        >
          <Users size={15} /> {t.guildUi.browseGuilds}
        </button>
        <button
          className={`guild-tab-btn ${tab === 'leaderboard' ? 'guild-tab-btn--active' : ''}`}
          onClick={() => setTab('leaderboard')}
          role="tab"
          type="button"
        >
          <Trophy size={15} /> {t.guildUi.topGuilds}
        </button>
      </div>

      {tab === 'leaderboard' ? (
        <GuildLeaderboardView
          dictionary={t}
          leaderboard={leaderboard}
          onLoad={onLoadLeaderboard}
        />
      ) : (
        <div className="guild-browse-content">
          {/* Search Bar */}
          <div className="guild-search-bar">
            <Search size={16} />
            <input
              placeholder={t.guildUi.searchPlaceholder}
              value={searchQuery}
              onChange={handleSearchChange}
            />
          </div>

          {/* List of Guilds */}
          <div className="guild-cards-list">
            {displayGuilds.length === 0 ? (
              <div className="guild-empty-browse">
                <Shield size={30} />
                <p>{t.guildUi.noGuildsFound}</p>
              </div>
            ) : (
              displayGuilds.map((guild) => (
                <div key={guild.id} className="guild-card">
                  <div className="guild-card__header">
                    <GuildCrestBadge crest={guild.crest} size="md" />
                    <div className="guild-card__title">
                      <div className="guild-card__name-row">
                        <strong><BidiValue>{guild.name}</BidiValue></strong>
                        <span className="guild-tag">{guild.tag}</span>
                      </div>
                      <small className="guild-card__desc">{guild.description || t.guildUi.defaultMotto}</small>
                    </div>
                  </div>

                  <div className="guild-card__stats">
                    <span>
                      <Trophy size={12} /> <BidiValue direction="ltr">{guild.score}</BidiValue> {t.leaderboard.trophies}
                    </span>
                    <span>
                      <Users size={12} /> <BidiValue direction="ltr">{guild.memberCount}</BidiValue>/{guild.maxMembers}
                    </span>
                    <span>
                      <Shield size={12} /> Req: <BidiValue direction="ltr">{guild.minTrophies}</BidiValue>
                    </span>
                  </div>

                  <button
                    className="guild-card__join-btn"
                    disabled={pending || guild.memberCount >= guild.maxMembers}
                    onClick={() => void onJoin(guild.id)}
                    type="button"
                  >
                    {t.guildUi.join}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
