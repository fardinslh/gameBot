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
import { EngagementProvider, useEngagement } from '@/features/engagement/engagement-provider';
import { ReturnSummary } from '@/features/engagement/components/return-summary';
import { PlayerExperienceProvider } from '@/features/experience/player-experience-provider';
import { LocalizedGameRoot } from '@/i18n/bidi';
import { ShopPage } from '@/features/shop/components/shop-page';
import { GuildPage } from '@/features/guild/components/guild-page';
import type { KingdomRaidReturnPresentation } from '@/features/raid/domain/raid-journey-presentation';

import { ClientPlatformProvider, useClientPlatform, useSensoryFeedback } from '@/platform/platform-provider';

interface GameShellProps {
  locale: Locale;
  dictionary: Dictionary;
  initialSection: GameSection;
}

export function GameShell({ locale, dictionary, initialSection }: GameShellProps) {
  return (
    <LocalizedGameRoot className="game-viewport" locale={locale}>
      <ClientPlatformProvider>
        <AudioProvider>
          <GameShellContent locale={locale} dictionary={dictionary} initialSection={initialSection} />
        </AudioProvider>
      </ClientPlatformProvider>
    </LocalizedGameRoot>
  );
}

function GameShellContent({ locale, dictionary, initialSection }: GameShellProps) {
  const [activeSection, setActiveSection] = useState<GameSection>(initialSection);
  const [raidInitialView, setRaidInitialView] = useState<RaidView>('overview');
  const [raidReturn, setRaidReturn] = useState<KingdomRaidReturnPresentation | null>(null);
  const platform = useClientPlatform();
  const sensory = useSensoryFeedback();
  const { setMusicContext } = useGameAudio();

  useEffect(() => initializeAnalytics(locale), [locale]);
  useEffect(() => { setMusicContext('KINGDOM'); }, [activeSection, setMusicContext]);
  useEffect(() => {
    trackScreen(activeSection === 'heroes' ? 'HEROES' : activeSection === 'raid' ? 'RAID' : activeSection === 'shop' ? 'SHOP' : activeSection === 'guild' ? 'GUILD' : 'KINGDOM');
  }, [activeSection]);

  // Connect native messenger back button (Bale / Telegram)
  useEffect(() => {
    if (activeSection !== 'kingdom') {
      platform.showBackButton(() => {
        sensory.back();
        setActiveSection('kingdom');
      });
    } else {
      platform.hideBackButton();
    }
    return () => platform.hideBackButton();
  }, [activeSection, platform, sensory]);

  const navigate = (section: GameSection): void => {
    sensory.tap();
    if (section === 'raid') setRaidInitialView('overview');
    setActiveSection(section);
  };
  const openInbox = (): void => {
    sensory.panelOpen();
    setRaidInitialView('inbox');
    setActiveSection('raid');
  };
  const returnFromRaid = (presentation: KingdomRaidReturnPresentation): void => {
    setRaidReturn(presentation);
    setActiveSection('kingdom');
  };
  return (
    <PlayerExperienceProvider dictionary={dictionary}>
      <EngagementProvider>
      {activeSection === 'heroes' ? <HeroesPage locale={locale} dictionary={dictionary} onNavigate={navigate} />
        : activeSection === 'raid' ? <RaidPage locale={locale} dictionary={dictionary} initialView={raidInitialView} onNavigate={navigate} onRaidReturn={returnFromRaid} />
          : activeSection === 'shop' ? <ShopPage locale={locale} dictionary={dictionary} onNavigate={navigate} />
            : activeSection === 'guild' ? <GuildPage locale={locale} dictionary={dictionary} onNavigate={navigate} />
              : <KingdomPage locale={locale} dictionary={dictionary} onNavigate={navigate} onOpenInbox={openInbox} onRaidReturnComplete={() => setRaidReturn(null)} raidReturn={raidReturn} />}
      <EngagementReturnLayer dictionary={dictionary} />
      </EngagementProvider>
    </PlayerExperienceProvider>
  );
}

function EngagementReturnLayer({ dictionary }: { dictionary: Dictionary }) {
  const engagement = useEngagement();
  return engagement.returnSummary ? <ReturnSummary dictionary={dictionary} identity={engagement.state?.kingdomIdentity ?? null} onClose={engagement.dismissReturnSummary} summary={engagement.returnSummary} /> : null;
}
