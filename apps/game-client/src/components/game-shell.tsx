'use client';

import { useEffect, useState } from 'react';
import type { Dictionary, Locale } from '@/i18n/config';
import { HeroesPage } from '@/features/heroes/components/heroes-page';
import { KingdomPage } from '@/features/kingdom/components/kingdom-page';
import { RaidPage } from '@/features/raid/components/raid-page';
import type { GameSection } from '@/features/kingdom/components/bottom-navigation';
import type { RaidView } from '@/features/raid/hooks/use-raid-state';
import { initializeAnalytics, trackScreen } from '@/features/analytics/analytics-client';
import { AudioProvider, useGameAudio } from '@/features/audio/audio-provider';
import { PlayerExperienceProvider } from '@/features/experience/player-experience-provider';
import { LocalizedGameRoot } from '@/i18n/bidi';
import { ShopPage } from '@/features/shop/components/shop-page';

interface GameShellProps {
  locale: Locale;
  dictionary: Dictionary;
  initialSection: GameSection;
}

export function GameShell({ locale, dictionary, initialSection }: GameShellProps) {
  return (
    <LocalizedGameRoot className="game-viewport" locale={locale}>
      <AudioProvider><GameShellContent locale={locale} dictionary={dictionary} initialSection={initialSection} /></AudioProvider>
    </LocalizedGameRoot>
  );
}

function GameShellContent({ locale, dictionary, initialSection }: GameShellProps) {
  const [activeSection, setActiveSection] = useState<GameSection>(initialSection);
  const [raidInitialView, setRaidInitialView] = useState<RaidView>('overview');
  const { playSfx, setMusicContext } = useGameAudio();
  useEffect(() => initializeAnalytics(locale), [locale]);
  useEffect(() => { setMusicContext('KINGDOM'); }, [activeSection, setMusicContext]);
  useEffect(() => {
    trackScreen(activeSection === 'heroes' ? 'HEROES' : activeSection === 'raid' ? 'RAID' : activeSection === 'shop' ? 'SHOP' : 'KINGDOM');
  }, [activeSection]);
  const navigate = (section: GameSection): void => {
    if (section === 'raid') setRaidInitialView('overview');
    setActiveSection(section);
  };
  const openInbox = (): void => {
    playSfx('panel_open');
    setRaidInitialView('inbox');
    setActiveSection('raid');
  };
  return (
    <PlayerExperienceProvider dictionary={dictionary}>
      {activeSection === 'heroes' ? <HeroesPage locale={locale} dictionary={dictionary} onNavigate={navigate} />
        : activeSection === 'raid' ? <RaidPage locale={locale} dictionary={dictionary} initialView={raidInitialView} onNavigate={navigate} />
          : activeSection === 'shop' ? <ShopPage locale={locale} dictionary={dictionary} onNavigate={navigate} />
          : <KingdomPage locale={locale} dictionary={dictionary} onNavigate={navigate} onOpenInbox={openInbox} />}
    </PlayerExperienceProvider>
  );
}
