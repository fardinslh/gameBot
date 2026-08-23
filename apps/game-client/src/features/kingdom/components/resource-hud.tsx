import { Coins, Gem, Mountain, Trees, Wheat } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Dictionary } from '@/i18n/config';
import type { ResourceAmounts, ResourceType } from '@crown-and-coin/shared';
import { RESOURCE_TYPES } from '@crown-and-coin/shared';
import { RESOURCE_TO_ID, type ResourceId } from '../domain/kingdom-types';

const RESOURCE_ICONS: Record<ResourceId, LucideIcon> = {
  gold: Coins,
  food: Wheat,
  wood: Trees,
  stone: Mountain,
  gems: Gem,
};

interface ResourceHudProps {
  balances: ResourceAmounts;
  dictionary: Dictionary;
}

export function ResourceHud({ balances, dictionary: t }: ResourceHudProps) {
  const labels: Record<ResourceId, string> = {
    gold: t.resourceGold,
    food: t.resourceFood,
    wood: t.resourceWood,
    stone: t.resourceStone,
    gems: t.resourceGems,
  };

  return (
    <section className="resource-hud" aria-label={t.serverBalances}>
      <span className="resource-hud__server">{t.serverData}</span>
      {RESOURCE_TYPES.map((resource: ResourceType) => {
        const id = RESOURCE_TO_ID[resource];
        const value = formatAmount(balances[resource]);
        const Icon = RESOURCE_ICONS[id];
        return (
          <div className={`resource-chip resource-chip--${id}`} data-balance={balances[resource]} key={resource} aria-label={`${labels[id]} ${value}`}>
            <span className="resource-chip__icon"><Icon aria-hidden="true" size={14} strokeWidth={2.4} /></span>
            <strong>{value}</strong>
            <small>{labels[id]}</small>
          </div>
        );
      })}
    </section>
  );
}

export function formatAmount(value: string): string {
  const amount = BigInt(value);
  if (amount >= BigInt(1_000_000)) return `${trimDecimal(Number(amount / BigInt(100_000)) / 10)}M`;
  if (amount >= BigInt(1_000)) return `${trimDecimal(Number(amount / BigInt(100)) / 10)}K`;
  return amount.toString();
}

function trimDecimal(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}
