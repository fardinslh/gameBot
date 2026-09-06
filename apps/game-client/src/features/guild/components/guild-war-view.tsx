'use client';

import { useState } from 'react';
import {
  Check,
  Clock,
  Coins,
  Crown,
  FastForward,
  Flame,
  Shield,
  Sparkles,
  Star,
  Swords,
  Trophy,
  Users,
} from 'lucide-react';
import type {
  GuildWarDetails,
  GuildWarParticipant,
  GuildWarRecord,
  WarAttackResult,
} from '@crown-and-coin/shared';
import type { Dictionary } from '@/i18n/config';
import { BidiValue } from '@/i18n/bidi';
import { LeagueBadge } from '@/features/leaderboard/components/league-badge';
import { GuildCrestBadge } from './guild-crest';

interface GuildWarViewProps {
  war: GuildWarDetails | null;
  warRecord: GuildWarRecord | null;
  canDeclareWar: boolean;
  pending: boolean;
  dictionary: Dictionary;
  lastAttackResult: WarAttackResult | null;
  onClearAttackResult(): void;
  onDeclareWar(size?: number): Promise<boolean>;
  onAttack(defenderId: string): Promise<WarAttackResult | null>;
  onSimulateBattleDay(): Promise<void>;
  onSimulateWarEnd(): Promise<void>;
  onClaimSpoils(): Promise<boolean>;
}

export function GuildWarView({
  war,
  warRecord,
  canDeclareWar,
  pending,
  dictionary: t,
  lastAttackResult,
  onClearAttackResult,
  onDeclareWar,
  onAttack,
  onSimulateBattleDay,
  onSimulateWarEnd,
  onClaimSpoils,
}: GuildWarViewProps) {
  const [activeTab, setActiveTab] = useState<'enemy' | 'defenses' | 'log'>('enemy');
  const [selectedDefender, setSelectedDefender] = useState<GuildWarParticipant | null>(null);

  // 1. Idle state (not in war)
  if (!war) {
    const xpPercent = warRecord
      ? Math.min(100, Math.round((warRecord.guildXp / warRecord.nextLevelXp) * 100))
      : 0;

    return (
      <div className="guild-war-view guild-war-view--idle">
        <div className="guild-war-hero">
          <div className="guild-war-hero__icon">
            <Swords size={36} />
          </div>
          <h2>{t.guildWarUi.title}</h2>
          <p>{t.guildWarUi.subtitle}</p>

          {canDeclareWar ? (
            <button
              className="guild-btn guild-btn--primary guild-war-declare-btn"
              disabled={pending}
              onClick={() => onDeclareWar(5)}
              type="button"
            >
              <Flame size={18} /> {pending ? t.guildWarUi.declaring : t.guildWarUi.declareWar}
            </button>
          ) : (
            <div className="guild-war-locked-notice">
              <Shield size={16} />
              <span>{t.guildWarUi.awaitingLeader}</span>
            </div>
          )}
        </div>

        {/* War Record & Level Card */}
        {warRecord ? (
          <div className="guild-war-record-card">
            <div className="guild-war-record-header">
              <div className="guild-war-level-badge">
                <Crown size={16} />
                <span>
                  {t.guildWarUi.level} <BidiValue direction="ltr">{warRecord.guildLevel}</BidiValue>
                </span>
              </div>
              <small>
                <BidiValue direction="ltr">{warRecord.guildXp}</BidiValue> /{' '}
                <BidiValue direction="ltr">{warRecord.nextLevelXp}</BidiValue> {t.guildWarUi.xp}
              </small>
            </div>

            <div className="guild-war-xp-bar">
              <div className="guild-war-xp-bar__fill" style={{ width: `${xpPercent}%` }} />
            </div>

            <div className="guild-war-stats-row">
              <div className="guild-war-stat">
                <strong className="text-emerald">
                  <BidiValue direction="ltr">{warRecord.wins}</BidiValue>
                </strong>
                <small>{t.guildWarUi.wins}</small>
              </div>
              <div className="guild-war-stat">
                <strong className="text-rose">
                  <BidiValue direction="ltr">{warRecord.losses}</BidiValue>
                </strong>
                <small>{t.guildWarUi.losses}</small>
              </div>
              <div className="guild-war-stat">
                <strong className="text-amber">
                  <BidiValue direction="ltr">{warRecord.draws}</BidiValue>
                </strong>
                <small>{t.guildWarUi.draws}</small>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  // 2. Active War State
  const isPrep = war.state === 'PREPARATION';
  const isBattle = war.state === 'BATTLE_DAY';
  const isEnded = war.state === 'WAR_ENDED';

  return (
    <div className="guild-war-view guild-war-view--active">
      {/* Dev Fast-Forward Simulator Bar */}
      <div className="guild-war-sim-bar">
        {isPrep ? (
          <button
            className="guild-war-sim-btn"
            disabled={pending}
            onClick={onSimulateBattleDay}
            type="button"
          >
            <FastForward size={12} /> {t.guildWarUi.simBattleDay}
          </button>
        ) : null}
        {isBattle ? (
          <button
            className="guild-war-sim-btn"
            disabled={pending}
            onClick={onSimulateWarEnd}
            type="button"
          >
            <FastForward size={12} /> {t.guildWarUi.simWarEnd}
          </button>
        ) : null}
      </div>

      {/* Live War Scoreboard */}
      <div className="guild-war-scoreboard">
        {/* Friendly Clan */}
        <div className="guild-war-side guild-war-side--friendly">
          <GuildCrestBadge crest={war.friendly.crest} size="md" />
          <div className="guild-war-side__info">
            <strong><BidiValue>{war.friendly.name}</BidiValue></strong>
            <span className="guild-tag">{war.friendly.tag}</span>
          </div>
          <div className="guild-war-stars-counter">
            <Star className="star-icon star-icon--filled" size={18} />
            <strong><BidiValue direction="ltr">{war.friendly.stars}</BidiValue></strong>
            <small>/<BidiValue direction="ltr">{war.friendly.totalStarsPossible}</BidiValue></small>
          </div>
          <div className="guild-war-destruct-text">
            <BidiValue direction="ltr">{war.friendly.destructionPct.toFixed(1)}%</BidiValue>
          </div>
        </div>

        {/* Center Status Pill */}
        <div className="guild-war-center-status">
          <div className="guild-war-status-pill">
            <Clock size={13} />
            <span>
              {isPrep
                ? t.guildWarUi.prepDay
                : isBattle
                ? t.guildWarUi.battleDay
                : t.guildWarUi.warEnded}
            </span>
          </div>
          <div className="guild-war-vs-badge">VS</div>
          <div className="guild-war-attacks-stat">
            <small>
              <BidiValue direction="ltr">{war.friendly.attacksUsed}</BidiValue> vs{' '}
              <BidiValue direction="ltr">{war.opposing.attacksUsed}</BidiValue>
            </small>
          </div>
        </div>

        {/* Opposing Clan */}
        <div className="guild-war-side guild-war-side--opposing">
          <GuildCrestBadge crest={war.opposing.crest} size="md" />
          <div className="guild-war-side__info">
            <strong><BidiValue>{war.opposing.name}</BidiValue></strong>
            <span className="guild-tag">{war.opposing.tag}</span>
          </div>
          <div className="guild-war-stars-counter">
            <Star className="star-icon star-icon--filled" size={18} />
            <strong><BidiValue direction="ltr">{war.opposing.stars}</BidiValue></strong>
            <small>/<BidiValue direction="ltr">{war.opposing.totalStarsPossible}</BidiValue></small>
          </div>
          <div className="guild-war-destruct-text">
            <BidiValue direction="ltr">{war.opposing.destructionPct.toFixed(1)}%</BidiValue>
          </div>
        </div>
      </div>

      {/* Attacks Remaining Banner */}
      <div className="guild-war-attacks-banner">
        <div className="guild-war-attacks-badge">
          <Swords size={16} />
          <span>
            {t.guildWarUi.attacksRemaining}:{' '}
            <strong><BidiValue direction="ltr">{war.currentUserAttacksLeft}</BidiValue> / 2</strong>
          </span>
        </div>
        {isPrep ? (
          <small className="guild-war-prep-notice">{t.guildWarUi.prepNotice}</small>
        ) : null}
      </div>

      {/* War Concluded Banner & Spoils Claim */}
      {isEnded ? (
        <div className={`guild-war-ended-card guild-war-ended-card--${war.outcome.toLowerCase()}`}>
          <div className="guild-war-outcome-header">
            <Trophy size={24} />
            <div>
              <h3>
                {war.outcome === 'VICTORY'
                  ? t.guildWarUi.victory
                  : war.outcome === 'DEFEAT'
                  ? t.guildWarUi.defeat
                  : t.guildWarUi.draw}
              </h3>
              <small>
                {t.guildWarUi.spoilsLooted}:{' '}
                <strong><BidiValue direction="ltr">{war.warSpoilsAvailableGold}</BidiValue></strong>{' '}
                {t.resourceShort.GOLD}
              </small>
            </div>
          </div>
          <button
            className="guild-btn guild-btn--primary guild-claim-spoils-btn"
            disabled={pending}
            onClick={onClaimSpoils}
            type="button"
          >
            <Coins size={16} /> {t.guildWarUi.claimSpoils}
          </button>
        </div>
      ) : null}

      {/* Sub-Navigation Tabs */}
      <div className="guild-war-tabs" role="tablist">
        <button
          className={`guild-war-tab-btn ${activeTab === 'enemy' ? 'guild-war-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('enemy')}
          type="button"
        >
          <Shield size={14} /> {t.guildWarUi.enemyBases}
        </button>
        <button
          className={`guild-war-tab-btn ${activeTab === 'defenses' ? 'guild-war-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('defenses')}
          type="button"
        >
          <Users size={14} /> {t.guildWarUi.ourDefenses}
        </button>
        <button
          className={`guild-war-tab-btn ${activeTab === 'log' ? 'guild-war-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('log')}
          type="button"
        >
          <Clock size={14} /> {t.guildWarUi.warLog}
        </button>
      </div>

      {/* Enemy Bases List */}
      {activeTab === 'enemy' ? (
        <div className="guild-war-bases-list">
          {war.opposingParticipants.map((base) => {
            const canAttackThisBase = isBattle && war.currentUserAttacksLeft > 0;
            return (
              <div key={base.playerId} className="guild-war-base-card">
                <div className="guild-war-base-rank">
                  <span>#{base.baseNumber}</span>
                </div>

                <div className="guild-war-base-info">
                  <div className="guild-war-base-name">
                    <strong><BidiValue>{base.displayName}</BidiValue></strong>
                    <LeagueBadge league={base.league} size="sm" />
                  </div>
                  <small>
                    {t.guildUi.castle} Lv. <BidiValue direction="ltr">{base.castleLevel}</BidiValue>
                  </small>
                </div>

                <div className="guild-war-base-stars">
                  <div className="guild-war-stars-icons">
                    {[1, 2, 3].map((starIdx) => (
                      <Star
                        key={starIdx}
                        size={14}
                        className={
                          starIdx <= base.bestStarsConceded
                            ? 'star-icon star-icon--filled'
                            : 'star-icon star-icon--empty'
                        }
                      />
                    ))}
                  </div>
                  <small>
                    <BidiValue direction="ltr">{base.bestDestructionConceded.toFixed(0)}%</BidiValue>
                  </small>
                </div>

                <div className="guild-war-base-action">
                  <button
                    className="guild-btn guild-btn--primary guild-war-attack-btn"
                    disabled={!canAttackThisBase || pending}
                    onClick={() => onAttack(base.playerId)}
                    type="button"
                  >
                    <Swords size={14} /> {t.guildWarUi.attackBase}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Friendly Defenses List */}
      {activeTab === 'defenses' ? (
        <div className="guild-war-bases-list">
          {war.friendlyParticipants.map((base) => (
            <div key={base.playerId} className="guild-war-base-card guild-war-base-card--friendly">
              <div className="guild-war-base-rank">
                <span>#{base.baseNumber}</span>
              </div>
              <div className="guild-war-base-info">
                <div className="guild-war-base-name">
                  <strong><BidiValue>{base.displayName}</BidiValue></strong>
                  <LeagueBadge league={base.league} size="sm" />
                </div>
                <small>
                  {t.guildUi.castle} Lv. <BidiValue direction="ltr">{base.castleLevel}</BidiValue>
                </small>
              </div>
              <div className="guild-war-base-stars">
                <div className="guild-war-stars-icons">
                  {[1, 2, 3].map((starIdx) => (
                    <Star
                      key={starIdx}
                      size={14}
                      className={
                        starIdx <= base.bestStarsConceded
                          ? 'star-icon star-icon--conceded'
                          : 'star-icon star-icon--empty'
                      }
                    />
                  ))}
                </div>
                <small>
                  <BidiValue direction="ltr">{base.bestDestructionConceded.toFixed(0)}%</BidiValue>
                </small>
              </div>
              <div className="guild-war-attacks-tally">
                <small>{base.attacksUsed}/2 used</small>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* War Log Tab */}
      {activeTab === 'log' ? (
        <div className="guild-war-log-list">
          {war.recentAttacks.length === 0 ? (
            <div className="guild-war-empty-log">
              <Shield size={32} />
              <p>No war attacks logged yet.</p>
            </div>
          ) : (
            war.recentAttacks.map((atk) => (
              <div key={atk.id} className="guild-war-log-item">
                <div className="guild-war-log-attacker">
                  <strong><BidiValue>{atk.attackerName}</BidiValue></strong>
                  <span>vs</span>
                  <small><BidiValue>{atk.defenderName}</BidiValue></small>
                </div>
                <div className="guild-war-log-result">
                  <div className="guild-war-stars-icons">
                    {[1, 2, 3].map((starIdx) => (
                      <Star
                        key={starIdx}
                        size={12}
                        className={
                          starIdx <= atk.stars
                            ? 'star-icon star-icon--filled'
                            : 'star-icon star-icon--empty'
                        }
                      />
                    ))}
                  </div>
                  <span><BidiValue direction="ltr">{atk.destructionPct.toFixed(0)}%</BidiValue></span>
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}

      {/* Attack Result Popup */}
      {lastAttackResult ? (
        <div className="guild-modal-backdrop" onClick={onClearAttackResult}>
          <div
            className="guild-war-result-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <div className="guild-war-result-header">
              <Sparkles size={24} />
              <h3>{t.guildWarUi.attackResultTitle}</h3>
            </div>

            <div className="guild-war-result-stars">
              {[1, 2, 3].map((starIdx) => (
                <Star
                  key={starIdx}
                  size={32}
                  className={
                    starIdx <= lastAttackResult.stars
                      ? 'star-icon star-icon--filled star-icon--pop'
                      : 'star-icon star-icon--empty'
                  }
                />
              ))}
            </div>

            <div className="guild-war-result-metric">
              <span>{t.guildWarUi.destruction}</span>
              <strong><BidiValue direction="ltr">{lastAttackResult.destructionPct.toFixed(1)}%</BidiValue></strong>
            </div>

            <div className="guild-war-result-spoils">
              <Coins size={18} />
              <span>
                +{t.guildWarUi.spoilsLooted}:{' '}
                <strong><BidiValue direction="ltr">{lastAttackResult.spoilsGoldAwarded}</BidiValue></strong>{' '}
                {t.resourceShort.GOLD}
              </span>
            </div>

            <button
              className="guild-btn guild-btn--primary guild-war-confirm-btn"
              onClick={onClearAttackResult}
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
