import { ArrowLeft, Shield, Swords, Trophy } from 'lucide-react';
import type { BattleReplayResponse } from '@crown-and-coin/shared';
import type { Dictionary } from '@/i18n/config';
import { formatAmount } from '@/features/kingdom/components/resource-hud';

interface BattleDetailProps { battle: BattleReplayResponse; dictionary: Dictionary; onBack(): void; }

export function BattleDetail({ battle, dictionary: t, onBack }: BattleDetailProps) {
  const defenseWon = battle.result === 'DEFENDER_WIN';
  return (
    <section className="battle-detail" data-battle-detail={battle.id}>
      <header><button aria-label={t.inboxUi.back} onClick={onBack} type="button"><ArrowLeft size={19} /></button><span><Shield size={21} /></span><div><small>{battle.type === 'REVENGE' ? t.inboxUi.revenge : t.inboxUi.defense}</small><h1>{t.inboxUi.battleDetail}</h1></div></header>
      <div className="battle-detail__versus"><span><small>{t.inboxUi.attacker}</small><strong>{battle.attacker.displayName}</strong></span><Swords size={19} /><span><small>{t.inboxUi.defender}</small><strong>{battle.defender.displayName}</strong></span></div>
      <p className={defenseWon ? 'battle-detail__result battle-detail__result--win' : 'battle-detail__result'}>{defenseWon ? t.inboxUi.defenseVictory : t.inboxUi.defenseDefeat} <span><Trophy size={13} /> {battle.defender.trophyDelta > 0 ? '+' : ''}{battle.defender.trophyDelta}</span></p>
      <div className="battle-detail__teams">{(['attacker', 'defender'] as const).map((side) => <div key={side}>{battle.teams[side].map((hero) => <figure key={`${side}-${hero.slot}`}><img alt={t.heroNames[hero.key]} src={hero.portraitAsset} /><figcaption>{t.heroNames[hero.key]} · {t.heroUi.level}{hero.level}</figcaption></figure>)}</div>)}</div>
      <div className="raid-loot-grid">{Object.entries(battle.loot).map(([resource, amount]) => <span key={resource}><b>{formatAmount(amount)}</b><small>{t.resourceShort[resource as keyof typeof t.resourceShort]}</small></span>)}</div>
      <time>{new Date(battle.resolvedAt).toLocaleString()}</time>
      <button className="raid-secondary" onClick={onBack} type="button">{t.inboxUi.back}</button>
    </section>
  );
}
