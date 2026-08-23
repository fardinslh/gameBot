'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ResourceAmounts } from '@crown-and-coin/shared';
import type { Dictionary, Locale } from '@/i18n/config';
import type { BuildingId } from '../domain/kingdom-types';
import { useKingdomState } from '../hooks/use-kingdom-state';
import { BottomNavigation } from './bottom-navigation';
import type { GameSection } from './bottom-navigation';
import { BuildingDetailSheet } from './building-detail-sheet';
import { CollectControl } from './collect-control';
import { KingdomScene } from './kingdom-scene';
import { PlayerHud } from './player-hud';
import { ResourceHud } from './resource-hud';

interface KingdomPageProps {
  dictionary: Dictionary;
  locale: Locale;
  onNavigate(section: GameSection): void;
}

export function KingdomPage({ dictionary: t, locale, onNavigate }: KingdomPageProps) {
  const economy = useKingdomState();
  const [selectedBuildingId, setSelectedBuildingId] = useState<BuildingId | null>(null);
  const [comingSoonSection, setComingSoonSection] = useState<string | null>(null);
  const selectedBuilding = economy.buildings.find((item) => item.visualId === selectedBuildingId) ?? null;
  const balances: ResourceAmounts = economy.state?.balances ?? { GOLD: '0', FOOD: '0', WOOD: '0', STONE: '0', GEMS: '0' };
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
          buildings={economy.buildings}
          errorLabel={t.kingdomLoadError}
          loadingLabel={t.loadingKingdom}
          onSelect={handleBuildingSelect}
          selectedBuildingId={selectedBuildingId}
        />

        <div className="game-ui-layer">
          <PlayerHud
            dictionary={t}
            locale={locale}
            playerLevel={economy.state?.player.level ?? 1}
            playerName={economy.state?.player.displayName ?? t.playerTitle}
          />
          <ResourceHud balances={balances} dictionary={t} />
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
            onUpgrade={(buildingId) => void economy.upgrade(buildingId)}
            serverNow={economy.serverNow}
          />
          <BottomNavigation activeSection="kingdom" dictionary={t} onComingSoon={setComingSoonSection} onNavigate={onNavigate} />
          <div className={comingSoonSection ? 'coming-soon-toast coming-soon-toast--visible' : 'coming-soon-toast'} role="status">
            {comingSoonSection ? t.comingSoonMessage.replace('{section}', comingSoonSection) : ''}
          </div>
          <div className={economy.errorCode ? 'economy-error economy-error--visible' : 'economy-error'} role="alert">
            {economy.errorCode ? errorMessage(economy.errorCode, t) : ''}
            {economy.errorCode ? <button onClick={() => void economy.refresh()} type="button">{t.retry}</button> : null}
          </div>
        </div>
      </main>
    </div>
  );
}

function errorMessage(code: string, t: Dictionary): string {
  return t.economyErrors[code as keyof typeof t.economyErrors] ?? t.economyErrors.SERVER_ERROR;
}
