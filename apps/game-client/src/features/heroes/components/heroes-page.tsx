'use client';

import { useEffect, useMemo, useState } from 'react';
import { Shield } from 'lucide-react';
import type { Dictionary, Locale } from '@/i18n/config';
import type { GameSection } from '@/features/kingdom/components/bottom-navigation';
import { BottomNavigation } from '@/features/kingdom/components/bottom-navigation';
import { PlayerHud } from '@/features/kingdom/components/player-hud';
import { ResourceHud } from '@/features/kingdom/components/resource-hud';
import { useHeroState } from '../hooks/use-hero-state';
import { HeroCard } from './hero-card';
import { HeroDetailSheet } from './hero-detail-sheet';
import { RaidTeamPanel } from './raid-team-panel';
import { useGameAudio } from '@/features/audio/audio-provider';
import { usePlayerExperience } from '@/features/experience/player-experience-provider';
import { BidiTemplate, BidiValue } from '@/i18n/bidi';

interface HeroesPageProps {
  dictionary: Dictionary;
  locale: Locale;
  onNavigate(section: GameSection): void;
}

const EMPTY_BALANCES = { GOLD: '0', FOOD: '0', WOOD: '0', STONE: '0', GEMS: '0' } as const;

export function HeroesPage({ dictionary: t, locale, onNavigate }: HeroesPageProps) {
  const roster = useHeroState();
  const audio = useGameAudio();
  const experience = usePlayerExperience();
  const [targetSlot, setTargetSlot] = useState(0);
  const [selectedHeroId, setSelectedHeroId] = useState<string | null>(null);
  const [comingSoonSection, setComingSoonSection] = useState<string | null>(null);
  const selectedHero = useMemo(
    () => roster.state?.heroes.find((hero) => hero.id === selectedHeroId) ?? null,
    [roster.state, selectedHeroId],
  );

  useEffect(() => {
    if (!comingSoonSection) return;
    const timeout = window.setTimeout(() => setComingSoonSection(null), 2_200);
    return () => window.clearTimeout(timeout);
  }, [comingSoonSection]);

  useEffect(() => {
    if (roster.state) experience.requestAdvisorTip('HEROES_INTRO');
  }, [experience, roster.state]);

  const state = roster.state;
  return (
    <>
      <main className="heroes-shell">
        <div className="heroes-backdrop" aria-hidden="true" />
        <div className="game-ui-layer">
          <PlayerHud
            dictionary={t}
            locale={locale}
            playerLevel={state?.player.level ?? 1}
            playerName={state?.player.displayName ?? t.playerTitle}
            section="heroes"
          />
          <ResourceHud balances={state?.balances ?? EMPTY_BALANCES} dictionary={t} />

          <div className="heroes-scroll" data-heroes-status={state ? 'ready' : roster.errorCode ? 'error' : 'loading'}>
            <header className="heroes-titlebar">
              <span><Shield aria-hidden="true" size={18} /></span>
              <div><h1>{t.heroUi.title}</h1><p>{t.heroUi.subtitle}</p></div>
            </header>
            {state ? (
              <>
                <RaidTeamPanel
                  dictionary={t}
                  dirty={roster.teamDirty}
                  heroIds={roster.draftHeroIds}
                  heroes={state.heroes}
                  onSave={() => void roster.saveTeam()}
                  onSelectSlot={setTargetSlot}
                  saved={roster.teamSaved}
                  saving={roster.action === 'saving-team'}
                  targetSlot={targetSlot}
                  teamPower={state.team.power}
                />
                <section className="hero-roster" aria-labelledby="hero-roster-title">
                  <div className="hero-roster__heading"><h2 id="hero-roster-title">{t.heroUi.roster}</h2><span><BidiValue direction="ltr">{state.heroes.length}</BidiValue></span></div>
                  <div className="hero-roster__list">
                    {state.heroes.map((hero) => {
                      const teamSlot = roster.draftHeroIds.indexOf(hero.id);
                      return (
                        <HeroCard
                          dictionary={t}
                          hero={hero}
                          key={hero.id}
                          onAssign={() => roster.assignHero(hero.id, targetSlot)}
                          onOpen={() => { audio.playSfx('hero_select'); setSelectedHeroId(hero.id); }}
                          targetSlot={targetSlot}
                          teamSlot={teamSlot < 0 ? null : teamSlot}
                        />
                      );
                    })}
                  </div>
                </section>
              </>
            ) : (
              <div className="heroes-loading" role="status"><span aria-hidden="true" /><strong>{t.heroUi.loading}</strong></div>
            )}
          </div>

          <HeroDetailSheet
            dictionary={t}
            hero={selectedHero}
            onClose={() => setSelectedHeroId(null)}
            onUpgrade={(heroId) => void roster.upgrade(heroId)}
            upgrading={roster.action === 'upgrading'}
          />
          <BottomNavigation activeSection="heroes" dictionary={t} onComingSoon={setComingSoonSection} onNavigate={onNavigate} />
          <div className={comingSoonSection ? 'coming-soon-toast coming-soon-toast--visible' : 'coming-soon-toast'} role="status">
            {comingSoonSection ? <BidiTemplate template={t.comingSoonMessage} values={{ section: comingSoonSection }} /> : ''}
          </div>
          <div className={roster.errorCode ? 'hero-error hero-error--visible' : 'hero-error'} role="alert">
            {roster.errorCode ? heroErrorMessage(roster.errorCode, t) : ''}
            {roster.errorCode ? <button onClick={() => void roster.refresh()} type="button">{t.retry}</button> : null}
          </div>
        </div>
      </main>
    </>
  );
}

function heroErrorMessage(code: string, t: Dictionary): string {
  return t.heroErrors[code as keyof typeof t.heroErrors] ?? t.heroErrors.SERVER_ERROR;
}
