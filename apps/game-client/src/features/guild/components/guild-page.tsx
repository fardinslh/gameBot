'use client';

import { useState } from 'react';
import { Coins, LogOut, Shield, Sparkles, Swords, Trophy, Users } from 'lucide-react';
import type { Dictionary, Locale } from '@/i18n/config';
import { BidiValue } from '@/i18n/bidi';
import { BottomNavigation, type GameSection } from '@/features/kingdom/components/bottom-navigation';
import { useGuildState, type GuildTab } from '../hooks/use-guild-state';
import { GuildCrestBadge } from './guild-crest';
import { CreateGuildModal } from './create-guild-modal';
import { GuildRosterView } from './guild-roster-view';
import { GuildRequestsView } from './guild-requests-view';
import { GuildLeaderboardView } from './guild-leaderboard-view';
import { GuildUnjoinedView } from './guild-unjoined-view';

interface GuildPageProps {
  locale: Locale;
  dictionary: Dictionary;
  onNavigate(section: GameSection): void;
}

export function GuildPage({ dictionary: t, onNavigate }: GuildPageProps) {
  const guild = useGuildState();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [comingSoon, setComingSoon] = useState<string | null>(null);

  const inGuild = guild.overview?.inGuild ?? false;
  const guildDetails = guild.overview?.guild;

  return (
    <div className="guild-viewport">
      <main className="guild-shell">
        <header className="guild-titlebar">
          <div className="guild-titlebar__brand">
            <span><Users size={19} /></span>
            <div>
              <h1>{t.guildUi.title}</h1>
              <p>{t.guildUi.subtitle}</p>
            </div>
          </div>
        </header>

        {guild.loading ? (
          <div className="guild-loading">
            <div className="leaderboard-spinner" />
            <p>{t.guildUi.loadingGuild}</p>
          </div>
        ) : !inGuild ? (
          <GuildUnjoinedView
            dictionary={t}
            leaderboard={guild.leaderboard}
            onJoin={guild.joinGuild}
            onLoadLeaderboard={guild.loadLeaderboard}
            onOpenCreate={() => setCreateModalOpen(true)}
            onSearch={guild.search}
            pending={guild.actionPending}
            searchResults={guild.searchResults}
            suggestedGuilds={guild.overview?.suggestedGuilds ?? []}
          />
        ) : guildDetails ? (
          <div className="guild-dashboard">
            {/* Guild Header Banner */}
            <div className="guild-banner">
              <div className="guild-banner__top">
                <GuildCrestBadge crest={guildDetails.guild.crest} size="lg" />
                <div className="guild-banner__info">
                  <div className="guild-banner__name-row">
                    <h2><BidiValue>{guildDetails.guild.name}</BidiValue></h2>
                    <span className="guild-tag">{guildDetails.guild.tag}</span>
                  </div>
                  <p className="guild-banner__desc">
                    {guildDetails.guild.description || t.guildUi.defaultMotto}
                  </p>
                </div>

                <button
                  aria-label={t.guildUi.leaveGuild}
                  className="guild-leave-btn"
                  disabled={guild.actionPending}
                  onClick={() => {
                    if (window.confirm(t.guildUi.confirmLeave)) {
                      void guild.leaveGuild();
                    }
                  }}
                  title={t.guildUi.leaveGuild}
                  type="button"
                >
                  <LogOut size={16} />
                </button>
              </div>

              {/* Guild Metrics Bar */}
              <div className="guild-metrics-bar">
                <div className="guild-metric">
                  <small>{t.leaderboard.trophies}</small>
                  <strong><Trophy size={13} /> <BidiValue direction="ltr">{guildDetails.guild.score}</BidiValue></strong>
                </div>
                <div className="guild-metric">
                  <small>{t.guildUi.members}</small>
                  <strong><Users size={13} /> <BidiValue direction="ltr">{guildDetails.guild.memberCount}</BidiValue>/{guildDetails.guild.maxMembers}</strong>
                </div>
                <div className="guild-metric">
                  <small>{t.guildUi.requiredTrophies}</small>
                  <strong><Shield size={13} /> <BidiValue direction="ltr">{guildDetails.guild.minTrophies}</BidiValue></strong>
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="guild-tabs" role="tablist">
              <button
                className={`guild-tab-btn ${guild.activeTab === 'requests' ? 'guild-tab-btn--active' : ''}`}
                onClick={() => guild.setActiveTab('requests')}
                role="tab"
                type="button"
              >
                <Swords size={15} /> {t.guildUi.reinforcementsTab}
                {guildDetails.requests.length > 0 ? (
                  <span className="guild-tab-badge">{guildDetails.requests.length}</span>
                ) : null}
              </button>

              <button
                className={`guild-tab-btn ${guild.activeTab === 'roster' ? 'guild-tab-btn--active' : ''}`}
                onClick={() => guild.setActiveTab('roster')}
                role="tab"
                type="button"
              >
                <Users size={15} /> {t.guildUi.rosterTab}
              </button>

              <button
                className={`guild-tab-btn ${guild.activeTab === 'leaderboard' ? 'guild-tab-btn--active' : ''}`}
                onClick={() => guild.setActiveTab('leaderboard')}
                role="tab"
                type="button"
              >
                <Trophy size={15} /> {t.guildUi.leaderboardTab}
              </button>
            </div>

            {/* Tab Contents */}
            <div className="guild-tab-content">
              {guild.activeTab === 'requests' ? (
                <GuildRequestsView
                  canRequestTroops={guildDetails.canRequestTroops}
                  currentUserId={guildDetails.members.find((m) => m.role === guildDetails.currentUserRole)?.playerId}
                  dictionary={t}
                  nextRequestAvailableAt={guildDetails.nextRequestAvailableAt}
                  onDonate={guild.donateTroops}
                  onRequestTroops={guild.requestTroops}
                  pending={guild.actionPending}
                  requests={guildDetails.requests}
                />
              ) : guild.activeTab === 'roster' ? (
                <GuildRosterView
                  currentUserRole={guildDetails.currentUserRole}
                  dictionary={t}
                  members={guildDetails.members}
                  onKick={guild.kickMember}
                  onSetRole={guild.setRole}
                  pending={guild.actionPending}
                />
              ) : (
                <GuildLeaderboardView
                  dictionary={t}
                  leaderboard={guild.leaderboard}
                  onLoad={guild.loadLeaderboard}
                />
              )}
            </div>
          </div>
        ) : null}

        {/* Create Guild Modal */}
        <CreateGuildModal
          dictionary={t}
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onSubmit={guild.createGuild}
          pending={guild.actionPending}
        />

        {/* Donation Reward Toast */}
        {guild.donationReward ? (
          <div className="guild-reward-toast" role="status">
            <div className="guild-reward-toast__content">
              <strong>{t.guildUi.donationSuccess}</strong>
              <div className="guild-reward-toast__pills">
                <span><Coins size={13} /> +{guild.donationReward.goldAwarded} {t.resourceShort.GOLD}</span>
                <span><Sparkles size={13} /> +{guild.donationReward.xpAwarded} XP</span>
              </div>
            </div>
            <button onClick={guild.clearDonationReward} type="button">{t.close}</button>
          </div>
        ) : null}

        {/* Error Alert */}
        {guild.error ? (
          <div className="guild-error-banner" role="alert">
            <span>{guild.error}</span>
            <button onClick={guild.clearError} type="button">{t.close}</button>
          </div>
        ) : null}

        <BottomNavigation
          activeSection="guild"
          dictionary={t}
          onComingSoon={setComingSoon}
          onNavigate={onNavigate}
        />
        <div className={comingSoon ? 'coming-soon-toast coming-soon-toast--visible' : 'coming-soon-toast'} role="status">
          {comingSoon}
        </div>
      </main>
    </div>
  );
}
