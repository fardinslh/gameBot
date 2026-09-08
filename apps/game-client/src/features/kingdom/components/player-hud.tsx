import { Crown, Gem, Trophy } from 'lucide-react';
import type { Dictionary, Locale } from '@/i18n/config';
import type { KingdomProgressionState, ProfileCrestKey, TrophyLeague } from '@crown-and-coin/shared';
import { ExperienceControls } from '@/features/experience/player-experience-provider';
import { BidiValue } from '@/i18n/bidi';
import { formatAmount } from '../domain/collection-presentation';

interface PlayerHudProps {
  dictionary: Dictionary;
  gemBalance?: string;
  locale: Locale;
  kingdomName?: string;
  playerLevel: number;
  playerName: string;
  progression?: KingdomProgressionState;
  profileCrest?: ProfileCrestKey;
  section?: 'heroes' | 'raid';
  trophies?: number;
  league?: TrophyLeague;
  onOpenLeaderboard?(): void;
}

export function PlayerHud({ dictionary: t, gemBalance, locale, kingdomName, playerLevel, playerName, progression, profileCrest = 'DEFAULT', section, trophies, league, onOpenLeaderboard }: PlayerHudProps) {
  const displayedLevel = progression?.level ?? playerLevel;
  const xpProgress = progression?.xpRequiredForNextLevel
    ? Math.min(100, Math.round((progression.xpIntoLevel / progression.xpRequiredForNextLevel) * 100))
    : 100;
  const displayedPlayerName = locale === 'fa' && playerName === 'Warden of Dawnkeep'
    ? t.playerTitle
    : playerName || t.playerTitle;
  const displayedKingdomName = kingdomName?.trim() || displayedPlayerName;
  return (
    <header className="player-hud">
      <div className={`player-profile player-profile--${profileCrest.toLowerCase().replace('profile_crest_', '')}`} data-profile-crest={profileCrest}>
        <span className="player-avatar"><Crown aria-hidden="true" size={20} /></span>
        <span className="player-copy">
          <h1 title={t.appName}>{t.appName}</h1>
          <small title={displayedKingdomName}><BidiValue>{displayedKingdomName}</BidiValue></small>
        </span>
        {gemBalance !== undefined ? (
          <span aria-label={`${t.resourceGems}: ${formatAmount(gemBalance)}`} className="premium-currency-pill" data-balance={gemBalance} data-resource="GEMS" dir="ltr">
            <Gem aria-hidden="true" size={13} strokeWidth={2.4} />
            <strong><BidiValue direction="ltr">{formatAmount(gemBalance)}</BidiValue></strong>
          </span>
        ) : null}
        <span className="player-level" aria-label={`${t.playerLevel} ${displayedLevel}`} title={progression ? `${progression.xp} XP` : undefined}>
          <small>{t.playerLevel}</small><strong><BidiValue direction="ltr">{displayedLevel}</BidiValue></strong>
          {progression ? <i aria-hidden="true"><b style={{ width: `${xpProgress}%` }} /></i> : null}
        </span>
        {onOpenLeaderboard ? (
          <button
            aria-label={`${t.leaderboard.title}: ${trophies ?? 1000} ${t.leaderboard.trophies}`}
            className="player-trophy-btn"
            onClick={onOpenLeaderboard}
            type="button"
          >
            <Trophy aria-hidden="true" size={13} />
            <BidiValue direction="ltr">{trophies ?? 1000}</BidiValue>
          </button>
        ) : null}
      </div>

      <div className="player-actions">
        <ExperienceControls dictionary={t} locale={locale} section={section} />
      </div>
    </header>
  );
}
