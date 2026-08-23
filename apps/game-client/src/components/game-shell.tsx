import { Castle, Crown, Gem, Shield, ShoppingBag, Sparkles, Swords, Users, Wheat } from 'lucide-react';
import Link from 'next/link';
import type { Dictionary, Locale } from '@/i18n/config';
import { ApiStatus } from './api-status';
import { CastleMark } from './castle-mark';

interface GameShellProps {
  locale: Locale;
  dictionary: Dictionary;
}

export function GameShell({ locale, dictionary: t }: GameShellProps) {
  const direction = locale === 'fa' ? 'rtl' : 'ltr';
  const navItems = [
    { label: t.kingdom, Icon: Castle, enabled: true },
    { label: t.raid, Icon: Swords, enabled: false },
    { label: t.heroes, Icon: Shield, enabled: false },
    { label: t.guild, Icon: Users, enabled: false },
    { label: t.shop, Icon: ShoppingBag, enabled: false },
  ];
  const resources = [
    { label: t.resourceGold, value: '1,250', Icon: Crown },
    { label: t.resourceFood, value: '840', Icon: Wheat },
    { label: t.resourceGems, value: '25', Icon: Gem },
  ];

  return (
    <div className="game-viewport" lang={locale} dir={direction}>
      <a className="skip-link" href="#kingdom">{t.skipToGame}</a>
      <div className="ambient ambient--one" />
      <div className="ambient ambient--two" />

      <main className="game-shell" id="kingdom">
        <header className="topbar">
          <div className="brand-lockup">
            <span className="brand-seal"><Crown aria-hidden="true" size={19} /></span>
            <div>
              <h1>{t.appName}</h1>
              <p>{t.playerRank}</p>
            </div>
          </div>
          <div className="language-switch" aria-label={t.language}>
            <Link aria-current={locale === 'en' ? 'page' : undefined} href="/?lang=en">{t.english}</Link>
            <Link aria-current={locale === 'fa' ? 'page' : undefined} href="/?lang=fa">{t.persian}</Link>
          </div>
        </header>

        <section className="resource-bar" aria-label={t.mockData}>
          <span className="mock-label">{t.mockData}</span>
          {resources.map(({ label, value, Icon }) => (
            <div className="resource" key={label}>
              <Icon aria-hidden="true" size={16} />
              <span className="resource__copy"><small>{label}</small><strong>{value}</strong></span>
            </div>
          ))}
        </section>

        <section className="kingdom-card">
          <div className="kingdom-card__sky">
            <ApiStatus labels={{ checking: t.serverChecking, online: t.serverOnline, offline: t.serverOffline }} />
            <div className="stars" aria-hidden="true" />
            <CastleMark />
          </div>
          <div className="kingdom-card__content">
            <div>
              <p className="eyebrow"><Sparkles aria-hidden="true" size={14} />{t.kingdomEyebrow}</p>
              <h2>{t.kingdomName}</h2>
              <p className="level">{t.kingdomLevel}</p>
            </div>
            <p className="description">{t.kingdomDescription}</p>
            <div className="ready-panel">
              <span className="ready-panel__icon"><Castle aria-hidden="true" size={22} /></span>
              <div><strong>{t.kingdomAction}</strong><small>{t.serverAuthority}</small></div>
            </div>
          </div>
        </section>

        <nav className="bottom-nav" aria-label={t.navLabel}>
          {navItems.map(({ label, Icon, enabled }) => (
            <button
              className={enabled ? 'nav-item nav-item--active' : 'nav-item'}
              disabled={!enabled}
              key={label}
              title={enabled ? label : `${label} — ${t.comingLater}`}
              type="button"
            >
              <span className="nav-item__icon"><Icon aria-hidden="true" size={21} /></span>
              <span>{label}</span>
              {!enabled ? <small>{t.comingLater}</small> : null}
            </button>
          ))}
        </nav>
      </main>
    </div>
  );
}
