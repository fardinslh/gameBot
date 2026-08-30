'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Clock3, Minus, Plus, Save, Shield, Sparkles, Swords, Users } from 'lucide-react';
import type { ResourceType, TroopType } from '@crown-and-coin/shared';
import type { Dictionary, Locale } from '@/i18n/config';
import type { GameSection } from '@/features/kingdom/components/bottom-navigation';
import { BottomNavigation } from '@/features/kingdom/components/bottom-navigation';
import { PlayerHud } from '@/features/kingdom/components/player-hud';
import { ResourceHud, formatAmount } from '@/features/kingdom/components/resource-hud';
import { useArmyState } from '@/features/army/hooks/use-army-state';
import { usePlayerExperience } from '@/features/experience/player-experience-provider';
import { HeroDetailSheet } from './hero-detail-sheet';
import { BidiTemplate, BidiValue, useNumberLocale } from '@/i18n/bidi';
import { localizeDigits, parseLocalizedInteger } from '@/i18n/numbers';

interface HeroesPageProps { dictionary: Dictionary; locale: Locale; onNavigate(section: GameSection): void; }
const EMPTY = { GOLD: '0', FOOD: '0', WOOD: '0', STONE: '0', GEMS: '0' } as const;
const TROOP_ASSET: Record<TroopType, string> = {
  INFANTRY: '/assets/troops/infantry.webp',
  ARCHER: '/assets/troops/archer.webp',
  CAVALRY: '/assets/troops/cavalry.webp',
};

export function HeroesPage({ dictionary: t, locale, onNavigate }: HeroesPageProps) {
  const state = useArmyState();
  const experience = usePlayerExperience();
  const [selectedCommanderId, setSelectedCommanderId] = useState<string | null>(null);
  const [trainType, setTrainType] = useState<TroopType>('INFANTRY');
  const [trainQuantity, setTrainQuantity] = useState(1);
  const [comingSoon, setComingSoon] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1_000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (!comingSoon) return; const timer = window.setTimeout(() => setComingSoon(null), 1800); return () => clearTimeout(timer); }, [comingSoon]);
  useEffect(() => { experience.requestAdvisorTip('HEROES_INTRO'); }, [experience]);
  const selectedCommander = state.heroes?.heroes.find((hero) => hero.id === selectedCommanderId) ?? null;
  const trainingRemaining = state.army?.training ? Math.max(0, Math.ceil((Date.parse(state.army.training.completesAt) - now) / 1_000)) : 0;
  const selectedTroop = state.army?.troops.find((troop) => troop.type === trainType);
  const maxTrain = Math.max(1, Math.min(25, state.army?.capacity.available ?? 1));
  const formationPower = useMemo(() => state.army?.formation.slots.reduce((sum, slot) => sum + slot.squadPower, 0) ?? 0, [state.army]);

  const chooseCommander = (slotNumber: number, commanderId: string): void => {
    const current = state.draftSlots.find((slot) => slot.slot === slotNumber);
    const occupied = state.draftSlots.find((slot) => slot.commanderPlayerHeroId === commanderId);
    if (current && occupied && occupied.slot !== slotNumber) state.updateSlot(occupied.slot, { commanderPlayerHeroId: current.commanderPlayerHeroId });
    state.updateSlot(slotNumber, { commanderPlayerHeroId: commanderId });
  };

  return (
    <main className="heroes-shell army-shell">
      <div className="heroes-backdrop" aria-hidden="true" />
      <div className="game-ui-layer">
        <PlayerHud dictionary={t} locale={locale} playerLevel={state.heroes?.player.level ?? 1} playerName={state.heroes?.player.displayName ?? t.playerTitle} section="heroes" />
        <ResourceHud balances={state.heroes?.balances ?? EMPTY} dictionary={t} />
        <div className="heroes-scroll army-scroll" data-army-status={state.army ? 'ready' : state.errorCode ? 'error' : 'loading'}>
          <header className="heroes-titlebar army-titlebar">
            <span><Shield aria-hidden="true" size={18} /></span>
            <div><h1>{t.armyUi.title}</h1><p>{t.armyUi.subtitle}</p></div>
            <div className="army-titlebar__power"><small>{t.armyUi.armyPower}</small><b><Swords size={14} /><BidiValue direction="ltr">{state.army?.power ?? formationPower}</BidiValue></b></div>
          </header>
          {state.army && state.heroes ? <>
            <section className="army-capacity" aria-label={t.armyUi.capacity}>
              <span><Users size={16} /><small>{t.armyUi.capacity}</small><b><BidiValue direction="ltr">{state.army.capacity.ready} / {state.army.capacity.maximum}</BidiValue></b></span>
              <div><i style={{ width: `${Math.min(100, state.army.capacity.ready / state.army.capacity.maximum * 100)}%` }} /></div>
              <small><BidiTemplate template={t.armyUi.availableCount} values={{ count: { value: state.army.capacity.available, direction: 'ltr' } }} /></small>
            </section>
            <section className="army-section">
              <div className="army-section__heading"><h2>{t.armyUi.activeFormation}</h2><span>{t.armyUi.threeSquads}</span></div>
              <div className="army-formation">
                {state.draftSlots.map((slot) => {
                  const commander = state.army!.commanders.find((item) => item.playerHeroId === slot.commanderPlayerHeroId)!;
                  const ready = state.army!.troops.find((troop) => troop.type === slot.troopType)?.readyCount ?? 1;
                  return <article className="army-squad-card" key={slot.slot}>
                    <div className="army-squad-card__art"><img alt="" src={TROOP_ASSET[slot.troopType]} /><b><BidiTemplate template={t.armyUi.squadNumber} values={{ count: { value: slot.slot, direction: 'ltr' } }} /></b></div>
                    <div className="army-squad-card__controls">
                      <span className="army-select"><select aria-label={t.armyUi.troopType} onChange={(event) => state.updateSlot(slot.slot, { troopType: event.target.value as TroopType, unitCount: Math.min(slot.unitCount, state.army!.troops.find((troop) => troop.type === event.target.value)?.readyCount ?? 1) })} value={slot.troopType}>
                        {state.army!.troops.map((troop) => <option key={troop.type} value={troop.type}>{t.armyUi.troopNames[troop.type]}</option>)}
                      </select><ChevronDown aria-hidden="true" size={13} strokeWidth={2.4} /></span>
                      <label><span>{t.armyUi.units}</span><QuantityStepper decreaseLabel={t.armyUi.decreaseQuantity} increaseLabel={t.armyUi.increaseQuantity} max={ready} min={1} onChange={(unitCount) => state.updateSlot(slot.slot, { unitCount })} quantityLabel={t.armyUi.quantity} value={slot.unitCount} /></label>
                      <label><span>{t.armyUi.commander}</span><span className="army-select"><select onChange={(event) => chooseCommander(slot.slot, event.target.value)} value={slot.commanderPlayerHeroId}>{state.army!.commanders.map((item) => <option key={item.playerHeroId} value={item.playerHeroId}>{t.heroNames[item.key]} · {t.heroUi.level}{localizeDigits(item.level, locale)}</option>)}</select><ChevronDown aria-hidden="true" size={13} strokeWidth={2.4} /></span></label>
                    </div>
                    <button className="army-commander-medallion" onClick={() => setSelectedCommanderId(commander.playerHeroId)} type="button"><img alt={t.heroNames[commander.key]} src={commander.portraitAsset} /><span>{t.heroNames[commander.key]}</span></button>
                  </article>;
                })}
              </div>
              <button className="army-save" disabled={!state.dirty || state.action !== 'idle'} onClick={() => void state.save()} type="button"><Save size={15} />{state.action === 'saving' ? t.armyUi.saving : t.armyUi.saveFormation}</button>
            </section>
            <section className="army-section army-training">
              <div className="army-section__heading"><h2>{t.armyUi.trainTroops}</h2><span>{t.armyUi.serverAuthoritative}</span></div>
              {state.army.training ? <div className="army-training__active"><Clock3 size={18} /><span><strong>{t.armyUi.training}</strong><small>{t.armyUi.troopNames[state.army.training.troopType]} × <BidiValue direction="ltr">{state.army.training.quantity}</BidiValue></small></span><b><BidiValue direction="ltr">{formatTimer(trainingRemaining)}</BidiValue></b></div> : <>
                <div className="army-training__types">{state.army.troops.map((troop) => <button className={trainType === troop.type ? 'is-active' : ''} key={troop.type} onClick={() => setTrainType(troop.type)} type="button"><img alt="" src={TROOP_ASSET[troop.type]} /><strong>{t.armyUi.troopNames[troop.type]}</strong><small>{t.armyUi.ready}: <BidiValue direction="ltr">{troop.readyCount}</BidiValue></small></button>)}</div>
                <div className="army-training__order"><label>{t.armyUi.quantity}<QuantityStepper decreaseLabel={t.armyUi.decreaseQuantity} increaseLabel={t.armyUi.increaseQuantity} max={maxTrain} min={1} onChange={setTrainQuantity} quantityLabel={t.armyUi.quantity} value={trainQuantity} /></label><div>{Object.entries(selectedTroop?.trainingCostPerUnit ?? {}).map(([resource, amount]) => <span key={resource}>{t.resourceShort[resource as ResourceType]} <BidiValue direction="ltr">{formatAmount(String(BigInt(amount) * BigInt(trainQuantity)))}</BidiValue></span>)}</div><button className="army-training__submit" disabled={state.action !== 'idle' || state.army.capacity.available < trainQuantity} onClick={() => void state.train(trainType, trainQuantity)} type="button">{t.armyUi.train}</button></div>
              </>}
            </section>
            <section className="army-section army-commanders">
              <div className="army-section__heading"><h2>{t.armyUi.commanders}</h2><span>{t.armyUi.commanderHint}</span></div>
              <div>{state.heroes.heroes.map((hero) => <button key={hero.id} onClick={() => setSelectedCommanderId(hero.id)} type="button"><img alt={t.heroNames[hero.key]} src={hero.portraitAsset} /><span><strong>{t.heroNames[hero.key]}</strong><small>{t.heroUi.level}<BidiValue direction="ltr">{hero.level}</BidiValue> · {t.armyUi.power} <BidiValue direction="ltr">{hero.power}</BidiValue></small><em><Sparkles size={11} />{t.armyUi.skillNames[hero.skill.key]}</em></span></button>)}</div>
            </section>
          </> : <div className="heroes-loading" role="status"><span /><strong>{t.armyUi.loading}</strong></div>}
        </div>
        <HeroDetailSheet dictionary={t} hero={selectedCommander} onClose={() => setSelectedCommanderId(null)} onUpgrade={(id) => void state.upgrade(id)} upgrading={state.action === 'upgrading'} />
        <BottomNavigation activeSection="heroes" dictionary={t} onComingSoon={setComingSoon} onNavigate={onNavigate} />
        <div className={comingSoon ? 'coming-soon-toast coming-soon-toast--visible' : 'coming-soon-toast'} role="status">{comingSoon ? <BidiTemplate template={t.comingSoonMessage} values={{ section: comingSoon }} /> : ''}</div>
        <div className={state.errorCode ? 'hero-error hero-error--visible' : 'hero-error'} role="alert">{state.errorCode ? (t.armyErrors[state.errorCode as keyof typeof t.armyErrors] ?? t.armyErrors.SERVER_ERROR) : ''}{state.errorCode ? <button onClick={() => void state.refresh()} type="button">{t.retry}</button> : null}</div>
      </div>
    </main>
  );
}

function QuantityStepper({ decreaseLabel, increaseLabel, max, min, onChange, quantityLabel, value }: {
  decreaseLabel: string;
  increaseLabel: string;
  max: number;
  min: number;
  onChange(value: number): void;
  quantityLabel: string;
  value: number;
}) {
  const locale = useNumberLocale();
  return <span className="army-quantity-stepper" role="group">
    <button aria-label={decreaseLabel} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} type="button"><Minus aria-hidden="true" size={13} strokeWidth={2.5} /></button>
    <input aria-label={quantityLabel} dir="ltr" inputMode="numeric" onChange={(event) => {
      const parsed = parseLocalizedInteger(event.target.value);
      if (parsed !== null) onChange(Math.max(min, Math.min(max, parsed)));
    }} onFocus={(event) => event.currentTarget.select()} pattern="[0-9۰-۹٠-٩]*" type="text" value={localizeDigits(value, locale)} />
    <button aria-label={increaseLabel} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} type="button"><Plus aria-hidden="true" size={13} strokeWidth={2.5} /></button>
  </span>;
}

function formatTimer(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
