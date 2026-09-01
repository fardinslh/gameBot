'use client';

import { ChevronRight, Crown, Gift, Target } from 'lucide-react';
import type { EngagementOverviewResponse } from '@crown-and-coin/shared';
import type { Dictionary } from '@/i18n/config';
import { BidiValue } from '@/i18n/bidi';
import { buildingName } from './return-summary';

export function EngagementGoalCard({ dictionary: t, engagement, onAction, onOpenProgress }: {
  dictionary: Dictionary;
  engagement: EngagementOverviewResponse;
  onAction(): void;
  onOpenProgress(): void;
}) {
  const goal = engagement.nextGoal;
  const cue = engagement.progress[0];
  const title = goalTitle(t, goal.kind, goal.buildingType);
  const isDecree = engagement.royalDecree.available && !engagement.royalDecree.claimed;
  return <aside className="engagement-goal-card" aria-label={t.engagement.nextGoal}>
    <button className="engagement-goal-card__main" onClick={onAction} type="button">
      <span className="engagement-goal-card__icon">{goal.kind === 'CLAIM_REWARD' ? <Gift size={18} /> : isDecree ? <Crown size={18} /> : <Target size={18} />}</span>
      <span><small>{isDecree ? t.engagement.royalDecree : t.engagement.nextGoal}</small><strong>{title}</strong></span>
      <span className="engagement-goal-card__progress"><BidiValue direction="ltr">{goal.current}/{goal.target}</BidiValue><ChevronRight size={16} /></span>
    </button>
    {cue ? <button className="engagement-goal-card__cue" onClick={onOpenProgress} type="button"><span>{cue.source === 'DAILY_MISSION' ? missionName(t, cue.key) : achievementName(t, cue.key)}</span><BidiValue direction="ltr">{cue.current}/{cue.target}</BidiValue></button> : null}
  </aside>;
}

function goalTitle(t: Dictionary, kind: string, buildingType: string | null): string {
  if (kind === 'CLAIM_REWARD') return t.engagement.claimReadyReward;
  if (kind === 'COLLECT_RESOURCES') return t.engagement.collectGoal;
  if (kind === 'WIN_RAID') return t.engagement.raidGoal;
  if (kind === 'TRAIN_TROOPS') return t.engagement.armyGoal;
  if (kind === 'UPGRADE_IN_PROGRESS') return t.engagement.upgradeWaiting;
  if (kind === 'ROYAL_DECREE') return t.engagement.decreeReady;
  return t.engagement.upgradeGoal.replace('{building}', buildingType ? buildingName(t, buildingType) : t.buildings.castle.name);
}

function missionName(t: Dictionary, key: string): string {
  return (t.retention.missionNames as Record<string, string>)[key] ?? t.engagement.missionProgress;
}

function achievementName(t: Dictionary, key: string): string {
  return (t.retention.achievementNames as Record<string, string>)[key] ?? t.engagement.achievementProgress;
}
