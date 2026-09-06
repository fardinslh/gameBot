'use client';

import {
  Award,
  Calendar,
  Check,
  Clock,
  Coins,
  Crown,
  FastForward,
  Gem,
  Gift,
  Shield,
  Sparkles,
  Trophy,
} from 'lucide-react';
import type {
  ClaimSeasonRewardResponse,
  SeasonOverviewResponse,
  SeasonRewardTier,
  TrophyLeague,
} from '@crown-and-coin/shared';
import { LEAGUE_CONFIGS } from '@crown-and-coin/shared';
import type { Dictionary } from '@/i18n/config';
import { BidiValue } from '@/i18n/bidi';
import { LeagueBadge } from '@/features/leaderboard/components/league-badge';
import { GuildCrestBadge } from '@/features/guild/components/guild-crest';

interface SeasonTabViewProps {
  overview: SeasonOverviewResponse | null;
  loading: boolean;
  pending: boolean;
  claimSuccess: ClaimSeasonRewardResponse | null;
  dictionary: Dictionary;
  onClaimRewards(): Promise<boolean>;
  onClearClaimSuccess(): void;
  onSimulateEndSeason(): Promise<boolean>;
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return 'Ending soon';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  return `${hours}h ${minutes}m`;
}

export function SeasonTabView({
  overview,
  loading,
  pending,
  claimSuccess,
  dictionary: t,
  onClaimRewards,
  onClearClaimSuccess,
  onSimulateEndSeason,
}: SeasonTabViewProps) {
  if (loading && !overview) {
    return (
      <div className="leaderboard-loading">
        <span className="leaderboard-spinner" />
        <p>{t.seasonUi.loadingSeason}</p>
      </div>
    );
  }

  if (!overview) {
    return null;
  }

  const { currentSeason, playerStanding, rewardTiers, topGuilds } = overview;
  const prev = playerStanding.previousSeason;
  const hasUnclaimedPrev = prev && !prev.rewardsClaimed;

  return (
    <div className="season-tab-view">
      {/* Dev Fast-Forward Bar */}
      <div className="season-sim-bar">
        <button
          className="season-sim-btn"
          disabled={pending}
          onClick={onSimulateEndSeason}
          type="button"
        >
          <FastForward size={12} /> {t.seasonUi.simEndSeason}
        </button>
      </div>

      {/* Season Header Banner */}
      <div className="season-hero-card">
        <div className="season-hero-header">
          <div className="season-hero-title-group">
            <span className="season-hero-icon">
              <Crown size={22} />
            </span>
            <div>
              <h3><BidiValue>{currentSeason.name}</BidiValue></h3>
              <div className="season-timer-row">
                <Clock size={13} />
                <span>
                  {t.seasonUi.endsIn}:{' '}
                  <strong><BidiValue direction="ltr">{formatCountdown(currentSeason.timeRemainingSeconds)}</BidiValue></strong>
                </span>
              </div>
            </div>
          </div>
          <span className="season-live-badge">ACTIVE</span>
        </div>

        {/* Player Current Standing Bar */}
        <div className="season-player-card">
          <div className="season-player-league">
            <LeagueBadge league={playerStanding.currentLeague} size="md" />
            <div>
              <strong className="season-player-trophies">
                <Trophy size={14} /> <BidiValue direction="ltr">{playerStanding.currentTrophies}</BidiValue>
              </strong>
              <small>
                {t.seasonUi.peakTrophies}:{' '}
                <BidiValue direction="ltr">{playerStanding.peakTrophies}</BidiValue>
              </small>
            </div>
          </div>

          <div className="season-projected-rewards">
            <small>{t.seasonUi.projectedRewards}</small>
            <div className="season-reward-pills">
              <span className="reward-pill reward-pill--gems">
                <Gem size={13} /> +<BidiValue direction="ltr">{playerStanding.projectedReward.gems}</BidiValue>
              </span>
              <span className="reward-pill reward-pill--gold">
                <Coins size={13} /> +<BidiValue direction="ltr">{playerStanding.projectedReward.gold}</BidiValue>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Claim Previous Season Rewards Banner */}
      {hasUnclaimedPrev ? (
        <div className="season-claim-card" role="region">
          <div className="season-claim-header">
            <Gift className="season-claim-icon" size={24} />
            <div className="season-claim-copy">
              <h4>{t.seasonUi.unclaimedTitle}</h4>
              <p>
                {t.seasonUi.unclaimedSubtitle} (Season{' '}
                <BidiValue direction="ltr">{prev.seasonNumber}</BidiValue>)
              </p>
            </div>
          </div>

          <div className="season-claim-rewards-preview">
            <div className="season-claim-tier">
              <LeagueBadge league={prev.endingLeague} size="sm" />
              <span>{LEAGUE_CONFIGS[prev.endingLeague]?.nameKey ? prev.endingLeague : prev.endingLeague}</span>
            </div>
            <div className="season-reward-pills">
              <span className="reward-pill reward-pill--gems">
                <Gem size={13} /> +<BidiValue direction="ltr">{prev.reward.gems}</BidiValue>
              </span>
              <span className="reward-pill reward-pill--gold">
                <Coins size={13} /> +<BidiValue direction="ltr">{prev.reward.gold}</BidiValue>
              </span>
              {prev.reward.title ? (
                <span className="reward-pill reward-pill--title">
                  <Award size={13} /> {prev.reward.title}
                </span>
              ) : null}
            </div>
          </div>

          <button
            className="guild-btn guild-btn--primary season-claim-btn"
            disabled={pending}
            onClick={onClaimRewards}
            type="button"
          >
            <Gift size={16} /> {pending ? t.seasonUi.claiming : t.seasonUi.claimButton}
          </button>
        </div>
      ) : null}

      {/* Rewards Ladder Section */}
      <div className="season-section">
        <div className="season-section-header">
          <Award size={16} />
          <h4>{t.seasonUi.rewardLadder}</h4>
        </div>
        <div className="season-reward-tiers-list">
          {rewardTiers.map((tier) => {
            const isCurrentTier = tier.league === playerStanding.currentLeague;
            const config = LEAGUE_CONFIGS[tier.league];
            return (
              <div
                key={tier.league}
                className={`season-tier-card ${isCurrentTier ? 'season-tier-card--current' : ''}`}
              >
                <div className="season-tier-badge">
                  <LeagueBadge league={tier.league} size="sm" />
                  <div>
                    <strong>{tier.league}</strong>
                    <small>
                      <BidiValue direction="ltr">{config?.minTrophies ?? 0}</BidiValue>+ {t.leaderboard.trophies}
                    </small>
                  </div>
                </div>

                <div className="season-tier-loot">
                  <span className="loot-gem">
                    <Gem size={12} /> <BidiValue direction="ltr">{tier.gems}</BidiValue>
                  </span>
                  <span className="loot-gold">
                    <Coins size={12} /> <BidiValue direction="ltr">{tier.gold}</BidiValue>
                  </span>
                  {tier.title ? (
                    <span className="loot-title">
                      <Award size={11} /> {tier.title}
                    </span>
                  ) : null}
                </div>

                {isCurrentTier ? (
                  <span className="season-current-pill">{t.seasonUi.currentTier}</span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Alliance Championship Top 5 */}
      {topGuilds.length > 0 ? (
        <div className="season-section">
          <div className="season-section-header">
            <Shield size={16} />
            <h4>{t.seasonUi.allianceStandings}</h4>
          </div>
          <div className="season-guilds-list">
            {topGuilds.map((g) => (
              <div key={g.id} className="season-guild-card">
                <span className="season-guild-rank">#{g.rank}</span>
                <GuildCrestBadge crest={{ emblem: g.emblem as any, primaryColor: '#b91c1c', secondaryColor: '#450a0a' }} size="sm" />
                <div className="season-guild-info">
                  <strong><BidiValue>{g.name}</BidiValue></strong>
                  <span className="guild-tag">{g.tag}</span>
                </div>
                <div className="season-guild-score">
                  <Trophy size={13} />
                  <strong><BidiValue direction="ltr">{g.score}</BidiValue></strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Claim Rewards Celebration Popup Modal */}
      {claimSuccess ? (
        <div className="guild-modal-backdrop" onClick={onClearClaimSuccess}>
          <div
            className="guild-war-result-modal season-success-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <div className="guild-war-result-header">
              <Sparkles size={26} />
              <h3>{t.seasonUi.rewardsClaimedTitle}</h3>
            </div>

            <p className="season-success-copy">
              {t.seasonUi.rewardsClaimedDesc}
            </p>

            <div className="season-success-rewards">
              <div className="season-reward-item">
                <Gem size={22} className="text-amber" />
                <strong>+<BidiValue direction="ltr">{claimSuccess.gemsAwarded}</BidiValue></strong>
                <small>{t.resourceShort.GEMS}</small>
              </div>
              <div className="season-reward-item">
                <Coins size={22} className="text-gold" />
                <strong>+<BidiValue direction="ltr">{claimSuccess.goldAwarded}</BidiValue></strong>
                <small>{t.resourceShort.GOLD}</small>
              </div>
              {claimSuccess.titleAwarded ? (
                <div className="season-reward-item season-reward-item--title">
                  <Award size={22} />
                  <strong>{claimSuccess.titleAwarded}</strong>
                  <small>Title</small>
                </div>
              ) : null}
            </div>

            <button
              className="guild-btn guild-btn--primary guild-war-confirm-btn"
              onClick={onClearClaimSuccess}
              type="button"
            >
              <Check size={16} /> {t.close}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
