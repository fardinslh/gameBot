import { Anvil, ArrowUp, BookOpen, Castle, Clock3, Hammer, Landmark, LockKeyhole, Mountain, TowerControl, Trees, Wheat, Wrench, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Dictionary } from '@/i18n/config';
import type { BuildingId, KingdomBuildingView } from '../domain/kingdom-types';
import { formatAmount } from './resource-hud';

const BUILDING_ICONS: Record<BuildingId, LucideIcon> = {
  castle: Castle,
  farm: Wheat,
  lumberMill: Trees,
  mine: Mountain,
  grandMarket: Landmark,
  academy: BookOpen,
  blacksmith: Anvil,
  watchtower: TowerControl,
  workshop: Wrench,
};

interface BuildingDetailSheetProps {
  actionPending: boolean;
  building: KingdomBuildingView | null;
  dictionary: Dictionary;
  onClose(): void;
  onUpgrade(buildingId: string): void;
  serverNow: number;
}

export function BuildingDetailSheet({ actionPending, building, dictionary: t, onClose, onUpgrade, serverNow }: BuildingDetailSheetProps) {
  const presentation = building ? t.buildings[building.visualId] : t.buildings.castle;
  const Icon = building ? BUILDING_ICONS[building.visualId] : Castle;
  const activeUpgrade = building?.activeUpgrade ?? null;
  const remainingSeconds = activeUpgrade ? Math.max(0, Math.ceil((Date.parse(activeUpgrade.finishAt) - serverNow) / 1_000)) : 0;
  const availability = building?.upgradeAvailability ?? 'CAN_UPGRADE';
  const buttonLabel = actionPending ? t.startingUpgrade : t.upgradeStates[availability];

  return (
    <aside
      aria-hidden={!building}
      aria-label={t.buildingDetails}
      className={building ? 'building-sheet building-sheet--open' : 'building-sheet'}
      data-building-sheet={building?.visualId}
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
        <div><small>{t.currentProduction}</small><strong>{building?.resource ? `${formatAmount(building.productionPerHour)} / ${t.hour}` : presentation.production}</strong></div>
      </div>

      {building && !building.unlocked ? (
        <div className="building-lock-state">
          <LockKeyhole aria-hidden="true" size={17} />
          <span><small>{t.unlockRequirement}</small><strong>{t.requiresCastle.replace('{level}', String(building.unlockCastleLevel))}</strong></span>
        </div>
      ) : null}

      <p className="building-role"><Hammer aria-hidden="true" size={15} /><span><small>{t.role}</small>{presentation.role}</span></p>

      {building?.effects.map((effect) => (
        <div className="building-effect" data-effect={effect.type} key={effect.type}>
          <small>{t.buildingEffect} · {t.effectNow}</small>
          <strong>{formatEffect(t.effectLabels[effect.type], effect.valueBps)}</strong>
          {effect.nextLevelValueBps !== null ? (
            <span>{t.effectNext}: {formatEffect(t.effectLabels[effect.type], effect.nextLevelValueBps)}</span>
          ) : null}
        </div>
      ))}

      <div className={activeUpgrade ? 'upgrade-preview upgrade-preview--active' : 'upgrade-preview'}>
        <span className="upgrade-preview__icon"><ArrowUp aria-hidden="true" size={18} /></span>
        <span>
          <small>{activeUpgrade ? t.upgradeInProgress : `${t.nextLevel} · ${building?.level ?? 0} → ${(building?.level ?? 0) + 1}`}</small>
          <strong>
            {activeUpgrade
              ? <><Clock3 aria-hidden="true" size={13} /> {formatDuration(remainingSeconds)}</>
              : building?.nextProductionPerHour
                ? `${formatAmount(building.nextProductionPerHour)} / ${t.hour}`
                : presentation.upgrade}
          </strong>
        </span>
      </div>

      {!activeUpgrade && building ? (
        <div className="upgrade-economy">
          <div><small>{t.upgradeCost}</small><strong>{building.upgradeCost.map((cost) => `${formatAmount(cost.amount)} ${t.resourceShort[cost.resource]}`).join(' · ') || '—'}</strong></div>
          <div><small>{t.upgradeDuration}</small><strong>{formatDuration(building.upgradeDurationSeconds ?? 0)}</strong></div>
        </div>
      ) : null}

      {building ? (
        <button
          className="upgrade-button"
          data-guide-target="upgrade"
          data-upgrade-state={availability}
          disabled={availability !== 'CAN_UPGRADE' || actionPending}
          onClick={() => onUpgrade(building.id)}
          type="button"
        >
          <ArrowUp aria-hidden="true" size={17} /> {buttonLabel}
        </button>
      ) : null}
    </aside>
  );
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}:${seconds.toString().padStart(2, '0')}` : `${seconds}s`;
}

function formatEffect(template: string, valueBps: number): string {
  const value = valueBps / 100;
  return template.replace('{value}', Number.isInteger(value) ? String(value) : value.toFixed(2));
}
