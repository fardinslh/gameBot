'use client';

import { useState } from 'react';
import type { Dictionary, Locale } from '@/i18n/config';
import { HeroesPage } from '@/features/heroes/components/heroes-page';
import { KingdomPage } from '@/features/kingdom/components/kingdom-page';
import type { GameSection } from '@/features/kingdom/components/bottom-navigation';

interface GameShellProps {
  locale: Locale;
  dictionary: Dictionary;
  initialSection: GameSection;
}

export function GameShell({ locale, dictionary, initialSection }: GameShellProps) {
  const [activeSection, setActiveSection] = useState<GameSection>(initialSection);
  return activeSection === 'heroes'
    ? <HeroesPage locale={locale} dictionary={dictionary} onNavigate={setActiveSection} />
    : <KingdomPage locale={locale} dictionary={dictionary} onNavigate={setActiveSection} />;
}
