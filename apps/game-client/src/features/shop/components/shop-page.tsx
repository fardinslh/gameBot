'use client';

import { Check, Clock3, Crown, Gem, Leaf, ShieldCheck, ShoppingBag, Sparkles, Swords, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ProfileCrestKey, ShopPurchaseItemKey } from '@crown-and-coin/shared';
import type { Dictionary, Locale } from '@/i18n/config';
import { BidiTemplate, BidiValue } from '@/i18n/bidi';
import { BottomNavigation } from '@/features/kingdom/components/bottom-navigation';
import type { GameSection } from '@/features/kingdom/components/bottom-navigation';
import { useShopState } from '../hooks/use-shop-state';

interface ShopPageProps { dictionary: Dictionary; locale: Locale; onNavigate(section: GameSection): void; }
interface PendingPurchase { itemKey: ShopPurchaseItemKey; targetId?: string; price: number; label: string; kind: 'cosmetic' | 'building' | 'training'; }

const CREST_CLASS: Record<ProfileCrestKey, string> = {
  DEFAULT: 'default',
  PROFILE_CREST_FOREST: 'forest',
  PROFILE_CREST_CRIMSON: 'crimson',
  PROFILE_CREST_ROYAL: 'royal',
};

export function ShopPage({ dictionary: t, locale: _locale, onNavigate }: ShopPageProps) {
  const shop = useShopState();
  const [pending, setPending] = useState<PendingPurchase | null>(null);
  const [comingSoon, setComingSoon] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1_000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { if (!comingSoon) return; const timer = window.setTimeout(() => setComingSoon(null), 1800); return () => clearTimeout(timer); }, [comingSoon]);

  const confirmText = pending?.kind === 'building' ? t.shopUi.confirmBuilding
    : pending?.kind === 'training' ? t.shopUi.confirmTraining : t.shopUi.confirmPurchase;
  const hasSpeedups = Boolean(shop.state?.convenience.buildingFinishes.length || shop.state?.convenience.troopTrainingFinish);

  const confirmPurchase = async (): Promise<void> => {
    if (!pending) return;
    const completed = await shop.purchase(pending.itemKey, pending.targetId);
    if (completed) setPending(null);
  };

  return (
    <main className="shop-shell" data-shop-status={shop.state ? 'ready' : shop.errorCode ? 'error' : 'loading'}>
      <div className="shop-backdrop" aria-hidden="true" />
      <div className="game-ui-layer">
        <header className="shop-header">
          <span className="shop-header__seal"><ShoppingBag aria-hidden="true" size={21} /></span>
          <div><h1>{t.shopUi.title}</h1><p>{t.shopUi.subtitle}</p></div>
          <span className="shop-gem-balance"><small>{t.shopUi.yourGems}</small><strong><Gem aria-hidden="true" size={15} /><BidiValue direction="ltr">{shop.state?.gemBalance ?? '0'}</BidiValue></strong></span>
        </header>

        <div className="shop-scroll">
          <section className="shop-section shop-time-savers" aria-labelledby="shop-time-title">
            <div className="shop-section__heading"><span><Clock3 aria-hidden="true" size={16} /></span><div><small>{t.shopUi.featured}</small><h2 id="shop-time-title">{t.shopUi.timeSavers}</h2></div></div>
            {!shop.state ? <div className="shop-loading"><span /><span /><span /></div> : hasSpeedups ? <div className="shop-speedup-list">
              {shop.state.convenience.buildingFinishes.map((offer) => {
                const remaining = Math.max(0, offer.remainingSeconds - Math.floor((now - Date.parse(shop.state!.serverTime)) / 1_000));
                const building = buildingName(offer.buildingType, t);
                return <article className="shop-speedup-card" data-shop-offer="building" key={offer.targetId}>
                  <span className="shop-speedup-card__icon"><Crown aria-hidden="true" size={19} /></span>
                  <div><strong><BidiTemplate template={t.shopUi.buildingTarget} values={{ building, level: { value: offer.targetLevel, direction: 'ltr' } }} /></strong><small><BidiTemplate template={t.shopUi.remains} values={{ time: { value: formatDuration(remaining), direction: 'ltr' } }} /></small></div>
                  <button onClick={() => setPending({ itemKey: offer.itemKey, targetId: offer.targetId, price: offer.priceGems, label: building, kind: 'building' })} type="button"><span>{t.shopUi.finishNow}</span><b><Gem size={12} /><BidiValue direction="ltr">{offer.priceGems}</BidiValue></b></button>
                </article>;
              })}
              {shop.state.convenience.troopTrainingFinish ? (() => {
                const offer = shop.state!.convenience.troopTrainingFinish!;
                const remaining = Math.max(0, offer.remainingSeconds - Math.floor((now - Date.parse(shop.state!.serverTime)) / 1_000));
                return <article className="shop-speedup-card" data-shop-offer="training">
                  <span className="shop-speedup-card__icon"><Swords aria-hidden="true" size={19} /></span>
                  <div><strong><BidiTemplate template={t.shopUi.trainingTarget} values={{ troop: t.armyUi.troopNames[offer.troopType], quantity: { value: offer.quantity, direction: 'ltr' } }} /></strong><small><BidiTemplate template={t.shopUi.remains} values={{ time: { value: formatDuration(remaining), direction: 'ltr' } }} /></small></div>
                  <button onClick={() => setPending({ itemKey: offer.itemKey, targetId: offer.targetId, price: offer.priceGems, label: t.armyUi.troopNames[offer.troopType], kind: 'training' })} type="button"><span>{t.shopUi.finishTraining}</span><b><Gem size={12} /><BidiValue direction="ltr">{offer.priceGems}</BidiValue></b></button>
                </article>;
              })() : null}
            </div> : <div className="shop-empty"><Clock3 aria-hidden="true" size={20} /><span>{t.shopUi.noSpeedups}</span></div>}
          </section>

          <section className="shop-section" aria-labelledby="shop-cosmetic-title">
            <div className="shop-section__heading shop-section__heading--split"><span><Sparkles aria-hidden="true" size={16} /></span><div><small>{t.shopUi.permanent}</small><h2 id="shop-cosmetic-title">{t.shopUi.cosmetics}</h2></div>{shop.state?.equippedProfileCrest !== 'DEFAULT' ? <button className="shop-default-crest" onClick={() => void shop.equip('DEFAULT')} type="button">{t.shopUi.returnDefault}</button> : null}</div>
            <div className="shop-cosmetic-grid">
              {shop.state?.cosmetics.map((item) => <article className={`shop-cosmetic-card shop-cosmetic-card--${CREST_CLASS[item.itemKey]}`} data-owned={item.owned} data-equipped={item.equipped} key={item.itemKey}>
                <div className={`profile-crest-preview profile-crest-preview--${CREST_CLASS[item.itemKey]}`}><Crown aria-hidden="true" size={25} /><i aria-hidden="true" /></div>
                <div className="shop-cosmetic-card__copy"><span>{item.equipped ? <><Check size={12} />{t.shopUi.equipped}</> : item.owned ? <><ShieldCheck size={12} />{t.shopUi.owned}</> : t.shopUi.permanent}</span><h3>{t.shopUi.crestNames[item.itemKey]}</h3><p>{t.shopUi.crestDescriptions[item.itemKey]}</p></div>
                <div className="shop-cosmetic-card__action"><b><Gem aria-hidden="true" size={13} /><BidiValue direction="ltr">{item.priceGems}</BidiValue></b><button disabled={item.equipped || shop.action !== 'idle'} onClick={() => item.owned ? void shop.equip(item.itemKey) : setPending({ itemKey: item.itemKey, price: item.priceGems, label: t.shopUi.crestNames[item.itemKey], kind: 'cosmetic' })} type="button">{item.equipped ? t.shopUi.equipped : item.owned ? t.shopUi.equip : t.shopUi.buy}</button></div>
              </article>)}
            </div>
          </section>

          <section className="shop-section shop-gem-sources" aria-labelledby="shop-source-title">
            <div className="shop-section__heading"><span><Gem aria-hidden="true" size={16} /></span><div><small>{t.shopUi.yourGems}</small><h2 id="shop-source-title">{t.shopUi.earnGems}</h2></div></div>
            <div>{shop.state?.gemSources.map((source) => <span key={source}>{source === 'DAILY_MISSIONS' ? <Leaf size={14} /> : <ShieldCheck size={14} />}{t.shopUi.gemSources[source]}</span>)}</div>
            <p>{t.shopUi.earnedOnly}</p>
          </section>
        </div>

        <BottomNavigation activeSection="shop" dictionary={t} onComingSoon={setComingSoon} onNavigate={onNavigate} />
        <div className={comingSoon ? 'coming-soon-toast coming-soon-toast--visible' : 'coming-soon-toast'} role="status">{comingSoon ? <BidiTemplate template={t.comingSoonMessage} values={{ section: comingSoon }} /> : ''}</div>
        <div className={shop.success ? 'shop-toast shop-toast--visible' : 'shop-toast'} role="status">{shop.success ? t.shopUi.success : ''}</div>
        <div className={shop.errorCode ? 'shop-error shop-error--visible' : 'shop-error'} role="alert">{shop.errorCode ? (t.shopErrors[shop.errorCode as keyof typeof t.shopErrors] ?? t.shopErrors.SERVER_ERROR) : ''}{shop.errorCode ? <button onClick={shop.clearError} type="button"><X size={15} />{t.close}</button> : null}</div>

        {pending ? <div className="shop-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && shop.action === 'idle') setPending(null); }}>
          <section aria-labelledby="shop-confirm-title" aria-modal="true" className="shop-confirm" role="alertdialog">
            <span><Gem aria-hidden="true" size={24} /></span><h2 id="shop-confirm-title">{t.shopUi.confirmTitle}</h2>
            <p><BidiTemplate template={confirmText} values={{ item: pending.label, count: { value: pending.price, direction: 'ltr' } }} /></p>
            <div><button disabled={shop.action !== 'idle'} onClick={() => setPending(null)} type="button">{t.shopUi.cancel}</button><button disabled={shop.action !== 'idle'} onClick={() => void confirmPurchase()} type="button">{shop.action === 'purchasing' ? t.shopUi.processing : t.shopUi.buy}</button></div>
          </section>
        </div> : null}
      </div>
    </main>
  );
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function buildingName(type: string, t: Dictionary): string {
  const key = type === 'LUMBER_MILL' ? 'lumberMill' : type === 'GRAND_MARKET' ? 'grandMarket' : type.toLowerCase();
  return t.buildings[key as keyof typeof t.buildings]?.name ?? type;
}
