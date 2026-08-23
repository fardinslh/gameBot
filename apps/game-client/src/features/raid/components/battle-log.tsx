import { ArrowLeft, Clock3, Coins, Eye, History, Shield, Swords, Trophy } from 'lucide-react';
import type { DefenseInboxResponse, RevengeStatus } from '@crown-and-coin/shared';
import type { Dictionary } from '@/i18n/config';
import { formatAmount } from '@/features/kingdom/components/resource-hud';

interface BattleLogProps {
  dictionary: Dictionary;
  inbox: DefenseInboxResponse | null;
  loading: boolean;
  onBack(): void;
  onRefresh(): void;
  onRevenge(revengeTargetId: string): void;
  onViewBattle(battleId: string): void;
}

export function BattleLog({ dictionary: t, inbox, loading, onBack, onRefresh, onRevenge, onViewBattle }: BattleLogProps) {
  const serverNow = Date.parse(inbox?.serverTime ?? new Date().toISOString());
  return (
    <section className="battle-log" data-raid-state="inbox">
      <header className="battle-log__header">
        <button aria-label={t.inboxUi.back} onClick={onBack} type="button"><ArrowLeft size={19} /></button>
        <span><History size={21} /></span>
        <div><h1>{t.inboxUi.title}</h1><p>{t.inboxUi.incomingAttacks}</p></div>
        <b><Shield size={14} /> {inbox?.entries.length ?? 0}</b>
      </header>
      {loading && !inbox ? <div className="battle-log__empty"><span /><p>{t.inboxUi.loading}</p></div> : null}
      {!loading && inbox?.entries.length === 0 ? (
        <div className="battle-log__empty"><Shield size={38} /><h2>{t.inboxUi.noAttacks}</h2><button onClick={onRefresh} type="button">{t.retry}</button></div>
      ) : null}
      <div className="battle-log__list">
        {inbox?.entries.map((entry) => {
          const loss = entry.defenseResult === 'DEFENSE_LOSS';
          return (
            <article className={`battle-entry battle-entry--${loss ? 'loss' : 'win'}`} data-battle-id={entry.battleId} key={entry.battleId}>
              <div className="battle-entry__crest"><Swords size={22} /></div>
              <div className="battle-entry__identity">
                <small>{t.inboxUi.attackedYou}</small>
                <h2>{entry.attacker.displayName}</h2>
                <span><Clock3 size={11} /> {relativeTime(entry.createdAt, serverNow, t)}</span>
              </div>
              <strong className="battle-entry__result">{loss ? t.inboxUi.defenseDefeat : t.inboxUi.defenseVictory}</strong>
              <div className="battle-entry__impact">
                <span><Trophy size={13} /> {entry.trophyDelta > 0 ? '+' : ''}{entry.trophyDelta}</span>
                <span><Coins size={13} /> {loss ? t.inboxUi.resourcesLost : t.inboxUi.noResourcesLost}</span>
              </div>
              {loss ? <div className="battle-entry__loot">{Object.entries(entry.lootLost).map(([resource, amount]) => (
                <span key={resource}><b>-{formatAmount(amount)}</b><small>{t.resourceShort[resource as keyof typeof t.resourceShort]}</small></span>
              ))}</div> : null}
              <div className="battle-entry__actions">
                <button className="battle-entry__detail" onClick={() => onViewBattle(entry.battleId)} type="button"><Eye size={14} /> {t.inboxUi.viewBattle}</button>
                {entry.revengeStatus === 'AVAILABLE' && entry.revengeTargetId ? (
                  <button className="battle-entry__revenge" onClick={() => onRevenge(entry.revengeTargetId!)} type="button">{t.inboxUi.revenge}</button>
                ) : <span>{revengeStatus(entry.revengeStatus, t)}</span>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function revengeStatus(status: RevengeStatus, t: Dictionary): string {
  if (status === 'USED') return t.inboxUi.revengeUsed;
  if (status === 'EXPIRED') return t.inboxUi.revengeExpired;
  return t.inboxUi.revengeUnavailable;
}

function relativeTime(timestamp: string, serverNow: number, t: Dictionary): string {
  const elapsed = Math.max(0, serverNow - Date.parse(timestamp));
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return t.inboxUi.now;
  if (minutes < 60) return t.inboxUi.minutesAgo.replace('{count}', String(minutes));
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t.inboxUi.hoursAgo.replace('{count}', String(hours));
  if (hours < 48) return t.inboxUi.yesterday;
  return t.inboxUi.daysAgo.replace('{count}', String(Math.floor(hours / 24)));
}
