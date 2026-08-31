import { Anvil, ArrowUp, BookOpen, Castle, Clock3, Hammer, Landmark, LockKeyhole, Mountain, TowerControl, Trees, Wheat, Wrench, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Dictionary } from '@/i18n/config';
import type { BuildingId, KingdomBuildingView } from '../domain/kingdom-types';
import { formatAmount } from './resource-hud';
import { BidiTemplate, BidiValue } from '@/i18n/bidi';

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
  onOpenProgress(): void;
  onUpgrade(buildingId: string): void;
  serverNow: number;
}

export function BuildingDetailSheet({ actionPending, building, dictionary: t, onClose, onOpenProgress, onUpgrade, serverNow }: BuildingDetailSheetProps) {
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
        <div><small>{t.currentLevel}</small><strong data-building-level={building?.level ?? 0} data-building-level-label>{t.heroUi.level} <BidiValue direction="ltr">{building?.level ?? 0}</BidiValue></strong></div>
        <div><small>{t.currentProduction}</small><strong>{building?.resource ? <><BidiValue direction="ltr">{formatAmount(building.productionPerHour)}</BidiValue> / {t.hour}</> : presentation.production}</strong></div>
      </div>

      {building && !building.unlocked ? (
        <div className="building-lock-state">
          <LockKeyhole aria-hidden="true" size={17} />
          <span><small>{t.unlockRequirement}</small><strong><BidiTemplate template={t.requiresCastle} values={{ level: { direction: 'ltr', value: building.unlockCastleLevel } }} /></strong></span>
        </div>
      ) : null}

      <p className="building-role"><Hammer aria-hidden="true" size={15} /><span><small>{t.role}</small>{presentation.role}</span></p>

      {building?.visualId === 'castle' ? (
        <button className="kingdom-progress-open" onClick={onOpenProgress} type="button">
          <Castle aria-hidden="true" size={16} />
          <span>{t.kingdomProgress.open}</span>
          <ArrowUp aria-hidden="true" size={15} />
        </button>
      ) : null}

      {building?.effects.map((effect) => (
        <div className="building-effect" data-effect={effect.type} key={effect.type}>
          <small>{t.buildingEffect} · {t.effectNow}</small>
          <strong><BidiTemplate template={t.effectLabels[effect.type]} values={{ value: { direction: 'ltr', value: formatEffectValue(effect.type, effect.valueBps) } }} /></strong>
          {effect.nextLevelValueBps !== null ? (
            <span>{t.effectNext}: <BidiTemplate template={t.effectLabels[effect.type]} values={{ value: { direction: 'ltr', value: formatEffectValue(effect.type, effect.nextLevelValueBps) } }} /></span>
          ) : null}
        </div>
      ))}

      <div className={activeUpgrade ? 'upgrade-preview upgrade-preview--active' : 'upgrade-preview'}>
        <span className="upgrade-preview__icon"><ArrowUp aria-hidden="true" size={18} /></span>
        <span>
          <small>{activeUpgrade ? t.upgradeInProgress : <>{t.nextLevel} · <BidiValue direction="ltr">{building?.level ?? 0} → {(building?.level ?? 0) + 1}</BidiValue></>}</small>
          <strong>
            {activeUpgrade
              ? <><Clock3 aria-hidden="true" size={13} /> <BidiValue direction="ltr">{formatDuration(remainingSeconds)}</BidiValue></>
              : building?.nextProductionPerHour
                ? <><BidiValue direction="ltr">{formatAmount(building.nextProductionPerHour)}</BidiValue> / {t.hour}</>
                : presentation.upgrade}
          </strong>
        </span>
      </div>

      {!activeUpgrade && building ? (
        <div className="upgrade-economy">
          <div><small>{t.upgradeCost}</small><strong>{building.upgradeCost.length ? building.upgradeCost.map((cost, index) => <span key={cost.resource}>{index ? ' · ' : ''}<BidiValue direction="ltr">{formatAmount(cost.amount)}</BidiValue> {t.resourceShort[cost.resource]}</span>) : '—'}</strong></div>
          <div><small>{t.upgradeDuration}</small><strong><BidiValue direction="ltr">{formatDuration(building.upgradeDurationSeconds ?? 0)}</BidiValue></strong></div>
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

function formatEffectValue(type: keyof Dictionary['effectLabels'], valueBps: number): string {
  const value = valueBps / 100;
  const amount = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return `${type === 'HERO_UPGRADE_DISCOUNT' || type === 'BUILDING_UPGRADE_SPEED' ? '-' : '+'}${amount}`;
}
