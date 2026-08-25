import { Crown } from 'lucide-react';
import Link from 'next/link';
import type { Dictionary, Locale } from '@/i18n/config';
import { ApiStatus } from '@/components/api-status';
import type { KingdomProgressionState } from '@crown-and-coin/shared';

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
  const xpProgress = progression?.nextLevelRequirement
    ? Math.min(100, Math.round((progression.xp / progression.nextLevelRequirement) * 100))
    : 100;
  return (
    <header className="player-hud">
      <div className="player-profile">
        <span className="player-avatar"><Crown aria-hidden="true" size={20} /></span>
        <span className="player-copy">
          <h1>{t.appName}</h1>
          <small>{playerName || t.playerTitle}</small>
        </span>
        <span className="player-level" aria-label={`${t.playerLevel} ${displayedLevel}`} title={progression ? `${progression.xp} XP` : undefined}>
          <small>{t.playerLevel}</small><strong>{displayedLevel}</strong>
          {progression ? <i aria-hidden="true"><b style={{ width: `${xpProgress}%` }} /></i> : null}
        </span>
      </div>

      <div className="player-actions">
        <ApiStatus labels={{ checking: t.serverChecking, online: t.serverOnline, offline: t.serverOffline }} />
        <div className="language-switch" aria-label={t.language}>
          <Link aria-current={locale === 'en' ? 'page' : undefined} href={`/?lang=en${sectionQuery}`}>{t.english}</Link>
          <Link aria-current={locale === 'fa' ? 'page' : undefined} href={`/?lang=fa${sectionQuery}`}>{t.persian}</Link>
        </div>
      </div>
    </header>
  );
}
