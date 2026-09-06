'use client';

import { useEffect, useState } from 'react';
import {
  Award,
  Calendar,
  Castle,
  Check,
  ChevronRight,
  Clock,
  Crown,
  Gift,
  RotateCcw,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import type {
  LeaderboardEntry,
  TrophyLeague,
} from '@crown-and-coin/shared';
import {
  LEAGUE_CONFIGS,
  LEAGUE_TIER_ORDER,
  getNextLeagueThreshold,
  resolveLeagueFromTrophies,
} from '@crown-and-coin/shared';
import type { Dictionary, Locale } from '@/i18n/config';
import { BidiTemplate, BidiValue } from '@/i18n/bidi';
import { formatAmount } from '@/features/kingdom/components/resource-hud';
import { useLeaderboard } from '../hooks/use-leaderboard';
import { LeagueBadge } from './league-badge';

type LeaderboardTab = 'top' | 'leagues';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose(): void;
  dictionary: Dictionary;
  locale: Locale;
  currentTrophies?: number;
  currentLeague?: TrophyLeague;
}

export function LeaderboardModal({
  isOpen,
  onClose,
  dictionary: t,
  locale,
  currentTrophies = 1000,
  currentLeague,
}: LeaderboardModalProps) {
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('top');
  const { data, loading, error, refresh } = useLeaderboard(isOpen);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const effectiveLeague = currentLeague ?? resolveLeagueFromTrophies(currentTrophies);
  const nextThreshold = getNextLeagueThreshold(effectiveLeague);
  const trophiesToPromote = nextThreshold ? Math.max(0, nextThreshold - currentTrophies) : 0;

  const top3 = data?.topPlayers.slice(0, 3) ?? [];
  const restPlayers = data?.topPlayers.slice(3) ?? [];
  const currentPlayer = data?.currentPlayer;

  return (
    <div
      className="leaderboard-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="leaderboard-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="leaderboard-title"
      >
        {/* Header */}
        <header className="leaderboard-header">
          <span className="leaderboard-header__icon" aria-hidden="true">
            <Trophy size={22} />
          </span>
          <div className="leaderboard-header__copy">
            <h2 id="leaderboard-title">{t.leaderboard.title}</h2>
            <small>{t.leaderboard.subtitle}</small>
          </div>
          <button
            aria-label={t.leaderboard.close}
            className="leaderboard-header__close"
            onClick={onClose}
            type="button"
          >
            <X size={20} />
          </button>
        </header>

        {/* Season Info Banner */}
        <div className="leaderboard-season-banner">
          <div className="leaderboard-season-info">
            <span className="leaderboard-season-badge">
              <Calendar size={13} />
              <strong>{data?.season.name ?? 'Season'}</strong>
            </span>
            <span className="leaderboard-season-time">
              <Clock size={12} />
              <BidiTemplate
                template={t.leaderboard.seasonEnds}
                values={{ count: { direction: 'ltr', value: data?.season.daysRemaining ?? 14 } }}
              />
            </span>
          </div>
          {currentPlayer ? (
            <div className="leaderboard-season-standing">
              <small>{t.leaderboard.yourRank}</small>
              <strong>#{currentPlayer.rank}</strong>
            </div>
          ) : null}
        </div>

        {/* Navigation Tabs */}
        <nav className="leaderboard-tabs" aria-label={t.leaderboard.title}>
          <button
            aria-selected={activeTab === 'top'}
            onClick={() => setActiveTab('top')}
            role="tab"
            type="button"
          >
            <Trophy size={15} />
            <span>{t.leaderboard.globalTop}</span>
          </button>
          <button
            aria-selected={activeTab === 'leagues'}
            onClick={() => setActiveTab('leagues')}
            role="tab"
            type="button"
          >
            <Award size={15} />
            <span>{t.leaderboard.leaguesTab}</span>
          </button>
        </nav>

        {/* Tab Content */}
        <div className="leaderboard-content">
          {loading && !data ? (
            <div className="leaderboard-loading">
              <span className="leaderboard-spinner" />
              <p>{t.leaderboard.loading}</p>
            </div>
          ) : error && !data ? (
            <div className="leaderboard-error">
              <p>{error}</p>
              <button onClick={() => void refresh()} type="button">
                <RotateCcw size={14} /> Retry
              </button>
            </div>
          ) : activeTab === 'top' ? (
            <div className="leaderboard-top-tab">
              {/* Top 3 Podium */}
              {top3.length >= 3 ? (
                <div className="leaderboard-podium">
                  {/* 2nd Place */}
                  <PodiumSpot
                    entry={top3[1]}
                    position={2}
                    dictionary={t}
                    isCurrentPlayer={top3[1].isCurrentPlayer}
                  />
                  {/* 1st Place (Center / Highest) */}
                  <PodiumSpot
                    entry={top3[0]}
                    position={1}
                    dictionary={t}
                    isCurrentPlayer={top3[0].isCurrentPlayer}
                  />
                  {/* 3rd Place */}
                  <PodiumSpot
                    entry={top3[2]}
                    position={3}
                    dictionary={t}
                    isCurrentPlayer={top3[2].isCurrentPlayer}
                  />
                </div>
              ) : null}

              {/* Ranks 4-50 List */}
              <div className="leaderboard-list" role="list">
                {restPlayers.map((entry) => (
                  <LeaderboardRow
                    key={entry.playerId}
                    entry={entry}
                    dictionary={t}
                  />
                ))}
              </div>
            </div>
          ) : (
            /* Leagues & Perks Guide Tab */
            <div className="leaderboard-leagues-list">
              {LEAGUE_TIER_ORDER.map((tierKey) => {
                const config = LEAGUE_CONFIGS[tierKey];
                const isUserLeague = tierKey === effectiveLeague;
                return (
                  <div
                    key={tierKey}
                    className={`leaderboard-league-card ${
                      isUserLeague ? 'leaderboard-league-card--active' : ''
                    }`}
                    style={{
                      '--league-color': config.badgeColor,
                      '--league-accent': config.badgeAccent,
                    } as React.CSSProperties}
                  >
                    <div className="leaderboard-league-card__header">
                      <LeagueBadge league={tierKey} size="lg" dictionary={t} />
                      <div className="leaderboard-league-card__title">
                        <div className="leaderboard-league-card__name-row">
                          <h3>{t.leagues[tierKey.toLowerCase() as keyof typeof t.leagues]}</h3>
                          {isUserLeague ? (
                            <span className="leaderboard-league-card__current-pill">
                              <Check size={11} /> {t.leaderboard.currentLeague}
                            </span>
                          ) : null}
                        </div>
                        <small className="leaderboard-league-card__req">
                          {config.maxTrophies != null ? (
                            <BidiTemplate
                              template={t.leaderboard.trophyRange}
                              values={{
                                min: { direction: 'ltr', value: config.minTrophies },
                                max: { direction: 'ltr', value: config.maxTrophies },
                              }}
                            />
                          ) : (
                            <BidiTemplate
                              template={t.leaderboard.minTrophies}
                              values={{ count: { direction: 'ltr', value: config.minTrophies } }}
                            />
                          )}
                        </small>
                      </div>
                    </div>

                    <div className="leaderboard-league-card__rewards">
                      <div className="leaderboard-league-card__reward-header">
                        <Gift size={13} />
                        <strong>{t.leaderboard.bonusPerWin}</strong>
                      </div>
                      <div className="leaderboard-reward-grid">
                        <RewardPill resource="GOLD" amount={config.winBonus.GOLD} label={t.resourceShort.GOLD} />
                        <RewardPill resource="FOOD" amount={config.winBonus.FOOD} label={t.resourceShort.FOOD} />
                        <RewardPill resource="WOOD" amount={config.winBonus.WOOD} label={t.resourceShort.WOOD} />
                        <RewardPill resource="STONE" amount={config.winBonus.STONE} label={t.resourceShort.STONE} />
                        {Number(config.winBonus.GEMS) > 0 ? (
                          <RewardPill
                            resource="GEMS"
                            amount={config.winBonus.GEMS}
                            label={t.resourceGems}
                            isPremium
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sticky User Standing Bar */}
        {currentPlayer ? (
          <footer className="leaderboard-user-bar">
            <div className="leaderboard-user-bar__rank">
              <small>{t.leaderboard.rank}</small>
              <strong>#{currentPlayer.rank}</strong>
            </div>
            <div className="leaderboard-user-bar__profile">
              <div className="leaderboard-user-bar__identity">
                <strong>
                  <BidiValue>{currentPlayer.displayName}</BidiValue>
                </strong>
                <small>
                  <Castle size={11} /> {t.raidUi.castleLevel}{' '}
                  <BidiValue direction="ltr">{currentPlayer.castleLevel}</BidiValue>
                </small>
              </div>
              <div className="leaderboard-user-bar__league-info">
                <LeagueBadge league={currentPlayer.league} size="sm" dictionary={t} />
                <span className="leaderboard-user-bar__trophies">
                  <Trophy size={13} />
                  <strong>
                    <BidiValue direction="ltr">{currentPlayer.trophies}</BidiValue>
                  </strong>
                </span>
              </div>
            </div>
            {trophiesToPromote > 0 ? (
              <div className="leaderboard-user-bar__promote-hint">
                <ChevronRight size={13} />
                <BidiTemplate
                  template={t.leaderboard.nextLeagueAt}
                  values={{ count: { direction: 'ltr', value: trophiesToPromote } }}
                />
              </div>
            ) : nextThreshold === null ? (
              <div className="leaderboard-user-bar__promote-hint leaderboard-user-bar__promote-hint--max">
                <Sparkles size={13} />
                <span>{t.leaderboard.maxLeagueReached}</span>
              </div>
            ) : null}
          </footer>
        ) : null}
      </section>
    </div>
  );
}

function PodiumSpot({
  entry,
  position,
  dictionary: t,
  isCurrentPlayer,
}: {
  entry: LeaderboardEntry;
  position: 1 | 2 | 3;
  dictionary: Dictionary;
  isCurrentPlayer: boolean;
}) {
  const crownColor = position === 1 ? '#ffd76c' : position === 2 ? '#c0c8d0' : '#cd7f32';
  return (
    <div
      className={`leaderboard-podium-spot leaderboard-podium-spot--${position} ${
        isCurrentPlayer ? 'leaderboard-podium-spot--current' : ''
      }`}
    >
      <div className="leaderboard-podium-spot__crest">
        <span className="leaderboard-podium-spot__crown" style={{ color: crownColor }}>
          <Crown size={position === 1 ? 26 : 20} />
        </span>
        <span className="leaderboard-podium-spot__avatar">
          <Castle size={position === 1 ? 22 : 18} />
        </span>
        <span className="leaderboard-podium-spot__rank-pill">#{position}</span>
      </div>
      <div className="leaderboard-podium-spot__name">
        <strong>
          <BidiValue>{entry.displayName}</BidiValue>
        </strong>
        <small>
          {t.raidUi.castleLevel} <BidiValue direction="ltr">{entry.castleLevel}</BidiValue>
        </small>
      </div>
      <div className="leaderboard-podium-spot__score">
        <LeagueBadge league={entry.league} size="sm" dictionary={t} />
        <b>
          <Trophy size={12} /> <BidiValue direction="ltr">{entry.trophies}</BidiValue>
        </b>
      </div>
      <div className="leaderboard-podium-pedestal" />
    </div>
  );
}

function LeaderboardRow({
  entry,
  dictionary: t,
}: {
  entry: LeaderboardEntry;
  dictionary: Dictionary;
}) {
  return (
    <div
      className={`leaderboard-row ${entry.isCurrentPlayer ? 'leaderboard-row--current' : ''}`}
      role="listitem"
    >
      <div className="leaderboard-row__rank">
        <strong>#{entry.rank}</strong>
      </div>
      <div className="leaderboard-row__avatar">
        <Castle size={16} />
      </div>
      <div className="leaderboard-row__info">
        <strong className="leaderboard-row__name">
          <BidiValue>{entry.displayName}</BidiValue>
        </strong>
        <small className="leaderboard-row__sub">
          {t.raidUi.castleLevel} <BidiValue direction="ltr">{entry.castleLevel}</BidiValue>
        </small>
      </div>
      <div className="leaderboard-row__league">
        <LeagueBadge league={entry.league} size="sm" dictionary={t} />
      </div>
      <div className="leaderboard-row__trophies">
        <Trophy size={13} />
        <strong>
          <BidiValue direction="ltr">{entry.trophies}</BidiValue>
        </strong>
      </div>
    </div>
  );
}

function RewardPill({
  resource,
  amount,
  label,
  isPremium = false,
}: {
  resource: string;
  amount: string;
  label: string;
  isPremium?: boolean;
}) {
  return (
    <span
      className={`leaderboard-reward-pill ${
        isPremium ? 'leaderboard-reward-pill--premium' : ''
      }`}
      data-resource={resource}
    >
      {isPremium ? <Sparkles size={11} /> : null}
      <strong>+{formatAmount(amount)}</strong>
      <small>{label}</small>
    </span>
  );
}
