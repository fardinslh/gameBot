import { describe, expect, it } from 'vitest';
import { NEW_KINGDOM_SHIELD_MS, RAID_CANDIDATE_POOL_SIZE, REAL_PLAYER_MATCH_PASSES } from './raid.config';
import {
  matchesRealPlayerPass,
  newPlayerProtection,
  RaidCandidateSelector,
  rankMatchCandidates,
} from './raid.matchmaking';

const candidate = (id: string, trophies: number, power: number) => ({ player: { id, trophies }, team: { power } });

class LastInPoolSelector extends RaidCandidateSelector {
  protected override chooseIndex(poolSize: number): number {
    return poolSize - 1;
  }
}

describe('launch-safe Raid matchmaking', () => {
  it('derives new-player protection from persistent creation time and exempts system accounts', () => {
    const now = new Date('2026-08-26T12:00:00.000Z');
    const fresh = newPlayerProtection(new Date(now.getTime() - NEW_KINGDOM_SHIELD_MS + 1), false, now);
    const expired = newPlayerProtection(new Date(now.getTime() - NEW_KINGDOM_SHIELD_MS), false, now);
    expect(fresh.active).toBe(true);
    expect(fresh.expiresAt).toBe(new Date(now.getTime() + 1).toISOString());
    expect(expired).toEqual({ active: false, expiresAt: now.toISOString() });
    expect(newPlayerProtection(now, true, now)).toEqual({ active: false, expiresAt: null });
  });

  it('enforces all three bounded real-player passes', () => {
    const ownTrophies = 1_000;
    const ownPower = 10_000;
    expect(matchesRealPlayerPass(candidate('tight', 1_150, 11_500), ownTrophies, ownPower, REAL_PLAYER_MATCH_PASSES[0])).toBe(true);
    expect(matchesRealPlayerPass(candidate('wide', 1_300, 13_000), ownTrophies, ownPower, REAL_PLAYER_MATCH_PASSES[1])).toBe(true);
    expect(matchesRealPlayerPass(candidate('maximum', 1_450, 14_000), ownTrophies, ownPower, REAL_PLAYER_MATCH_PASSES[2])).toBe(true);
    expect(matchesRealPlayerPass(candidate('trophy-too-far', 1_451, 10_000), ownTrophies, ownPower, REAL_PLAYER_MATCH_PASSES[2])).toBe(false);
    expect(matchesRealPlayerPass(candidate('power-too-far', 1_000, 14_001), ownTrophies, ownPower, REAL_PLAYER_MATCH_PASSES[2])).toBe(false);
  });

  it('ranks by match quality and selects only from the top candidate pool', () => {
    const ranked = rankMatchCandidates([
      candidate('sixth', 1_060, 1_000),
      candidate('first', 1_010, 1_000),
      candidate('third', 1_030, 1_000),
      candidate('second', 1_020, 1_000),
      candidate('fifth', 1_050, 1_000),
      candidate('fourth', 1_040, 1_000),
    ], 1_000, 1_000);
    const selector = new LastInPoolSelector();
    expect(selector.select(ranked)?.player.id).toBe('fifth');
    expect(RAID_CANDIDATE_POOL_SIZE).toBe(5);
  });
});
