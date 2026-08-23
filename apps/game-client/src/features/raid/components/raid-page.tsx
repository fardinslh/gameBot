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

interface RaidPageProps { dictionary: Dictionary; locale: Locale; initialView?: RaidView; onNavigate(section: GameSection): void; }
const EMPTY = { GOLD: '0', FOOD: '0', WOOD: '0', STONE: '0', GEMS: '0' } as const;

export function RaidPage({ dictionary: t, locale, initialView = 'overview', onNavigate }: RaidPageProps) {
  const raid = useRaidState(initialView);
  const [battleFinished, setBattleFinished] = useState(false);
  const [comingSoon, setComingSoon] = useState<string | null>(null);
  useEffect(() => { if (raid.battle) setBattleFinished(false); }, [raid.battle]);
  useEffect(() => { if (!comingSoon) return; const timer = window.setTimeout(() => setComingSoon(null), 1800); return () => clearTimeout(timer); }, [comingSoon]);
  const state = raid.overview;

  return (
    <div className="game-viewport" lang={locale} dir={locale === 'fa' ? 'rtl' : 'ltr'}>
      <main className="raid-shell">
        <div className="raid-backdrop" aria-hidden="true" />
        <div className="game-ui-layer">
          <PlayerHud dictionary={t} locale={locale} playerLevel={state?.player.level ?? 1} playerName={state?.player.displayName ?? t.playerTitle} section="raid" />
          <ResourceHud balances={raid.battle?.balances ?? state?.balances ?? EMPTY} dictionary={t} />
          <section className="raid-content" data-player-id={state?.player.id} data-raid-state={raid.battle ? battleFinished ? 'result' : 'battle' : raid.view === 'inbox' ? 'inbox' : raid.offer ? 'offer' : 'overview'}>
            {raid.battle ? battleFinished ? (
              <div className={`raid-result raid-result--${raid.battle.result === 'ATTACKER_WIN' ? 'victory' : 'defeat'}`}>
                <span className="raid-result__crest"><Crown size={30} /></span>
                <small>{t.raidUi.battleComplete}</small>
                <h1>{raid.battle.type === 'REVENGE' ? (raid.battle.result === 'ATTACKER_WIN' ? t.inboxUi.revengeVictory : t.inboxUi.revengeDefeat) : (raid.battle.result === 'ATTACKER_WIN' ? t.raidUi.victory : t.raidUi.defeat)}</h1>
                <p><Trophy size={15} /> {raid.battle.attacker.trophyDelta > 0 ? '+' : ''}{raid.battle.attacker.trophyDelta} {t.raidUi.trophies}</p>
                <div className="raid-loot-grid">{Object.entries(raid.battle.loot).map(([resource, amount]) => <span key={resource}><b>{formatAmount(amount)}</b><small>{t.resourceShort[resource as keyof typeof t.resourceShort]}</small></span>)}</div>
                <button className="raid-primary" onClick={raid.battle.type === 'REVENGE' ? raid.clearBattle : () => onNavigate('kingdom')} type="button">{raid.battle.type === 'REVENGE' ? t.inboxUi.title : t.raidUi.returnKingdom}</button>
                <button className="raid-secondary" onClick={raid.battle.type === 'REVENGE' ? () => onNavigate('kingdom') : raid.clearBattle} type="button">{raid.battle.type === 'REVENGE' ? t.raidUi.returnKingdom : t.raidUi.findAnother}</button>
              </div>
            ) : (
              <div className="raid-battle-wrap"><BattleScene battle={raid.battle} onComplete={() => { raid.finishBattle(); setBattleFinished(true); }} /><div className="raid-battle-label"><Swords size={16} /> {raid.battle.type === 'REVENGE' ? t.inboxUi.revenge : t.raidUi.autoBattle}</div></div>
            ) : raid.revengePreview ? (
              <RevengePreview dictionary={t} onBack={raid.closeRevengePreview} onStart={() => void raid.revenge()} pending={raid.action !== 'idle'} preview={raid.revengePreview} />
            ) : raid.battleDetail ? (
              <BattleDetail battle={raid.battleDetail} dictionary={t} onBack={raid.closeBattleDetail} />
            ) : raid.view === 'inbox' ? (
              <BattleLog dictionary={t} inbox={raid.inbox} loading={raid.action === 'loading-inbox'} onBack={raid.closeInbox} onRefresh={() => void raid.openInbox()} onRevenge={(id) => void raid.openRevengePreview(id)} onViewBattle={(id) => void raid.openBattleDetail(id)} />
            ) : (
              <>
                <header className="raid-titlebar"><span><Swords size={19} /></span><div><h1>{t.raidUi.title}</h1><p>{t.raidUi.subtitle}</p></div><button className="raid-titlebar__log" onClick={() => void raid.openInbox()} type="button"><History size={15} /><span>{t.inboxUi.title}</span></button><b><Trophy size={14} /> {state?.player.trophies ?? 1000}</b></header>
                <div className="raid-match-card">
                  {raid.offer ? (
                    <>
                      <div className="raid-opponent"><span><Shield size={25} /></span><div><small>{t.raidUi.opponent}</small><h2>{raid.offer.opponent.displayName}</h2><p>{t.raidUi.castleLevel} {raid.offer.opponent.castleLevel} · <Trophy size={12} /> {raid.offer.opponent.trophies}</p></div></div>
                      <div className="raid-power"><span><small>{t.raidUi.yourPower}</small><b>{raid.offer.ownPower}</b></span><i>VS</i><span><small>{t.raidUi.enemyPower}</small><b>{raid.offer.opponent.teamPower}</b></span></div>
                      <div className="raid-portraits">{raid.offer.opponent.team.map((hero) => <figure key={hero.id}><img alt={t.heroNames[hero.key]} src={hero.portraitAsset} /><figcaption>{t.heroNames[hero.key]} · {hero.level}</figcaption></figure>)}</div>
                      <h3><Coins size={15} /> {t.raidUi.potentialLoot}</h3>
                      <div className="raid-loot-grid">{Object.entries(raid.offer.potentialLoot).map(([resource, amount]) => <span key={resource}><b>{formatAmount(amount)}</b><small>{t.resourceShort[resource as keyof typeof t.resourceShort]}</small></span>)}</div>
                      <button className="raid-primary" disabled={raid.action !== 'idle'} onClick={() => void raid.attack()} type="button">{raid.action === 'attacking' ? t.raidUi.marching : t.raidUi.attack}</button>
                      <button className="raid-secondary" disabled={raid.action !== 'idle'} onClick={() => void raid.search()} type="button">{t.raidUi.findAnother}</button>
                    </>
                  ) : (
                    <div className="raid-empty"><span><Swords size={38} /></span><h2>{t.raidUi.ready}</h2><p>{t.raidUi.readyHint}</p><button className="raid-primary" disabled={raid.action !== 'idle'} onClick={() => void raid.search()} type="button">{raid.action === 'searching' || raid.action === 'loading' ? t.raidUi.searching : t.raidUi.findOpponent}</button></div>
                  )}
                </div>
                <div className="raid-own-team"><strong>{t.raidUi.yourTeam}</strong><span>{state?.team.heroes.map((hero) => `${t.heroNames[hero.key]} ${t.heroUi.level}${hero.level} · ${hero.power}`).join('  |  ')}</span><b>{state?.team.power ?? 0}</b><button onClick={() => onNavigate('heroes')} type="button">{t.raidUi.editTeam}</button></div>
              </>
            )}
          </section>
          <BottomNavigation activeSection="raid" dictionary={t} onComingSoon={setComingSoon} onNavigate={onNavigate} />
          <div className={comingSoon ? 'coming-soon-toast coming-soon-toast--visible' : 'coming-soon-toast'} role="status">{comingSoon ? t.comingSoonMessage.replace('{section}', comingSoon) : ''}</div>
          <div className={raid.errorCode ? 'hero-error hero-error--visible' : 'hero-error'} role="alert">{raid.errorCode ? (t.raidErrors[raid.errorCode as keyof typeof t.raidErrors] ?? t.raidErrors.SERVER_ERROR) : ''}{raid.errorCode ? <button onClick={() => void raid.refresh()} type="button">{t.retry}</button> : null}</div>
        </div>
      </main>
    </div>
  );
}
