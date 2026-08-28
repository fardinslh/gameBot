import { ScrollText } from 'lucide-react';
import type { RetentionStateResponse } from '@crown-and-coin/shared';
import type { Dictionary } from '@/i18n/config';
import { BidiValue } from '@/i18n/bidi';

interface RetentionEntryProps { dictionary: Dictionary; state: RetentionStateResponse | null; onOpen(): void; }

export function RetentionEntry({ dictionary: t, state, onOpen }: RetentionEntryProps) {
  const claimAvailable = Boolean(state && (
    state.dailyReturn.canClaimToday
    || state.daily.missions.some((mission) => mission.completed && !mission.claimed)
    || (state.daily.completionBonus.eligible && !state.daily.completionBonus.claimed)
    || state.weekly.missions.some((mission) => mission.completed && !mission.claimed)
    || state.achievements.families.some((family) => family.currentTier?.claimable)
  ));
  return (
    <button className={claimAvailable ? 'retention-entry retention-entry--claim' : 'retention-entry'} aria-label={t.retention.entryLabel} onClick={onOpen} type="button">
      <ScrollText aria-hidden="true" size={17} />
      <span>{t.retention.entry}</span>
      <b><BidiValue direction="ltr">{claimAvailable ? '!' : `${state?.daily.completedCount ?? 0}/3`}</BidiValue></b>
    </button>
  );
}
