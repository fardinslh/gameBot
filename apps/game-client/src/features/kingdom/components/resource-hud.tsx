import { Coins, Gem, Mountain, Trees, Wheat } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Dictionary } from '@/i18n/config';
import type { ResourceAmounts, ResourceType, StorageCapacities } from '@crown-and-coin/shared';
import { RESOURCE_TYPES } from '@crown-and-coin/shared';
import { RESOURCE_TO_ID, type ResourceId } from '../domain/kingdom-types';
import { formatAmount, getCapacityState } from '../domain/collection-presentation';
import { BidiValue } from '@/i18n/bidi';

const RESOURCE_ICONS: Record<ResourceId, LucideIcon> = {
  gold: Coins,
  food: Wheat,
  wood: Trees,
  stone: Mountain,
  gems: Gem,
};

interface ResourceHudProps {
  balances: ResourceAmounts;
  capacities?: StorageCapacities;
  dictionary: Dictionary;
  displayedBalances?: ResourceAmounts;
  gains?: ResourceAmounts | null;
  productionRates?: ResourceAmounts;
}

export function ResourceHud({ balances, capacities, dictionary: t, displayedBalances = balances, gains, productionRates }: ResourceHudProps) {
  const labels: Record<ResourceId, string> = {
    gold: t.resourceGold,
    food: t.resourceFood,
    wood: t.resourceWood,
    stone: t.resourceStone,
    gems: t.resourceGems,
  };

  return (
    <section className="resource-hud" aria-label={t.serverBalances}>
      {RESOURCE_TYPES.map((resource: ResourceType) => {
        const id = RESOURCE_TO_ID[resource];
        const value = formatAmount(displayedBalances[resource]);
        const rawCapacity = capacities?.[resource];
        const capacity = rawCapacity ? formatAmount(rawCapacity) : null;
        const capacityState = getCapacityState(balances[resource], rawCapacity);
        const displayedCapacityState = getCapacityState(displayedBalances[resource], rawCapacity);
        const isVisuallyFull = displayedCapacityState === 'full' || displayedCapacityState === 'overflow';
        const productionRate = formatAmount(productionRates?.[resource] ?? '0');
        const gain = gains?.[resource] && BigInt(gains[resource]) > BigInt(0) ? formatAmount(gains[resource]) : null;
        const Icon = RESOURCE_ICONS[id];
        const accessibilityLabel = capacity
          ? `${labels[id]}: ${t.resourceBalance} ${value}; ${t.resourceCapacity} ${capacity}; ${isVisuallyFull ? t.resourceFullShort : `+${productionRate}/${t.resourcePerHourShort}`}`
          : `${labels[id]}: ${t.resourceBalance} ${value}`;

        return (
          <div
            aria-label={accessibilityLabel}
            className={`resource-chip resource-chip--${id}`}
            data-balance={balances[resource]}
            data-capacity={rawCapacity}
            data-capacity-state={capacityState ?? undefined}
            data-display-balance={displayedBalances[resource]}
            data-primary-value="balance-capacity"
            data-production-rate={capacity ? productionRates?.[resource] ?? '0' : undefined}
            data-resource={resource}
            data-secondary-value={capacity ? (isVisuallyFull ? 'full' : 'production-rate') : undefined}
            key={resource}
          >
            <span className="resource-chip__icon"><Icon aria-hidden="true" size={13} strokeWidth={2.4} /></span>
            {capacity ? (
              <span className="resource-chip__amount" dir="ltr">
                <strong><BidiValue direction="ltr">{value}</BidiValue></strong>
                <span aria-hidden="true" className="resource-chip__slash">/</span>
                <span className="resource-chip__capacity"><BidiValue direction="ltr">{capacity}</BidiValue></span>
              </span>
            ) : <strong className="resource-chip__uncapped"><BidiValue direction="ltr">{value}</BidiValue></strong>}
            {capacity ? (
              <small className={isVisuallyFull ? 'resource-chip__rate resource-chip__rate--full' : 'resource-chip__rate'} dir="ltr">
                {isVisuallyFull
                  ? t.resourceFullShort
                  : <><BidiValue direction="ltr">+{productionRate}</BidiValue><span aria-hidden="true">/</span><span>{t.resourcePerHourShort}</span></>}
              </small>
            ) : null}
            {gain ? <span aria-hidden="true" className="resource-chip__gain"><BidiValue direction="ltr">+{gain}</BidiValue></span> : null}
          </div>
        );
      })}
    </section>
  );
}

export { formatAmount } from '../domain/collection-presentation';
