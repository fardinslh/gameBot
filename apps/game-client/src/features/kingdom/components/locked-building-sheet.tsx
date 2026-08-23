import { Anvil, BookOpen, Castle, LockKeyhole, Shield, TowerControl, Warehouse, Wine, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Dictionary } from '@/i18n/config';
import type { FutureBuildingId, FutureBuildingLayout } from '../domain/kingdom-types';

const ICONS: Record<FutureBuildingId, LucideIcon> = {
  barracks: Shield,
  blacksmith: Anvil,
  academy: BookOpen,
  granary: Warehouse,
  watchtower: TowerControl,
  tavern: Wine,
  stable: Castle,
};

interface LockedBuildingSheetProps {
  building: FutureBuildingLayout | null;
  dictionary: Dictionary;
  onClose(): void;
}

export function LockedBuildingSheet({ building, dictionary: t, onClose }: LockedBuildingSheetProps) {
  const presentation = building ? t.futureBuildings[building.id] : t.futureBuildings.barracks;
  const Icon = building ? ICONS[building.id] : LockKeyhole;
  return (
    <aside
      aria-hidden={!building}
      aria-label={t.lockedBuilding}
      className={building ? 'locked-building-sheet locked-building-sheet--open' : 'locked-building-sheet'}
      data-locked-building={building?.id}
      inert={!building}
    >
      <div className="building-sheet__handle" aria-hidden="true" />
      <div className="locked-building-sheet__heading">
        <span><Icon aria-hidden="true" size={25} /></span>
        <div><small>{t.futureDistrict}</small><h2>{presentation.name}</h2></div>
        <button aria-label={t.close} onClick={onClose} type="button"><X aria-hidden="true" size={20} /></button>
      </div>
      <p>{presentation.role}</p>
      <div className="locked-building-sheet__requirement">
        <span><LockKeyhole aria-hidden="true" size={17} /></span>
        <div><small>{t.unlockRequirement}</small><strong>{t.requiresCastle.replace('{level}', String(building?.castleLevel ?? 1))}</strong></div>
      </div>
      <div className="locked-building-sheet__future"><span />{t.plannedContent}</div>
      <button className="locked-building-sheet__close" onClick={onClose} type="button">{t.unlocksLater}</button>
    </aside>
  );
}
