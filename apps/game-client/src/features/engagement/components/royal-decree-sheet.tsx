'use client';

import { Check, Crown, Gift, X } from 'lucide-react';
import type { RoyalDecreeState } from '@crown-and-coin/shared';
import type { Dictionary } from '@/i18n/config';
import { BidiValue } from '@/i18n/bidi';
import { formatAmount } from '@/features/kingdom/components/resource-hud';

export function RoyalDecreeSheet({ action, decree, dictionary: t, onClaim, onClose }: { action: 'idle' | 'claiming'; decree: RoyalDecreeState; dictionary: Dictionary; onClaim(): void; onClose(): void }) {
  return <div className="engagement-backdrop" role="presentation"><section aria-labelledby="royal-decree-title" aria-modal="true" className="royal-decree-sheet" role="dialog">
    <header><span><Crown size={22} /></span><div><small>{t.engagement.firstDirection}</small><h2 id="royal-decree-title">{t.engagement.royalDecreeOne}</h2></div><button aria-label={t.close} onClick={onClose} type="button"><X size={19} /></button></header>
    <p>{t.engagement.restoreKingdom}</p>
    <div className="royal-decree-sheet__tasks">{decree.tasks.map((task) => <div className={task.completed ? 'is-complete' : ''} key={task.key}><span>{task.completed ? <Check size={15} /> : <i />}</span><strong>{t.engagement.decreeTasks[task.key]}</strong><BidiValue direction="ltr">{task.current}/{task.target}</BidiValue></div>)}</div>
    <div className="royal-decree-sheet__reward"><Gift size={17} /><span>{t.engagement.reward}</span>{decree.rewards.map((reward) => <b key={reward.resource}>{t.resourceShort[reward.resource]} <BidiValue direction="ltr">+{formatAmount(reward.amount)}</BidiValue></b>)}</div>
    <button className="royal-decree-sheet__claim" disabled={!decree.claimable || action !== 'idle'} onClick={onClaim} type="button">{decree.claimed ? t.retention.claimed : action === 'claiming' ? t.retention.claiming : decree.claimable ? t.engagement.claimDecree : t.engagement.decreeInProgress}</button>
  </section></div>;
}
