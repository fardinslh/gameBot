import { Coins } from 'lucide-react';
import type { ResourceAmounts, StorageCapacities } from '@crown-and-coin/shared';
import type { Dictionary } from '@/i18n/config';
import type { KingdomBuildingView } from '../domain/kingdom-types';
import { estimateCollectableProduction } from '../domain/collection-presentation';
import { formatAmount } from './resource-hud';
import { BidiValue } from '@/i18n/bidi';

interface CollectControlProps {
  balances: ResourceAmounts;
  buildings: KingdomBuildingView[];
  capacities: StorageCapacities;
  dictionary: Dictionary;
  disabled: boolean;
  lastGains: ResourceAmounts | null;
  lastCollectedAt: string;
  offlineCapHours: number;
  onCollect(): void;
  serverNow: number;
  serverTime: string;
}

export function CollectControl({ balances, buildings, capacities, dictionary: t, disabled, lastGains, lastCollectedAt, offlineCapHours, onCollect, serverNow, serverTime }: CollectControlProps) {
  const elapsedMs = Math.max(0, Math.min(serverNow - Date.parse(serverTime), offlineCapHours * 3_600_000));
  const rawElapsedMs = Math.max(0, Math.min(serverNow - Date.parse(lastCollectedAt), offlineCapHours * 3_600_000));
  const estimate = estimateCollectableProduction(buildings, balances, capacities, elapsedMs, rawElapsedMs);
  const ready = estimate.collectable;
  const storageBlocked = estimate.raw > BigInt(0) && ready === BigInt(0);
  const feedback = lastGains ? Object.entries(lastGains).filter(([, value]) => BigInt(value) > BigInt(0)) : [];

  return (
    <div className="collect-control">
      <button
        data-guide-target="collect"
        className={ready > BigInt(0) ? 'collect-button collect-button--ready' : 'collect-button'}
        data-collect-state={storageBlocked ? 'storage-full' : ready > BigInt(0) ? 'ready' : 'idle'}
        disabled={disabled}
        onClick={onCollect}
        type="button"
      >
        <span className="collect-button__icon"><Coins aria-hidden="true" size={19} /></span>
        <span><small>{storageBlocked ? t.storageFull : t.resourcesReady}</small><strong>{disabled ? t.collecting : t.collect} · <BidiValue direction="ltr">{formatAmount(ready.toString())}</BidiValue></strong></span>
      </button>
      <div className="collect-feedback" aria-live="polite">
        {feedback.map(([resource, value], index) => <span key={resource}>{index ? ' · ' : ''}<BidiValue direction="ltr">+{formatAmount(value)}</BidiValue> {t.resourceShort[resource as keyof typeof t.resourceShort]}</span>)}
      </div>
    </div>
  );
}
