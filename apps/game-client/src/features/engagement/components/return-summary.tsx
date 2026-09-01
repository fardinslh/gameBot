'use client';

import { ArrowUpCircle, Coins, Gift, ShieldAlert, Sparkles, Swords, Wheat, Trees, Mountain } from 'lucide-react';
import type { EngagementReturnSummary, KingdomIdentityState, ResourceType } from '@crown-and-coin/shared';
import type { Dictionary } from '@/i18n/config';
import { BidiTemplate, BidiValue } from '@/i18n/bidi';
import { formatAmount } from '@/features/kingdom/components/resource-hud';
import { HeraldryMark } from '@/features/kingdom/components/kingdom-identity-card';

const RESOURCE_ICONS = { GOLD: Coins, FOOD: Wheat, WOOD: Trees, STONE: Mountain } as const;

export function ReturnSummary({ dictionary: t, identity, summary, onClose }: { dictionary: Dictionary; identity: KingdomIdentityState | null; summary: EngagementReturnSummary; onClose(): void }) {
  const resources = (Object.entries(summary.resourcesReady) as [ResourceType, string][]).filter(([resource, value]) => resource !== 'GEMS' && BigInt(value) > BigInt(0));
  return <div className="engagement-backdrop" role="presentation">
    <section aria-labelledby="return-summary-title" aria-modal="true" className="return-summary" role="dialog">
      <header>{identity ? <HeraldryMark heraldry={identity.heraldry} /> : <span><Sparkles size={22} /></span>}<div><small>{t.engagement.returnKicker}</small><h2 id="return-summary-title">{identity ? <BidiTemplate template={t.engagement.welcomeBackRealm} values={{ kingdom: { direction: 'auto', value: identity.name } }} /> : t.engagement.welcomeBack}</h2>{identity ? <em>{t.kingdomIdentity.titles[identity.rulerTitle]} · <span dir="auto">{identity.name}</span></em> : null}</div></header>
      <p>{t.engagement.awaySummary}</p>
      <div className="return-summary__list">
        {resources.map(([resource, amount]) => { const Icon = RESOURCE_ICONS[resource as keyof typeof RESOURCE_ICONS]; return <div key={resource}>{Icon ? <Icon size={17} /> : null}<span>{t.resourceShort[resource]}</span><b><BidiValue direction="ltr">+{formatAmount(amount)}</BidiValue></b></div>; })}
        {summary.completedUpgrades.map((upgrade, index) => <div key={`${upgrade.buildingType}-${index}`}><ArrowUpCircle size={17} /><span>{t.engagement.upgradeComplete}</span><b>{buildingName(t, upgrade.buildingType)} <BidiValue direction="ltr">{upgrade.fromLevel} → {upgrade.toLevel}</BidiValue></b></div>)}
        {summary.completedTraining.map((training, index) => <div key={`${training.troopType}-${index}`}><Swords size={17} /><span>{t.engagement.trainingComplete}</span><b>{t.armyUi.troopNames[training.troopType]} × <BidiValue direction="ltr">{training.quantity}</BidiValue></b></div>)}
        {summary.availableRewardCount > 0 ? <div><Gift size={17} /><span>{t.engagement.rewardsReady}</span><b><BidiValue direction="ltr">{summary.availableRewardCount}</BidiValue></b></div> : null}
        {summary.revengeCount > 0 ? <div><ShieldAlert size={17} /><span>{t.engagement.revengeReady}</span><b><BidiValue direction="ltr">{summary.revengeCount}</BidiValue></b></div> : null}
      </div>
      <button onClick={onClose} type="button">{t.engagement.continue}</button>
    </section>
  </div>;
}

export function buildingName(t: Dictionary, type: string): string {
  const map: Record<string, string> = {
    CASTLE: t.buildings.castle.name, FARM: t.buildings.farm.name, LUMBER_MILL: t.buildings.lumberMill.name,
    MINE: t.buildings.mine.name, GRAND_MARKET: t.buildings.grandMarket.name, ACADEMY: t.buildings.academy.name,
    BLACKSMITH: t.buildings.blacksmith.name, WATCHTOWER: t.buildings.watchtower.name, WORKSHOP: t.buildings.workshop.name,
  };
  return map[type] ?? type;
}
