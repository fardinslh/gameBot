import { ArrowUpRight, Check, Crown, LockKeyhole, Sparkles, X } from 'lucide-react';
import type { KingdomProgressGoalsState, KingdomProgressionState } from '@crown-and-coin/shared';
import type { Dictionary } from '@/i18n/config';
import { BidiTemplate, BidiValue } from '@/i18n/bidi';
import { BUILDING_TYPE_TO_ID } from '../data/building-layout';

interface KingdomProgressSheetProps {
  dictionary: Dictionary;
  goals: KingdomProgressGoalsState | null;
  onClose(): void;
  open: boolean;
  progression: KingdomProgressionState | null;
}

export function KingdomProgressSheet({ dictionary: t, goals, onClose, open, progression }: KingdomProgressSheetProps) {
  const xpPercent = progression?.xpRequiredForNextLevel
    ? Math.min(100, Math.round((progression.xpIntoLevel / progression.xpRequiredForNextLevel) * 100))
    : 100;
  return (
    <aside
      aria-hidden={!open}
      aria-label={t.kingdomProgress.title}
      className={open ? 'kingdom-progress-sheet kingdom-progress-sheet--open' : 'kingdom-progress-sheet'}
      inert={!open}
    >
      <div className="kingdom-progress-sheet__handle" aria-hidden="true" />
      <header className="kingdom-progress-sheet__heading">
        <span><Crown aria-hidden="true" size={23} /></span>
        <div><small>{t.kingdomProgress.subtitle}</small><h2>{t.kingdomProgress.title}</h2></div>
        <button className="icon-button" aria-label={t.close} onClick={onClose} type="button"><X aria-hidden="true" size={20} /></button>
      </header>

      <div className="kingdom-progress-summary">
        <div><small>{t.kingdomProgress.kingdomLevel}</small><strong><BidiValue direction="ltr">{progression?.level ?? 1}</BidiValue></strong></div>
        <div><small>{t.kingdomProgress.castleLevel}</small><strong><BidiValue direction="ltr">{goals?.castleLevel ?? 1}</BidiValue></strong></div>
      </div>
      <div className="kingdom-progress-xp">
        <span><small>{t.kingdomProgress.experience}</small><b><BidiValue direction="ltr">{progression?.xp ?? 0}</BidiValue></b></span>
        <i aria-hidden="true"><b style={{ width: `${xpPercent}%` }} /></i>
      </div>

      {goals?.nextUnlock ? (
        <div className="kingdom-next-goal">
          <span><LockKeyhole aria-hidden="true" size={17} /></span>
          <div><small>{t.kingdomProgress.nextUnlock}</small><strong>{buildingName(goals.nextUnlock.key, t)}</strong><p><BidiTemplate template={t.kingdomProgress.unlocksAt} values={{ level: { direction: 'ltr', value: goals.nextUnlock.requiredCastleLevel } }} /></p></div>
          <ArrowUpRight aria-hidden="true" size={18} />
        </div>
      ) : (
        <div className="kingdom-next-goal kingdom-next-goal--complete">
          <span><Check aria-hidden="true" size={17} /></span>
          <div><strong>{t.kingdomProgress.allUnlocked}</strong><p>{t.kingdomProgress.allUnlockedHint}</p></div>
        </div>
      )}

      <section className="kingdom-milestones">
        <h3>{t.kingdomProgress.milestones}</h3>
        <div>
          {goals?.milestones.map((milestone) => (
            <article data-unlocked={milestone.unlocked} key={milestone.key}>
              {milestone.unlocked ? <Check aria-hidden="true" size={14} /> : <LockKeyhole aria-hidden="true" size={14} />}
              <strong>{buildingName(milestone.key, t)}</strong>
              <small>{milestone.unlocked ? t.kingdomProgress.unlocked : <BidiTemplate template={t.kingdomProgress.locked} values={{ level: { direction: 'ltr', value: milestone.requiredCastleLevel } }} />}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="kingdom-effect-goals">
        <h3><Sparkles aria-hidden="true" size={15} />{t.kingdomProgress.effects}</h3>
        <div>
          {goals?.effects.map((effect) => (
            <article data-unlocked={effect.unlocked} key={effect.effectType}>
              <header><strong>{buildingName(effect.buildingType, t)}</strong><small>{t.heroUi.level} <BidiValue direction="ltr">{effect.buildingLevel}</BidiValue></small></header>
              <p><span>{t.kingdomProgress.current}</span><b><BidiTemplate template={t.effectLabels[effect.effectType]} values={{ value: { direction: 'ltr', value: formatEffectValue(effect.effectType, effect.valueBps) } }} /></b></p>
              <p><span>{t.kingdomProgress.next}</span><b>{effect.nextLevelValueBps === null ? t.kingdomProgress.maximum : <BidiTemplate template={t.effectLabels[effect.effectType]} values={{ value: { direction: 'ltr', value: formatEffectValue(effect.effectType, effect.nextLevelValueBps) } }} />}</b></p>
            </article>
          ))}
        </div>
      </section>
    </aside>
  );
}

function buildingName(type: keyof typeof BUILDING_TYPE_TO_ID | 'ADVANCED_PVP', t: Dictionary): string {
  if (type === 'ADVANCED_PVP') return '';
  return t.buildings[BUILDING_TYPE_TO_ID[type]].name;
}

function formatEffectValue(type: keyof Dictionary['effectLabels'], valueBps: number): string {
  const value = valueBps / 100;
  const amount = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return `${type === 'HERO_UPGRADE_DISCOUNT' || type === 'BUILDING_UPGRADE_SPEED' ? '-' : '+'}${amount}`;
}
