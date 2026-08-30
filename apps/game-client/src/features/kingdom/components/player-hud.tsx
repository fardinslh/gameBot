import { Crown } from 'lucide-react';
import Link from 'next/link';
import type { Dictionary, Locale } from '@/i18n/config';
import { ApiStatus } from '@/components/api-status';
import type { KingdomProgressionState } from '@crown-and-coin/shared';
import { ExperienceControls } from '@/features/experience/player-experience-provider';
import { BidiValue } from '@/i18n/bidi';

interface PlayerHudProps {
  dictionary: Dictionary;
  locale: Locale;
  playerLevel: number;
  playerName: string;
  progression?: KingdomProgressionState;
  section?: 'heroes' | 'raid';
}

export function PlayerHud({ dictionary: t, locale, playerLevel, playerName, progression, section }: PlayerHudProps) {
  const sectionQuery = section ? `&section=${section}` : '';
  const displayedLevel = progression?.level ?? playerLevel;
  const xpProgress = progression?.xpRequiredForNextLevel
    ? Math.min(100, Math.round((progression.xpIntoLevel / progression.xpRequiredForNextLevel) * 100))
    : 100;
  const displayedPlayerName = locale === 'fa' && playerName === 'Warden of Dawnkeep'
    ? t.playerTitle
    : playerName || t.playerTitle;
  return (
    <header className="player-hud">
      <div className="player-profile">
        <span className="player-avatar"><Crown aria-hidden="true" size={20} /></span>
        <span className="player-copy">
          <h1>{t.appName}</h1>
          <small><BidiValue>{displayedPlayerName}</BidiValue></small>
        </span>
        <span className="player-level" aria-label={`${t.playerLevel} ${displayedLevel}`} title={progression ? `${progression.xp} XP` : undefined}>
          <small>{t.playerLevel}</small><strong><BidiValue direction="ltr">{displayedLevel}</BidiValue></strong>
          {progression ? <i aria-hidden="true"><b style={{ width: `${xpProgress}%` }} /></i> : null}
        </span>
      </div>

      <div className="player-actions">
        <ExperienceControls dictionary={t} />
        <ApiStatus labels={{ checking: t.serverChecking, online: t.serverOnline, offline: t.serverOffline }} />
        <div className="language-switch" aria-label={t.language}>
          <Link aria-current={locale === 'en' ? 'page' : undefined} href={`/?lang=en${sectionQuery}`}>{t.english}</Link>
          <Link aria-current={locale === 'fa' ? 'page' : undefined} href={`/?lang=fa${sectionQuery}`}>{t.persian}</Link>
        </div>
      </div>
    </header>
  );
}
