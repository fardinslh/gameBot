import { Crown } from 'lucide-react';
import Link from 'next/link';
import type { Dictionary, Locale } from '@/i18n/config';
import { ApiStatus } from '@/components/api-status';
import { MOCK_PLAYER_LEVEL } from '../data/mock-kingdom';

interface PlayerHudProps {
  dictionary: Dictionary;
  locale: Locale;
}

export function PlayerHud({ dictionary: t, locale }: PlayerHudProps) {
  return (
    <header className="player-hud">
      <div className="player-profile">
        <span className="player-avatar"><Crown aria-hidden="true" size={20} /></span>
        <span className="player-copy">
          <h1>{t.appName}</h1>
          <small>{t.playerTitle}</small>
        </span>
        <span className="player-level" aria-label={`${t.playerLevel} ${MOCK_PLAYER_LEVEL}`}>
          <small>{t.playerLevel}</small><strong>{MOCK_PLAYER_LEVEL}</strong>
        </span>
      </div>

      <div className="player-actions">
        <ApiStatus labels={{ checking: t.serverChecking, online: t.serverOnline, offline: t.serverOffline }} />
        <div className="language-switch" aria-label={t.language}>
          <Link aria-current={locale === 'en' ? 'page' : undefined} href="/?lang=en">{t.english}</Link>
          <Link aria-current={locale === 'fa' ? 'page' : undefined} href="/?lang=fa">{t.persian}</Link>
        </div>
      </div>
    </header>
  );
}
