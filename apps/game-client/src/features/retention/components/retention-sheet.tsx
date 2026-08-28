'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, Check, Gift, ScrollText, Sparkles, Trophy, X } from 'lucide-react';
import type { RetentionAchievementFamilyState, RetentionMissionState, RetentionRewardItem, RetentionStateResponse } from '@crown-and-coin/shared';
import type { Dictionary } from '@/i18n/config';
import { BidiTemplate, BidiValue } from '@/i18n/bidi';
import { trackClientEvent } from '@/features/analytics/analytics-client';

type Tab = 'daily' | 'weekly' | 'achievements';

interface RetentionSheetProps {
  dictionary: Dictionary;
  state: RetentionStateResponse | null;
  serverNow: number;
  action: string;
  errorCode: string | null;
  onClose(): void;
  onRetry(): void;
  onClaimMission(id: string): void;
  onClaimDailyBonus(): void;
  onClaimAchievement(key: string, tier: number): void;
  onClaimDailyReturn(): void;
}

export function RetentionSheet(props: RetentionSheetProps) {
  const { dictionary: t, state, serverNow, action, errorCode } = props;
  const [tab, setTab] = useState<Tab>('daily');
  useEffect(() => { trackClientEvent('retention_screen_opened', { tab: 'DAILY' }); }, []);
  return (
    <div className="retention-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) props.onClose(); }}>
      <section className="retention-panel" role="dialog" aria-modal="true" aria-labelledby="retention-title" data-retention-tab={tab}>
        <header className="retention-header">
          <span><ScrollText aria-hidden="true" size={21} /></span>
          <div><h2 id="retention-title">{t.retention.title}</h2><small>{t.retention.subtitle}</small></div>
          <button aria-label={t.close} onClick={props.onClose} type="button"><X size={19} /></button>
        </header>

        <div className="daily-return-banner" data-daily-return={state?.dailyReturn.canClaimToday ? 'available' : 'waiting'}>
          <div className="daily-return-banner__heading"><Gift aria-hidden="true" size={18} /><span><strong>{t.retention.dailyReward}</strong><small>{state?.dailyReturn.canClaimToday ? t.retention.nextReward : <BidiTemplate template={t.retention.resetsIn} values={{ time: { direction: 'ltr', value: duration(state?.dailyResetAt, serverNow, t) } }} />}</small></span></div>
          <div className="daily-return-track">
            {(state?.dailyReturn.cycle ?? []).map((day) => <div className={`daily-return-day daily-return-day--${day.status.toLowerCase()}`} key={day.dayIndex}>
              <span><BidiValue direction="ltr">{day.dayIndex}</BidiValue></span>
              {day.status === 'CLAIMED' ? <Check aria-hidden="true" size={11} /> : <small>{day.rewards.some((item) => item.resource === 'GEMS') ? '◆' : '●'}</small>}
            </div>)}
          </div>
          {state?.dailyReturn.canClaimToday ? <button className="retention-claim" disabled={action !== 'idle'} onClick={props.onClaimDailyReturn} type="button">{action === 'daily-return' ? t.retention.claiming : t.retention.claim}</button> : null}
        </div>

        <nav className="retention-tabs" aria-label={t.retention.title}>
          {(['daily', 'weekly', 'achievements'] as const).map((item) => <button aria-selected={tab === item} key={item} onClick={() => setTab(item)} role="tab" type="button">{item === 'daily' ? t.retention.daily : item === 'weekly' ? t.retention.weekly : t.retention.achievements}</button>)}
        </nav>

        <div className="retention-content">
          {!state ? <div className="retention-empty"><span /><p>{errorCode ? t.retention.unavailable : t.loadingKingdom}</p>{errorCode ? <button onClick={props.onRetry} type="button">{t.retention.retry}</button> : null}</div> : null}
          {state && tab === 'daily' ? <DailyContent {...props} state={state} /> : null}
          {state && tab === 'weekly' ? <MissionList dictionary={t} missions={state.weekly.missions} action={action} resetAt={state.weeklyResetAt} serverNow={serverNow} onClaim={props.onClaimMission} /> : null}
          {state && tab === 'achievements' ? <AchievementList dictionary={t} families={state.achievements.families} action={action} onClaim={props.onClaimAchievement} /> : null}
        </div>
        {errorCode && state ? <div className="retention-error" role="alert">{retentionError(errorCode, t)} <button onClick={props.onRetry} type="button">{t.retention.retry}</button></div> : null}
      </section>
    </div>
  );
}

function DailyContent(props: RetentionSheetProps & { state: RetentionStateResponse }) {
  const { dictionary: t, state, serverNow, action } = props;
  const bonus = state.daily.completionBonus;
  return <>
    <div className="daily-goal-summary">
      <span><strong>{t.retention.dailyGoals}</strong><small><BidiTemplate template={t.retention.resetsIn} values={{ time: { direction: 'ltr', value: duration(state.dailyResetAt, serverNow, t) } }} /></small></span>
      <b><BidiValue direction="ltr">{bonus.completedCount}/{bonus.requiredCount}</BidiValue></b>
    </div>
    <MissionList dictionary={t} missions={state.daily.missions} action={action} onClaim={props.onClaimMission} />
    <article className={bonus.eligible ? 'daily-completion daily-completion--ready' : 'daily-completion'}>
      <Sparkles aria-hidden="true" size={19} /><div><strong>{t.retention.allDailyComplete}</strong><small>{t.retention.allDailyHint}</small><RewardLine dictionary={t} rewards={bonus.rewards} /></div>
      {bonus.claimed ? <span className="retention-claimed"><Check size={12} />{t.retention.claimed}</span> : bonus.eligible ? <button className="retention-claim" disabled={action !== 'idle'} onClick={props.onClaimDailyBonus} type="button">{action === 'daily-bonus' ? t.retention.claiming : t.retention.claim}</button> : null}
    </article>
  </>;
}

function MissionList({ dictionary: t, missions, action, resetAt, serverNow, onClaim }: { dictionary: Dictionary; missions: RetentionMissionState[]; action: string; resetAt?: string; serverNow?: number; onClaim(id: string): void }) {
  return <section className="retention-missions">
    {resetAt && serverNow ? <small className="retention-reset"><BidiTemplate template={t.retention.resetsIn} values={{ time: { direction: 'ltr', value: duration(resetAt, serverNow, t) } }} /></small> : null}
    {missions.map((mission) => <MissionCard key={mission.id} dictionary={t} mission={mission} pending={action === `mission:${mission.id}`} disabled={action !== 'idle'} onClaim={() => onClaim(mission.id)} />)}
  </section>;
}

function MissionCard({ dictionary: t, mission, pending, disabled, onClaim }: { dictionary: Dictionary; mission: RetentionMissionState; pending: boolean; disabled: boolean; onClaim(): void }) {
  const name = t.retention.missionNames[mission.key as keyof typeof t.retention.missionNames] ?? mission.key;
  const description = t.retention.missionDescriptions[mission.key as keyof typeof t.retention.missionDescriptions] ?? mission.key;
  const percent = progressPercent(mission.progress, mission.target);
  return <article className={mission.completed ? 'retention-mission retention-mission--complete' : 'retention-mission'} data-mission-key={mission.key}>
    <span className="retention-mission__icon">{mission.completed ? <Check size={17} /> : <CalendarDays size={17} />}</span>
    <div className="retention-mission__body"><strong>{name}</strong><small>{description}</small><div className="retention-progress"><i><b style={{ width: `${percent}%` }} /></i><span><BidiValue direction="ltr">{mission.progress}/{mission.target}</BidiValue></span></div><RewardLine dictionary={t} rewards={mission.rewards} /></div>
    {mission.claimed ? <span className="retention-claimed"><Check size={11} />{t.retention.claimed}</span> : mission.completed ? <button className="retention-claim" disabled={disabled} onClick={onClaim} type="button">{pending ? t.retention.claiming : t.retention.claim}</button> : null}
  </article>;
}

function AchievementList({ dictionary: t, families, action, onClaim }: { dictionary: Dictionary; families: RetentionAchievementFamilyState[]; action: string; onClaim(key: string, tier: number): void }) {
  return <section className="retention-achievements">{families.map((family) => {
    const current = family.currentTier;
    const name = t.retention.achievementNames[family.key as keyof typeof t.retention.achievementNames] ?? family.key;
    const description = t.retention.achievementDescriptions[family.key as keyof typeof t.retention.achievementDescriptions] ?? family.key;
    const pending = current ? action === `achievement:${family.key}:${current.tier}` : false;
    return <article className="retention-achievement" key={family.key} data-achievement-key={family.key}>
      <span className="retention-achievement__icon"><Trophy size={17} /></span>
      <div><strong>{name}</strong><small>{description}</small>{current ? <><div className="retention-progress"><i><b style={{ width: `${progressPercent(family.progress, current.target)}%` }} /></i><span><BidiValue direction="ltr">{family.progress}/{current.target}</BidiValue></span></div><span className="achievement-tier"><BidiTemplate template={t.retention.tier} values={{ tier: { direction: 'ltr', value: current.tier } }} /><RewardLine dictionary={t} rewards={current.rewards} /></span></> : <span className="retention-claimed"><Check size={11} />{t.retention.completed}</span>}</div>
      {current?.claimable ? <button className="retention-claim" disabled={action !== 'idle'} onClick={() => onClaim(family.key, current.tier)} type="button">{pending ? t.retention.claiming : t.retention.claim}</button> : null}
    </article>;
  })}</section>;
}

function RewardLine({ dictionary: t, rewards }: { dictionary: Dictionary; rewards: RetentionRewardItem[] }) {
  return <span className="retention-rewards" aria-label={t.retention.reward}>{rewards.map((reward) => <em key={reward.resource}><BidiValue direction="ltr">+{compact(reward.amount)}</BidiValue> {t.resourceShort[reward.resource]}</em>)}</span>;
}

function compact(value: string): string {
  const amount = Number(value);
  return amount >= 1_000_000 ? `${(amount / 1_000_000).toFixed(amount % 1_000_000 ? 1 : 0)}M` : amount >= 1_000 ? `${(amount / 1_000).toFixed(amount % 1_000 ? 1 : 0)}K` : value;
}

function progressPercent(progress: string, target: string): number {
  return Math.min(100, Math.round(Number(BigInt(progress) * BigInt(100) / BigInt(target))));
}

function duration(resetAt: string | undefined, serverNow: number, t: Dictionary): string {
  if (!resetAt) return '—';
  const seconds = Math.max(0, Math.ceil((Date.parse(resetAt) - serverNow) / 1_000));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  return days > 0 ? `${days} ${t.retention.dayShort} ${hours} ${t.retention.hourShort}` : hours > 0 ? `${hours} ${t.retention.hourShort} ${minutes} ${t.retention.minuteShort}` : `${minutes} ${t.retention.minuteShort}`;
}

function retentionError(code: string, t: Dictionary): string {
  return t.retention.errors[code as keyof typeof t.retention.errors] ?? t.retention.errors.SERVER_ERROR;
}
