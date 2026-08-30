import { ArrowLeft, Clock3, Coins, Shield, Swords, Trophy } from 'lucide-react';
import type { RevengePreviewResponse } from '@crown-and-coin/shared';
import type { Dictionary } from '@/i18n/config';
import { formatAmount } from '@/features/kingdom/components/resource-hud';
import { BidiTemplate, BidiValue } from '@/i18n/bidi';

interface RevengePreviewProps {
  dictionary: Dictionary;
  pending: boolean;
  preview: RevengePreviewResponse;
  onBack(): void;
  onStart(): void;
}

export function RevengePreview({ dictionary: t, pending, preview, onBack, onStart }: RevengePreviewProps) {
  const remainingMinutes = Math.max(0, Math.ceil((Date.parse(preview.expiresAt) - Date.parse(preview.serverTime)) / 60_000));
  return (
    <section className="revenge-preview" data-revenge-preview={preview.revengeTargetId}>
      <header><button aria-label={t.inboxUi.back} onClick={onBack} type="button"><ArrowLeft size={19} /></button><span><Swords size={22} /></span><div><small>{t.inboxUi.revengeAvailable}</small><h1>{t.inboxUi.revengePreview}</h1></div></header>
      <div className="revenge-preview__target"><span><Shield size={25} /></span><div><small>{t.inboxUi.originalAttacker}</small><h2><BidiValue>{preview.target.displayName}</BidiValue></h2><p><Trophy size={12} /> <BidiValue direction="ltr">{preview.target.trophies}</BidiValue></p></div></div>
      <div className="raid-power"><span><small>{t.raidUi.yourPower}</small><b><BidiValue direction="ltr">{preview.ownArmy.power}</BidiValue></b></span><i dir="ltr">VS</i><span><small>{t.raidUi.enemyPower}</small><b><BidiValue direction="ltr">{preview.target.armyPower}</BidiValue></b></span></div>
      <div className="revenge-preview__team"><strong>{t.inboxUi.currentRaidTeam}</strong><span>{preview.ownArmy.squads.map((squad, index) => <span key={squad.slot}>{index ? ' · ' : ''}{t.armyUi.troopNames[squad.troopType]} × <BidiValue direction="ltr">{squad.unitCount}</BidiValue></span>)}</span></div>
      <h3><Coins size={15} /> {t.raidUi.potentialLoot}</h3>
      <div className="raid-loot-grid">{Object.entries(preview.potentialLoot).map(([resource, amount]) => <span key={resource}><b><BidiValue direction="ltr">{formatAmount(amount)}</BidiValue></b><small>{t.resourceShort[resource as keyof typeof t.resourceShort]}</small></span>)}</div>
      <p className="revenge-preview__expiry"><Clock3 size={14} /> <BidiTemplate template={t.inboxUi.expiresIn} values={{ count: { direction: 'ltr', value: remainingMinutes } }} /></p>
      <button className="raid-primary" disabled={pending} onClick={onStart} type="button">{pending ? t.raidUi.marching : t.inboxUi.revenge}</button>
      <button className="raid-secondary" onClick={onBack} type="button">{t.inboxUi.back}</button>
    </section>
  );
}
