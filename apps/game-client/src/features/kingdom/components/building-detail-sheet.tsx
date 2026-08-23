import { ArrowUp, Castle, Hammer, Landmark, Mountain, Trees, Wheat, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Dictionary } from '@/i18n/config';
import type { BuildingId, MockBuilding } from '../domain/kingdom-types';

const BUILDING_ICONS: Record<BuildingId, LucideIcon> = {
  castle: Castle,
  farm: Wheat,
  lumberMill: Trees,
  mine: Mountain,
  grandMarket: Landmark,
};

interface BuildingDetailSheetProps {
  building: MockBuilding | null;
  dictionary: Dictionary;
  onClose(): void;
}

export function BuildingDetailSheet({ building, dictionary: t, onClose }: BuildingDetailSheetProps) {
  const presentation = building ? t.buildings[building.id] : t.buildings.castle;
  const Icon = building ? BUILDING_ICONS[building.id] : Castle;

  return (
    <aside
      aria-hidden={!building}
      aria-label={t.buildingDetails}
      className={building ? 'building-sheet building-sheet--open' : 'building-sheet'}
      data-building-sheet={building?.id}
      inert={!building}
    >
      <div className="building-sheet__handle" aria-hidden="true" />
      <div className="building-sheet__heading">
        <span className="building-sheet__crest"><Icon aria-hidden="true" size={24} /></span>
        <div>
          <small>{t.buildingDetails}</small>
          <h2>{presentation.name}</h2>
        </div>
        <button className="icon-button" aria-label={t.close} onClick={onClose} type="button">
          <X aria-hidden="true" size={20} />
        </button>
      </div>

      <div className="building-sheet__stats">
        <div><small>{t.currentLevel}</small><strong>{building?.level ?? 0}</strong></div>
        <div><small>{t.production}</small><strong>{presentation.production}</strong></div>
      </div>

      <p className="building-role"><Hammer aria-hidden="true" size={15} /><span><small>{t.role}</small>{presentation.role}</span></p>

      <div className="upgrade-preview">
        <span className="upgrade-preview__icon"><ArrowUp aria-hidden="true" size={18} /></span>
        <span><small>{t.upgradePreview} · {building?.level ?? 0} → {building?.nextLevel ?? 0}</small><strong>{presentation.upgrade}</strong></span>
      </div>
      <p className="preview-note">{t.previewOnly}</p>
    </aside>
  );
}
