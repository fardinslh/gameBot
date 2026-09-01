'use client';

import { CheckCircle2, Landmark, Target } from 'lucide-react';
import type { EngagementOverviewResponse } from '@crown-and-coin/shared';
import type { Dictionary } from '@/i18n/config';
import { BidiValue } from '@/i18n/bidi';
import { buildingName } from './return-summary';

export function RaidEngagementSummary({ dictionary: t, engagement }: { dictionary: Dictionary; engagement: EngagementOverviewResponse }) {
  const affordable = engagement.affordableBuildingType;
  return <section className="raid-engagement-summary" aria-label={t.engagement.raidProgress}>
    <header><Target size={16} /><strong>{t.engagement.raidProgress}</strong></header>
    {engagement.progress.slice(0, 2).map((cue) => <div key={`${cue.source}-${cue.key}`}><CheckCircle2 size={14} /><span>{cue.source === 'DAILY_MISSION' ? (t.retention.missionNames as Record<string, string>)[cue.key] : (t.retention.achievementNames as Record<string, string>)[cue.key]}</span><b><BidiValue direction="ltr">{cue.current}/{cue.target}</BidiValue></b></div>)}
    {affordable ? <p><Landmark size={15} /><span>{t.engagement.nowAffordable.replace('{building}', buildingName(t, affordable))}</span></p> : null}
  </section>;
}
