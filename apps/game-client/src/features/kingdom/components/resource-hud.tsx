import { Coins, Gem, Mountain, Trees, Wheat } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Dictionary } from '@/i18n/config';
import { MOCK_KINGDOM_RESOURCES } from '../data/mock-kingdom';
import type { ResourceId } from '../domain/kingdom-types';

const RESOURCE_ICONS: Record<ResourceId, LucideIcon> = {
  gold: Coins,
  food: Wheat,
  wood: Trees,
  stone: Mountain,
  gems: Gem,
};

interface ResourceHudProps {
  dictionary: Dictionary;
}

export function ResourceHud({ dictionary: t }: ResourceHudProps) {
  const labels: Record<ResourceId, string> = {
    gold: t.resourceGold,
    food: t.resourceFood,
    wood: t.resourceWood,
    stone: t.resourceStone,
    gems: t.resourceGems,
  };

  return (
    <section className="resource-hud" aria-label={t.mockData}>
      <span className="resource-hud__mock">{t.mockData}</span>
      {MOCK_KINGDOM_RESOURCES.map((resource) => {
        const Icon = RESOURCE_ICONS[resource.id];
        return (
          <div className={`resource-chip resource-chip--${resource.id}`} key={resource.id} aria-label={`${labels[resource.id]} ${resource.value}`}>
            <span className="resource-chip__icon"><Icon aria-hidden="true" size={14} strokeWidth={2.4} /></span>
            <strong>{resource.value}</strong>
            <small>{labels[resource.id]}</small>
          </div>
        );
      })}
    </section>
  );
}
