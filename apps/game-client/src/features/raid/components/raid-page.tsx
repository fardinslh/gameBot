'use client';

import { useEffect, useState } from 'react';
import { Coins, Crown, History, Shield, Swords, Trophy } from 'lucide-react';
import type { Dictionary, Locale } from '@/i18n/config';
import type { GameSection } from '@/features/kingdom/components/bottom-navigation';
import { BottomNavigation } from '@/features/kingdom/components/bottom-navigation';
import { PlayerHud } from '@/features/kingdom/components/player-hud';
import { ResourceHud, formatAmount } from '@/features/kingdom/components/resource-hud';
import { useRaidState, type RaidView } from '../hooks/use-raid-state';
import { BattleScene } from './battle-scene';
import { BattleDetail } from './battle-detail';
import { BattleLog } from './battle-log';
import { RevengePreview } from './revenge-preview';
import { trackScreen } from '@/features/analytics/analytics-client';
import { AdvisorCoach, usePlayerExperience } from '@/features/experience/player-experience-provider';
import { useGameAudio } from '@/features/audio/audio-provider';
import { BidiTemplate, BidiValue } from '@/i18n/bidi';
import { useCampaignState } from '@/features/campaign/hooks/use-campaign-state';
import { CampaignMap } from '@/features/campaign/components/campaign-map';
import { CampaignResult } from '@/features/campaign/components/campaign-result';

interface RaidPageProps { dictionary: Dictionary; locale: Locale; initialView?: RaidView; onNavigate(section: GameSection): void; }
const EMPTY = { GOLD: '0', FOOD: '0', WOOD: '0', STONE: '0', GEMS: '0' } as const;

export function RaidPage({ dictionary: t, locale, initialView = 'overview', onNavigate }: RaidPageProps) {
  const raid = useRaidState(initialView);
  const [combatMode, setCombatMode] = useState<'raid' | 'campaign'>('raid');
  const campaign = useCampaignState(combatMode === 'campaign');
  const experience = usePlayerExperience();
  const { playSfx, setMusicContext } = useGameAudio();
  const [battleFinished, setBattleFinished] = useState(false);
  const [comingSoon, setComingSoon] = useState<string | null>(null);
  const activeBattle = combatMode === 'campaign' ? campaign.result?.battle ?? null : raid.battle;
  useEffect(() => { if (activeBattle) setBattleFinished(false); }, [activeBattle?.id]);
  useEffect(() => { setMusicContext(activeBattle && !battleFinished ? 'BATTLE' : 'KINGDOM'); }, [activeBattle, battleFinished, setMusicContext]);
  useEffect(() => {
    trackScreen(activeBattle ? (battleFinished ? 'RESULT' : 'BATTLE') : raid.view === 'inbox' && combatMode === 'raid' ? 'DEFENSE_INBOX' : 'RAID');
  }, [activeBattle, battleFinished, combatMode, raid.view]);
  useEffect(() => { if (!comingSoon) return; const timer = window.setTimeout(() => setComingSoon(null), 1800); return () => clearTimeout(timer); }, [comingSoon]);
  const state = raid.overview;
  const shieldHours = state?.newPlayerProtection.active && state.newPlayerProtection.expiresAt
    ? Math.max(1, Math.ceil((Date.parse(state.newPlayerProtection.expiresAt) - Date.parse(state.serverTime)) / 3_600_000))
    : 0;
  const tutorialRaid = experience.onboarding?.status === 'IN_PROGRESS' && experience.onboarding.currentStep === 'RAID';
  useEffect(() => {
    if (state?.newPlayerProtection.active && raid.view === 'overview') experience.requestAdvisorTip('NEW_KINGDOM_SHIELD');
    if (raid.view === 'inbox' && raid.inbox?.entries.length) experience.requestAdvisorTip('DEFENSE_INBOX');
    if (raid.inbox?.entries.some((entry) => entry.revengeStatus === 'AVAILABLE')) experience.requestAdvisorTip('REVENGE');
  }, [experience, raid.inbox, raid.view, state?.newPlayerProtection.active]);
  const returnToKingdom = async (): Promise<void> => {
    await experience.refreshOnboarding();
    playSfx('back');
    onNavigate('kingdom');
  };

  return (
    <>
      <main className="raid-shell">
        <div className="raid-backdrop" aria-hidden="true" />
        <div className="game-ui-layer">
          <PlayerHud dictionary={t} locale={locale} playerLevel={state?.player.level ?? 1} playerName={state?.player.displayName ?? t.playerTitle} section="raid" />
          <ResourceHud balances={combatMode === 'campaign' ? campaign.state?.balances ?? state?.balances ?? EMPTY : raid.battle?.balances ?? state?.balances ?? EMPTY} dictionary={t} />
          <section className="raid-content" data-player-id={state?.player.id} data-combat-mode={combatMode} data-raid-state={activeBattle ? battleFinished ? 'result' : 'battle' : combatMode === 'campaign' ? 'campaign' : raid.view === 'inbox' ? 'inbox' : raid.offer ? 'offer' : 'overview'}>
            {combatMode === 'campaign' ? campaign.result ? battleFinished ? (
              <CampaignResult
                dictionary={t}
                locale={locale}
                onContinue={campaign.clearResult}
                onEditArmy={() => onNavigate('heroes')}
                onRetry={() => { const stageKey = campaign.result?.stageKey; campaign.clearResult(); if (stageKey) void campaign.attack(stageKey); }}
                result={campaign.result}
              />
            ) : (
              <div className="raid-battle-wrap"><BattleScene battle={campaign.result.battle} onComplete={() => { playSfx(campaign.result?.battle.result === 'ATTACKER_WIN' ? 'victory' : 'defeat'); setBattleFinished(true); }} /><div className="raid-battle-label"><Swords size={16} /> {t.campaign.battleLabel} · {campaign.result.campaign.chapter.stages.find((stage) => stage.key === campaign.result?.stageKey)?.title[locale]}</div></div>
            ) : (
              <><CombatModeTabs active={combatMode} dictionary={t} onChange={(mode) => { setCombatMode(mode); if (mode === 'campaign') experience.requestAdvisorTip('CAMPAIGN_INTRO'); }} /><CampaignMap campaign={campaign} dictionary={t} locale={locale} onEditArmy={() => onNavigate('heroes')} /></>
            ) : raid.battle ? battleFinished ? (
              <div className={`raid-result raid-result--${raid.battle.result === 'ATTACKER_WIN' ? 'victory' : 'defeat'}`}>
                <span className="raid-result__crest"><Crown size={30} /></span>
                <small>{t.raidUi.battleComplete}</small>
                <h1>{raid.battle.type === 'REVENGE' ? (raid.battle.result === 'ATTACKER_WIN' ? t.inboxUi.revengeVictory : t.inboxUi.revengeDefeat) : (raid.battle.result === 'ATTACKER_WIN' ? t.raidUi.victory : t.raidUi.defeat)}</h1>
                <p><Trophy size={15} /> <BidiValue direction="ltr">{raid.battle.attacker.trophyDelta > 0 ? '+' : ''}{raid.battle.attacker.trophyDelta}</BidiValue> {t.raidUi.trophies}</p>
                <div className="raid-loot-grid">{Object.entries(raid.battle.loot).map(([resource, amount]) => <span key={resource}><b><BidiValue direction="ltr">{formatAmount(amount)}</BidiValue></b><small>{t.resourceShort[resource as keyof typeof t.resourceShort]}</small></span>)}</div>
                {raid.battle.rulesVersion === 2 ? <div className="raid-army-result">{raid.battle.armies.attacker.map((squad) => {
                  const last = [...raid.battle!.events].reverse().find((event) => event.targetSide === 'ATTACKER' && event.targetSlot === squad.slot && event.remainingUnits !== null);
                  return <span key={squad.slot}><strong>{t.armyUi.troopNames[squad.troopType]}</strong><BidiValue direction="ltr">{squad.initialUnitCount} → {last?.remainingUnits ?? squad.initialUnitCount}</BidiValue></span>;
                })}<small>{t.raidUi.battleLocalLosses}</small></div> : null}
                <button className="raid-primary" data-guide-target="result-return" onClick={raid.battle.type === 'REVENGE' ? raid.clearBattle : () => void returnToKingdom()} type="button">{raid.battle.type === 'REVENGE' ? t.inboxUi.title : t.raidUi.returnKingdom}</button>
                <button className="raid-secondary" onClick={raid.battle.type === 'REVENGE' ? () => onNavigate('kingdom') : raid.clearBattle} type="button">{raid.battle.type === 'REVENGE' ? t.raidUi.returnKingdom : t.raidUi.findAnother}</button>
              </div>
            ) : (
              <div className="raid-battle-wrap"><BattleScene battle={raid.battle} onComplete={() => { raid.finishBattle(); playSfx(raid.battle?.result === 'ATTACKER_WIN' ? 'victory' : 'defeat'); setBattleFinished(true); }} /><div className="raid-battle-label"><Swords size={16} /> {raid.battle.type === 'REVENGE' ? t.inboxUi.revenge : t.raidUi.autoBattle}</div></div>
            ) : raid.revengePreview ? (
              <RevengePreview dictionary={t} onBack={raid.closeRevengePreview} onStart={() => void raid.revenge()} pending={raid.action !== 'idle'} preview={raid.revengePreview} />
            ) : raid.battleDetail ? (
              <BattleDetail battle={raid.battleDetail} dictionary={t} onBack={raid.closeBattleDetail} />
            ) : raid.view === 'inbox' ? (
              <BattleLog dictionary={t} inbox={raid.inbox} loading={raid.action === 'loading-inbox'} onBack={raid.closeInbox} onRefresh={() => void raid.openInbox()} onRevenge={(id) => void raid.openRevengePreview(id)} onViewBattle={(id) => void raid.openBattleDetail(id)} />
            ) : (
              <>
                <CombatModeTabs active={combatMode} dictionary={t} onChange={(mode) => { setCombatMode(mode); if (mode === 'campaign') experience.requestAdvisorTip('CAMPAIGN_INTRO'); }} />
                <header className="raid-titlebar"><span><Swords size={19} /></span><div><h1>{t.raidUi.title}</h1><p>{t.raidUi.subtitle}</p></div><button className="raid-titlebar__log" onClick={() => void raid.openInbox()} type="button"><History size={15} /><span>{t.inboxUi.title}</span></button><b><Trophy size={14} /> <BidiValue direction="ltr">{state?.player.trophies ?? 1000}</BidiValue></b></header>
                {state?.newPlayerProtection.active ? (
                  <div className="raid-shield-status" role="status">
                    <Shield size={17} />
                    <span><strong>{t.raidUi.newKingdomShield}</strong><small>{t.raidUi.shieldHint}</small></span>
                    <b><BidiTemplate template={t.raidUi.shieldExpiresIn} values={{ count: { direction: 'ltr', value: shieldHours } }} /></b>
                  </div>
                ) : null}
                <div className="raid-match-card">
                  {raid.offer ? (
                    <>
                      <div className="raid-opponent"><span><Shield size={25} /></span><div><small>{t.raidUi.opponent}</small><h2><BidiValue>{raid.offer.opponent.displayName}</BidiValue></h2><p>{t.raidUi.castleLevel} <BidiValue direction="ltr">{raid.offer.opponent.castleLevel}</BidiValue> · <Trophy size={12} /> <BidiValue direction="ltr">{raid.offer.opponent.trophies}</BidiValue></p></div></div>
                      <div className="raid-power"><span><small>{t.raidUi.yourPower}</small><b><BidiValue direction="ltr">{raid.offer.ownPower}</BidiValue></b></span><i dir="ltr">VS</i><span><small>{t.raidUi.enemyPower}</small><b><BidiValue direction="ltr">{raid.offer.opponent.armyPower}</BidiValue></b></span></div>
                      <div className="raid-portraits">{raid.offer.opponent.army.map((squad) => <figure key={squad.slot}><img alt={t.heroNames[squad.commander.key]} src={squad.commander.portraitAsset} /><figcaption>{t.armyUi.troopNames[squad.troopType]} × <BidiValue direction="ltr">{squad.unitCount}</BidiValue><small>{t.heroNames[squad.commander.key]} · Lv.<BidiValue direction="ltr">{squad.commander.level}</BidiValue></small></figcaption></figure>)}</div>
                      <h3><Coins size={15} /> {t.raidUi.potentialLoot}</h3>
                      <div className="raid-loot-grid">{Object.entries(raid.offer.potentialLoot).map(([resource, amount]) => <span key={resource}><b><BidiValue direction="ltr">{formatAmount(amount)}</BidiValue></b><small>{t.resourceShort[resource as keyof typeof t.resourceShort]}</small></span>)}</div>
                      <button className="raid-primary" data-guide-target="attack" disabled={raid.action !== 'idle'} onClick={() => void raid.attack()} type="button">{raid.action === 'attacking' ? t.raidUi.marching : t.raidUi.attack}</button>
                      <button className="raid-secondary" disabled={raid.action !== 'idle'} onClick={() => void raid.search()} type="button">{t.raidUi.findAnother}</button>
                    </>
                  ) : (
                    <div className="raid-empty"><span><Swords size={38} /></span><h2>{t.raidUi.ready}</h2><p>{t.raidUi.readyHint}</p><button className="raid-primary" data-guide-target="find-enemy" disabled={raid.action !== 'idle'} onClick={() => void raid.search()} type="button">{raid.action === 'searching' || raid.action === 'loading' ? t.raidUi.searching : t.raidUi.findOpponent}</button></div>
                  )}
                </div>
                <div className="raid-own-team"><strong>{t.raidUi.yourTeam}</strong><span>{state?.army.squads.map((squad, index) => <span key={squad.slot}>{index ? ' | ' : ''}{t.armyUi.troopNames[squad.troopType]} × <BidiValue direction="ltr">{squad.unitCount}</BidiValue></span>)}</span><b><BidiValue direction="ltr">{state?.army.power ?? 0}</BidiValue></b><button onClick={() => onNavigate('heroes')} type="button">{t.raidUi.editTeam}</button></div>
              </>
            )}
          </section>
          {tutorialRaid && raid.battle && !battleFinished ? <AdvisorCoach title={t.experience.battleTitle} body={t.experience.advisor.battle} durationMs={3500} /> : null}
          {tutorialRaid && raid.battle && battleFinished ? <AdvisorCoach title={t.experience.resultTitle} body={t.experience.advisor.result} target="result-return" /> : null}
          {tutorialRaid && !raid.battle && raid.offer ? <AdvisorCoach title={t.experience.attackTitle} body={t.experience.advisor.attack} target="attack" /> : null}
          {tutorialRaid && !raid.battle && !raid.offer ? <AdvisorCoach title={t.experience.findTitle} body={t.experience.advisor.findEnemy} target="find-enemy" /> : null}
          <BottomNavigation activeSection="raid" dictionary={t} onComingSoon={setComingSoon} onNavigate={onNavigate} />
          <div className={comingSoon ? 'coming-soon-toast coming-soon-toast--visible' : 'coming-soon-toast'} role="status">{comingSoon ? <BidiTemplate template={t.comingSoonMessage} values={{ section: comingSoon }} /> : ''}</div>
          <div className={(combatMode === 'campaign' ? campaign.errorCode : raid.errorCode) ? 'hero-error hero-error--visible' : 'hero-error'} role="alert">{combatMode === 'campaign' && campaign.errorCode ? (t.campaign.errors[campaign.errorCode as keyof typeof t.campaign.errors] ?? t.campaign.errors.SERVER_ERROR) : raid.errorCode ? (t.raidErrors[raid.errorCode as keyof typeof t.raidErrors] ?? t.raidErrors.SERVER_ERROR) : ''}{(combatMode === 'campaign' ? campaign.errorCode : raid.errorCode) ? <button onClick={() => void (combatMode === 'campaign' ? campaign.refresh() : raid.refresh())} type="button">{t.retry}</button> : null}</div>
        </div>
      </main>
    </>
  );
}

function CombatModeTabs({ active, dictionary: t, onChange }: { active: 'raid' | 'campaign'; dictionary: Dictionary; onChange(mode: 'raid' | 'campaign'): void }) {
  return <div className="combat-mode-tabs" role="tablist" aria-label={t.campaign.modeLabel}>
    <button aria-selected={active === 'raid'} onClick={() => onChange('raid')} role="tab" type="button">{t.raid}</button>
    <button aria-selected={active === 'campaign'} onClick={() => onChange('campaign')} role="tab" type="button">{t.campaign.tab}</button>
  </div>;
}
