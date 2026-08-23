'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Dictionary, Locale } from '@/i18n/config';
import { MOCK_KINGDOM_BUILDINGS } from '../data/mock-kingdom';
import type { BuildingId } from '../domain/kingdom-types';
import { BottomNavigation } from './bottom-navigation';
import { BuildingDetailSheet } from './building-detail-sheet';
import { KingdomScene } from './kingdom-scene';
import { PlayerHud } from './player-hud';
import { ResourceHud } from './resource-hud';

interface KingdomPageProps {
  dictionary: Dictionary;
  locale: Locale;
}

export function KingdomPage({ dictionary: t, locale }: KingdomPageProps) {
  const [selectedBuildingId, setSelectedBuildingId] = useState<BuildingId | null>(null);
  const [comingSoonSection, setComingSoonSection] = useState<string | null>(null);
  const selectedBuilding = MOCK_KINGDOM_BUILDINGS.find((item) => item.id === selectedBuildingId) ?? null;
  const direction = locale === 'fa' ? 'rtl' : 'ltr';
  const buildingLabels: Record<BuildingId, string> = {
    castle: t.buildings.castle.name,
    farm: t.buildings.farm.name,
    lumberMill: t.buildings.lumberMill.name,
    mine: t.buildings.mine.name,
    grandMarket: t.buildings.grandMarket.name,
  };

  useEffect(() => {
    if (!comingSoonSection) return;
    const timeout = window.setTimeout(() => setComingSoonSection(null), 2_200);
    return () => window.clearTimeout(timeout);
  }, [comingSoonSection]);

  const handleBuildingSelect = useCallback((buildingId: BuildingId) => {
    setSelectedBuildingId(buildingId);
  }, []);

  return (
    <div className="game-viewport" lang={locale} dir={direction}>
      <a className="skip-link" href="#kingdom-world">{t.skipToGame}</a>
      <main className="kingdom-shell" id="kingdom-world">
        <KingdomScene
          buildingLabels={buildingLabels}
          errorLabel={t.kingdomLoadError}
          loadingLabel={t.loadingKingdom}
          onSelect={handleBuildingSelect}
          selectedBuildingId={selectedBuildingId}
        />

        <div className="game-ui-layer">
          <PlayerHud dictionary={t} locale={locale} />
          <ResourceHud dictionary={t} />
          <BuildingDetailSheet building={selectedBuilding} dictionary={t} onClose={() => setSelectedBuildingId(null)} />
          <BottomNavigation dictionary={t} onComingSoon={setComingSoonSection} />
          <div className={comingSoonSection ? 'coming-soon-toast coming-soon-toast--visible' : 'coming-soon-toast'} role="status">
            {comingSoonSection ? t.comingSoonMessage.replace('{section}', comingSoonSection) : ''}
          </div>
        </div>
      </main>
    </div>
  );
}
