'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { History } from 'lucide-react';
import type { ArmyResponse, ResourceAmounts } from '@crown-and-coin/shared';
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
import { useRetentionState } from '@/features/retention/hooks/use-retention-state';
import { RetentionEntry } from '@/features/retention/components/retention-entry';
import { RetentionSheet } from '@/features/retention/components/retention-sheet';
import { useShopState } from '@/features/shop/hooks/use-shop-state';
import { aggregateProductionRates } from '../domain/collection-presentation';
import { useEngagement } from '@/features/engagement/engagement-provider';
import { EngagementGoalCard } from '@/features/engagement/components/engagement-goal-card';
import { RoyalDecreeSheet } from '@/features/engagement/components/royal-decree-sheet';
import { UpgradeCelebration } from '@/features/engagement/components/upgrade-celebration';
import { fetchArmy } from '@/features/army/api/army-api';
import type { KingdomRaidReturnPresentation } from '@/features/raid/domain/raid-journey-presentation';

interface KingdomPageProps {
  dictionary: Dictionary;
  locale: Locale;
  onNavigate(section: GameSection): void;
  onOpenInbox(): void;
  onRaidReturnComplete(): void;
  raidReturn: KingdomRaidReturnPresentation | null;
}

export function KingdomPage({ dictionary: t, locale, onNavigate, onOpenInbox, onRaidReturnComplete, raidReturn }: KingdomPageProps) {
  const economy = useKingdomState();
  const experience = usePlayerExperience();
  const audio = useGameAudio();
  const inboxCount = useInboxCount();
  const [selectedBuildingId, setSelectedBuildingId] = useState<WorldBuildingId | null>(null);
  useEffect(() => {
    experience.setAdvisorTipsSuppressed(Boolean(raidReturn));
    return () => experience.setAdvisorTipsSuppressed(false);
  }, [experience.setAdvisorTipsSuppressed, raidReturn]);
  const [comingSoonSection, setComingSoonSection] = useState<string | null>(null);
  const [progressOpen, setProgressOpen] = useState(false);
  const [retentionOpen, setRetentionOpen] = useState(false);
  const [decreeOpen, setDecreeOpen] = useState(false);
  const [kingdomArmy, setKingdomArmy] = useState<ArmyResponse | null>(null);
  const retentionEnabled = experience.onboarding?.status === 'COMPLETED' || experience.onboarding?.status === 'SKIPPED';
  const refreshKingdom = useCallback(async () => { await economy.refresh(); }, [economy.refresh]);
  const retention = useRetentionState(retentionEnabled, refreshKingdom);
  const engagement = useEngagement();
  const shop = useShopState(false);
  const selectedBuilding = isActiveBuildingId(selectedBuildingId) ? economy.buildings.find((item) => item.visualId === selectedBuildingId) ?? null : null;
  const selectedFutureBuilding = FUTURE_BUILDING_LAYOUT.find((item) => item.id === selectedBuildingId) ?? null;
  const finishOffer = selectedBuilding ? shop.state?.convenience.buildingFinishes.find((offer) => offer.buildingId === selectedBuilding.id) ?? null : null;
  const activeError = engagement.errorCode ?? shop.errorCode ?? economy.errorCode;
  const balances: ResourceAmounts = economy.state?.balances ?? { GOLD: '0', FOOD: '0', WOOD: '0', STONE: '0', GEMS: '0' };
  const displayedBalances = economy.displayedBalances ?? balances;
  const productionRates = useMemo(() => aggregateProductionRates(economy.buildings), [economy.buildings]);
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
    const controller = new AbortController();
    void fetchArmy(controller.signal).then(setKingdomArmy).catch((error) => {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setKingdomArmy(null);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (selectedBuildingId === 'castle') experience.requestAdvisorTip('CASTLE_PROGRESSION');
  }, [experience, selectedBuildingId]);

  useEffect(() => {
    if (economy.state?.buildings.some((building) => building.activeUpgrade)) void shop.refresh();
  }, [economy.state?.buildings, shop.refresh]);

  const handleBuildingSelect = useCallback((buildingId: WorldBuildingId) => {
    audio.playSfx('building_select');
    setSelectedBuildingId(buildingId);
  }, [audio]);

  const handleEngagementGoal = useCallback(() => {
    const goal = engagement.state?.nextGoal;
    if (!goal) return;
    audio.playSfx('ui_tap');
    if (goal.kind === 'CLAIM_REWARD') { setRetentionOpen(true); return; }
    if (goal.kind === 'ROYAL_DECREE') { setDecreeOpen(true); return; }
    if (goal.kind === 'COLLECT_RESOURCES') { void economy.collect(); return; }
    if (goal.kind === 'WIN_RAID') { onNavigate('raid'); return; }
    if (goal.buildingType) {
      const building = economy.buildings.find((item) => item.type === goal.buildingType);
      if (building) setSelectedBuildingId(building.visualId);
    }
  }, [audio, economy, engagement.state?.nextGoal, onNavigate]);

  return (
    <>
      <a className="skip-link" href="#kingdom-world">{t.skipToGame}</a>
      <main className="kingdom-shell" id="kingdom-world">
        <KingdomScene
          army={kingdomArmy}
          buildingLabels={buildingLabels}
          buildings={economy.buildings}
          expansionStage={economy.state?.kingdomExpansionStage ?? 1}
          errorLabel={t.kingdomLoadError}
          loadingLabel={t.loadingKingdom}
          locale={locale}
          onSelect={handleBuildingSelect}
          onRaidReturnComplete={onRaidReturnComplete}
          panLabel={t.dragToExplore}
          selectedBuildingId={selectedBuildingId}
          raidReturn={raidReturn}
        />

        {raidReturn ? <div className={`kingdom-raid-return kingdom-raid-return--${raidReturn.outcome.toLowerCase()}`} data-raid-return-presentation={raidReturn.outcome} role="status">
          <strong>{raidReturn.outcome === 'VICTORY' ? t.raidJourney.returnVictory : t.raidJourney.returnDefeat}</strong>
          <span>{raidReturn.outcome === 'VICTORY' ? t.raidJourney.returnVictoryBody : t.raidJourney.returnDefeatBody}</span>
        </div> : null}

        <div className="game-ui-layer">
          <PlayerHud
            dictionary={t}
            gemBalance={balances.GEMS}
            locale={locale}
            playerLevel={economy.state?.player.level ?? 1}
            playerName={economy.state?.player.displayName ?? t.playerTitle}
            progression={economy.state?.progression}
            profileCrest={economy.state?.player.equippedProfileCrest}
          />
          <ResourceHud balances={balances} capacities={economy.state?.storageCapacities} dictionary={t} displayedBalances={displayedBalances} gains={economy.lastGains} productionRates={productionRates} />
          <button className="kingdom-inbox-button" aria-label={`${t.inboxUi.title}: ${inboxCount}`} onClick={onOpenInbox} type="button">
            <History aria-hidden="true" size={17} />
            <span>{t.inboxUi.title}</span>
            {inboxCount > 0 ? <b><BidiValue direction="ltr">{inboxCount > 99 ? '99+' : inboxCount}</BidiValue></b> : null}
          </button>
          {retentionEnabled ? <RetentionEntry dictionary={t} state={retention.state} onOpen={() => { audio.playSfx('panel_open'); setRetentionOpen(true); void retention.refresh(); }} /> : null}
          {economy.state ? (
            <CollectControl
              balances={balances}
              buildings={economy.buildings}
              capacities={economy.state.storageCapacities}
              dictionary={t}
              disabled={economy.action !== 'idle'}
              lastGains={economy.lastGains}
              lastCollectedAt={economy.state.kingdom.lastCollectedAt}
              offlineCapHours={economy.state.offlineCapHours}
              onCollect={() => void economy.collect()}
              serverNow={economy.serverNow}
              serverTime={economy.state.serverTime}
            />
          ) : null}
          {retentionEnabled && engagement.state && !raidReturn && !selectedBuildingId && !retentionOpen && !progressOpen ? <EngagementGoalCard
            dictionary={t}
            engagement={engagement.state}
            onAction={handleEngagementGoal}
            onOpenProgress={() => setRetentionOpen(true)}
          /> : null}
          <BuildingDetailSheet
            actionPending={economy.action !== 'idle' || shop.action !== 'idle'}
            building={selectedBuilding}
            dictionary={t}
            finishOffer={finishOffer}
            identity={economy.state ? { name: economy.state.kingdom.name, rulerTitle: economy.state.kingdom.rulerTitle, heraldry: economy.state.kingdom.heraldry } : null}
            onClose={() => setSelectedBuildingId(null)}
            onOpenProgress={() => { setSelectedBuildingId(null); setProgressOpen(true); }}
            onSaveIdentity={economy.saveIdentity}
            onFinishUpgrade={async (offer) => { if (await shop.purchase(offer.itemKey, offer.targetId)) await economy.refresh(); }}
            onUpgrade={(buildingId) => void economy.upgrade(buildingId)}
            playerName={economy.state?.player.displayName ?? t.playerTitle}
            serverNow={economy.serverNow}
            transformation={economy.state?.kingdomGoals.transformation ?? null}
          />
          <KingdomProgressSheet
            dictionary={t}
            goals={economy.state?.kingdomGoals ?? null}
            onClose={() => setProgressOpen(false)}
            open={progressOpen}
            progression={economy.state?.progression ?? null}
          />
          {retentionOpen ? <RetentionSheet
            action={retention.action}
            dictionary={t}
            errorCode={retention.errorCode}
            onClaimAchievement={(key, tier) => void retention.claimAchievement(key, tier)}
            onClaimDailyBonus={() => void retention.claimDailyBonus()}
            onClaimDailyReturn={() => void retention.claimDailyReturn()}
            onClaimMission={(id) => void retention.claimMission(id)}
            onClose={() => setRetentionOpen(false)}
            onRetry={() => void retention.refresh()}
            serverNow={retention.serverNow}
            state={retention.state}
          /> : null}
          {decreeOpen && engagement.state ? <RoyalDecreeSheet action={engagement.action} decree={engagement.state.royalDecree} dictionary={t} onClaim={() => void engagement.claimDecree().then((claimed) => { if (claimed) setDecreeOpen(false); })} onClose={() => setDecreeOpen(false)} /> : null}
          {economy.completedUpgrade ? <UpgradeCelebration before={economy.completedUpgrade.before} after={economy.completedUpgrade.after} dictionary={t} effectGainedBps={economy.completedUpgrade.effectGainedBps} identity={economy.state ? { name: economy.state.kingdom.name, rulerTitle: economy.state.kingdom.rulerTitle, heraldry: economy.state.kingdom.heraldry } : null} onClose={economy.dismissCompletedUpgrade} realmState={economy.state?.kingdomGoals.transformation.current.realmState ?? null} storageGained={economy.completedUpgrade.storageGained} xpGained={economy.completedUpgrade.xpGained} /> : null}
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
          <div className={shop.success ? 'shop-toast shop-toast--visible' : 'shop-toast'} role="status">{shop.success ? t.shopUi.success : ''}</div>
          <div className={activeError ? 'economy-error economy-error--visible' : 'economy-error'} role="alert">
            {engagement.errorCode ? (t.engagement.errors[engagement.errorCode as keyof typeof t.engagement.errors] ?? t.engagement.errors.SERVER_ERROR) : shop.errorCode ? (t.shopErrors[shop.errorCode as keyof typeof t.shopErrors] ?? t.shopErrors.SERVER_ERROR) : economy.errorCode ? errorMessage(economy.errorCode, t) : ''}
            {activeError ? <button onClick={() => engagement.errorCode ? void engagement.refresh() : shop.errorCode ? shop.clearError() : void economy.refresh()} type="button">{shop.errorCode ? t.close : t.retry}</button> : null}
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
