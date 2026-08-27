import { Coins, Sparkles } from 'lucide-react';
import type { ResourceAmounts } from '@crown-and-coin/shared';
import type { Dictionary } from '@/i18n/config';
import type { KingdomBuildingView } from '../domain/kingdom-types';
import { formatAmount } from './resource-hud';
import { BidiValue } from '@/i18n/bidi';

interface CollectControlProps {
  buildings: KingdomBuildingView[];
  dictionary: Dictionary;
  disabled: boolean;
  lastGains: ResourceAmounts | null;
  offlineCapHours: number;
  onCollect(): void;
  serverNow: number;
  serverTime: string;
}

export function CollectControl({
  buildings,
  dictionary: t,
  disabled,
  lastGains,
  offlineCapHours,
  onCollect,
  serverNow,
  serverTime,
}: CollectControlProps) {
  const elapsedMs = Math.max(0, Math.min(serverNow - Date.parse(serverTime), offlineCapHours * 3_600_000));
  const ready = buildings.reduce((total, building) => {
    if (!building.resource) return total;
    return total + BigInt(building.collectable) + BigInt(Math.floor(Number(building.productionPerHour) * elapsedMs / 3_600_000));
  }, BigInt(0));
  const feedback = lastGains
    ? Object.entries(lastGains).filter(([, value]) => BigInt(value) > BigInt(0))
    : [];

  return (
    <div className="collect-control">
      <button
        data-guide-target="collect"
        className={ready > BigInt(0) ? 'collect-button collect-button--ready' : 'collect-button'}
        disabled={disabled}
        onClick={onCollect}
        type="button"
      >
        <span className="collect-button__icon"><Coins aria-hidden="true" size={19} /></span>
        <span><small>{t.resourcesReady}</small><strong>{disabled ? t.collecting : t.collect} · <BidiValue direction="ltr">{formatAmount(ready.toString())}</BidiValue></strong></span>
      </button>
      <div className={feedback.length ? 'collect-feedback collect-feedback--visible' : 'collect-feedback'} aria-live="polite">
        <Sparkles aria-hidden="true" size={15} />
        <span>{feedback.map(([resource, value], index) => <span key={resource}>{index ? ' · ' : ''}<BidiValue direction="ltr">+{formatAmount(value)}</BidiValue> {t.resourceShort[resource as keyof typeof t.resourceShort]}</span>)}</span>
      </div>
    </div>
  );
}
