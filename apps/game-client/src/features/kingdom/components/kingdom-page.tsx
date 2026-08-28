'use client';

import { useCallback, useEffect, useState } from 'react';
import { History } from 'lucide-react';
import type { ResourceAmounts } from '@crown-and-coin/shared';
import type { Dictionary, Locale } from '@/i18n/config';
import type { BuildingId, WorldBuildingId } from '../domain/kingdom-types';
import { FUTURE_BUILDING_LAYOUT } from '../data/building-layout';
import { useKingdomState } from '../hooks/use-kingdom-state';
import { BottomNavigation } from './bottom-navigation';
import type { GameSection } from './bottom-navigation';
import { BuildingDetailSheet } from './building-detail-sheet';
import { CollectControl } from './collect-control';
import { KingdomScene } from './kingdom-scene';
import { PlayerHud } from './player-hud';
import { ResourceHud } from './resource-hud';
import { useInboxCount } from '@/features/raid/hooks/use-inbox-count';
import { LockedBuildingSheet } from './locked-building-sheet';
import { AdvisorCoach, usePlayerExperience } from '@/features/experience/player-experience-provider';
import { useGameAudio } from '@/features/audio/audio-provider';
import { BidiTemplate, BidiValue } from '@/i18n/bidi';
import { KingdomProgressSheet } from './kingdom-progress-sheet';

interface KingdomPageProps {
  dictionary: Dictionary;
  locale: Locale;
  onNavigate(section: GameSection): void;
  onOpenInbox(): void;
}

export function KingdomPage({ dictionary: t, locale, onNavigate, onOpenInbox }: KingdomPageProps) {
  const economy = useKingdomState();
  const experience = usePlayerExperience();
  const audio = useGameAudio();
  const inboxCount = useInboxCount();
  const [selectedBuildingId, setSelectedBuildingId] = useState<WorldBuildingId | null>(null);
  const [comingSoonSection, setComingSoonSection] = useState<string | null>(null);
  const [progressOpen, setProgressOpen] = useState(false);
  const selectedBuilding = isActiveBuildingId(selectedBuildingId) ? economy.buildings.find((item) => item.visualId === selectedBuildingId) ?? null : null;
  const selectedFutureBuilding = FUTURE_BUILDING_LAYOUT.find((item) => item.id === selectedBuildingId) ?? null;
  const balances: ResourceAmounts = economy.state?.balances ?? { GOLD: '0', FOOD: '0', WOOD: '0', STONE: '0', GEMS: '0' };
  const buildingLabels: Record<WorldBuildingId, string> = {
    castle: t.buildings.castle.name,
    farm: t.buildings.farm.name,
    lumberMill: t.buildings.lumberMill.name,
    mine: t.buildings.mine.name,
    grandMarket: t.buildings.grandMarket.name,
    barracks: t.futureBuildings.barracks.name,
    blacksmith: t.buildings.blacksmith.name,
    academy: t.buildings.academy.name,
    granary: t.futureBuildings.granary.name,
    watchtower: t.buildings.watchtower.name,
    workshop: t.buildings.workshop.name,
    tavern: t.futureBuildings.tavern.name,
    stable: t.futureBuildings.stable.name,
  };

  useEffect(() => {
    if (!comingSoonSection) return;
    const timeout = window.setTimeout(() => setComingSoonSection(null), 2_200);
    return () => window.clearTimeout(timeout);
  }, [comingSoonSection]);

  useEffect(() => {
    if (selectedBuildingId === 'castle') experience.requestAdvisorTip('CASTLE_PROGRESSION');
  }, [experience, selectedBuildingId]);

  const handleBuildingSelect = useCallback((buildingId: WorldBuildingId) => {
    audio.playSfx('building_select');
    setSelectedBuildingId(buildingId);
  }, [audio]);

  return (
    <>
      <a className="skip-link" href="#kingdom-world">{t.skipToGame}</a>
      <main className="kingdom-shell" id="kingdom-world">
        <KingdomScene
          buildingLabels={buildingLabels}
          buildings={economy.buildings}
          expansionStage={economy.state?.kingdomExpansionStage ?? 1}
          errorLabel={t.kingdomLoadError}
          loadingLabel={t.loadingKingdom}
          onSelect={handleBuildingSelect}
          panLabel={t.dragToExplore}
          selectedBuildingId={selectedBuildingId}
        />

        <div className="game-ui-layer">
          <PlayerHud
            dictionary={t}
            locale={locale}
            playerLevel={economy.state?.player.level ?? 1}
            playerName={economy.state?.player.displayName ?? t.playerTitle}
            progression={economy.state?.progression}
          />
          <ResourceHud balances={balances} capacities={economy.state?.storageCapacities} dictionary={t} />
          <button className="kingdom-inbox-button" aria-label={`${t.inboxUi.title}: ${inboxCount}`} onClick={onOpenInbox} type="button">
            <History aria-hidden="true" size={17} />
            <span>{t.inboxUi.title}</span>
            {inboxCount > 0 ? <b><BidiValue direction="ltr">{inboxCount > 99 ? '99+' : inboxCount}</BidiValue></b> : null}
          </button>
          {economy.state ? (
            <CollectControl
              buildings={economy.buildings}
              dictionary={t}
              disabled={economy.action !== 'idle'}
              lastGains={economy.lastGains}
              offlineCapHours={economy.state.offlineCapHours}
              onCollect={() => void economy.collect()}
              serverNow={economy.serverNow}
              serverTime={economy.state.serverTime}
            />
          ) : null}
          <BuildingDetailSheet
            actionPending={economy.action === 'upgrading'}
            building={selectedBuilding}
            dictionary={t}
            onClose={() => setSelectedBuildingId(null)}
            onOpenProgress={() => { setSelectedBuildingId(null); setProgressOpen(true); }}
            onUpgrade={(buildingId) => void economy.upgrade(buildingId)}
            serverNow={economy.serverNow}
          />
          <KingdomProgressSheet
            dictionary={t}
            goals={economy.state?.kingdomGoals ?? null}
            onClose={() => setProgressOpen(false)}
            open={progressOpen}
            progression={economy.state?.progression ?? null}
          />
          <LockedBuildingSheet building={selectedFutureBuilding} dictionary={t} onClose={() => setSelectedBuildingId(null)} />
          {experience.onboarding?.status === 'IN_PROGRESS' && experience.onboarding.currentStep === 'COLLECT'
            ? <AdvisorCoach title={t.experience.collectTitle} body={t.experience.advisor.collect} target="collect" /> : null}
          {experience.onboarding?.status === 'IN_PROGRESS' && experience.onboarding.currentStep === 'UPGRADE'
            ? <AdvisorCoach title={t.experience.upgradeTitle} body={t.experience.advisor.upgrade} target="upgrade" /> : null}
          {experience.onboarding?.status === 'IN_PROGRESS' && experience.onboarding.currentStep === 'RAID'
            ? <AdvisorCoach title={t.experience.raidTitle} body={t.experience.advisor.raid} target="raid-tab" /> : null}
          <BottomNavigation activeSection="kingdom" dictionary={t} onComingSoon={setComingSoonSection} onNavigate={onNavigate} />
          <div className={comingSoonSection ? 'coming-soon-toast coming-soon-toast--visible' : 'coming-soon-toast'} role="status">
            {comingSoonSection ? <BidiTemplate template={t.comingSoonMessage} values={{ section: comingSoonSection }} /> : ''}
          </div>
          <div className={economy.errorCode ? 'economy-error economy-error--visible' : 'economy-error'} role="alert">
            {economy.errorCode ? errorMessage(economy.errorCode, t) : ''}
            {economy.errorCode ? <button onClick={() => void economy.refresh()} type="button">{t.retry}</button> : null}
          </div>
        </div>
      </main>
    </>
  );
}

function isActiveBuildingId(id: WorldBuildingId | null): id is BuildingId {
  return id === 'castle' || id === 'farm' || id === 'lumberMill' || id === 'mine' || id === 'grandMarket'
    || id === 'academy' || id === 'blacksmith' || id === 'watchtower' || id === 'workshop';
}

function errorMessage(code: string, t: Dictionary): string {
  return t.economyErrors[code as keyof typeof t.economyErrors] ?? t.economyErrors.SERVER_ERROR;
}
