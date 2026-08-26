'use client';

import { useEffect, useState } from 'react';
import type { Dictionary, Locale } from '@/i18n/config';
import { HeroesPage } from '@/features/heroes/components/heroes-page';
import { KingdomPage } from '@/features/kingdom/components/kingdom-page';
import { RaidPage } from '@/features/raid/components/raid-page';
import type { GameSection } from '@/features/kingdom/components/bottom-navigation';
import type { RaidView } from '@/features/raid/hooks/use-raid-state';
import { initializeAnalytics, trackScreen } from '@/features/analytics/analytics-client';

interface GameShellProps {
  locale: Locale;
  dictionary: Dictionary;
  initialSection: GameSection;
}

export function GameShell({ locale, dictionary, initialSection }: GameShellProps) {
  const [activeSection, setActiveSection] = useState<GameSection>(initialSection);
  const [raidInitialView, setRaidInitialView] = useState<RaidView>('overview');
  useEffect(() => initializeAnalytics(locale), [locale]);
  useEffect(() => {
    trackScreen(activeSection === 'heroes' ? 'HEROES' : activeSection === 'raid' ? 'RAID' : 'KINGDOM');
  }, [activeSection]);
  const navigate = (section: GameSection): void => {
    if (section === 'raid') setRaidInitialView('overview');
    setActiveSection(section);
  };
  const openInbox = (): void => {
    setRaidInitialView('inbox');
    setActiveSection('raid');
  };
  if (activeSection === 'heroes') return <HeroesPage locale={locale} dictionary={dictionary} onNavigate={navigate} />;
  if (activeSection === 'raid') return <RaidPage locale={locale} dictionary={dictionary} initialView={raidInitialView} onNavigate={navigate} />;
  return <KingdomPage locale={locale} dictionary={dictionary} onNavigate={navigate} onOpenInbox={openInbox} />;
}
