'use client';

import { ArrowRight, Sparkles, X } from 'lucide-react';
import type { KingdomBuildingState } from '@crown-and-coin/shared';
import type { Dictionary } from '@/i18n/config';
import { BidiValue } from '@/i18n/bidi';
import { formatAmount } from '@/features/kingdom/components/resource-hud';
import { buildingName } from './return-summary';

export function UpgradeCelebration({ before, after, xpGained, storageGained, effectGainedBps, dictionary: t, onClose }: { before: KingdomBuildingState; after: KingdomBuildingState; xpGained: number; storageGained: string; effectGainedBps: number; dictionary: Dictionary; onClose(): void }) {
  const productionGain = BigInt(after.productionPerHour) - BigInt(before.productionPerHour);
  const appearanceChanged = before.appearanceVariant !== after.appearanceVariant;
  return <div className="upgrade-celebration" role="status">
    <span><Sparkles size={18} /></span>
    <div><small>{t.engagement.kingdomChanged}</small><strong>{buildingName(t, after.type)} <BidiValue direction="ltr">{before.level} <ArrowRight aria-hidden="true" size={13} /> {after.level}</BidiValue></strong>
      <p>{productionGain > BigInt(0) ? <>{t.engagement.productionImproved} <BidiValue direction="ltr">+{formatAmount(productionGain.toString())}/h</BidiValue></> : BigInt(storageGained) > BigInt(0) ? <>{t.engagement.storageImproved} <BidiValue direction="ltr">+{formatAmount(storageGained)}</BidiValue></> : effectGainedBps > 0 ? <>{t.engagement.effectImproved} <BidiValue direction="ltr">+{effectGainedBps / 100}%</BidiValue></> : t.engagement.buildingStronger}
      {appearanceChanged ? <> · {t.engagement.appearanceUnlocked}</> : null}{xpGained > 0 ? <> · XP <BidiValue direction="ltr">+{xpGained}</BidiValue></> : null}</p>
    </div>
    <button aria-label={t.close} onClick={onClose} type="button"><X size={16} /></button>
  </div>;
}
