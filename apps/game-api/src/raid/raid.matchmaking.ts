import { Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import type { NewPlayerProtectionState } from '@crown-and-coin/shared';
import {
  NEW_KINGDOM_SHIELD_MS,
  RAID_CANDIDATE_POOL_SIZE,
  REAL_PLAYER_MATCH_PASSES,
} from './raid.config';

export interface MatchQualityCandidate {
  player: { id: string; trophies: number };
  team: { power: number };
}

export type RealPlayerMatchPass = (typeof REAL_PLAYER_MATCH_PASSES)[number];

export function newPlayerProtection(
  createdAt: Date,
  isSystemOpponent: boolean,
  now: Date,
): NewPlayerProtectionState {
  if (isSystemOpponent) return { active: false, expiresAt: null };
  const expiresAt = new Date(createdAt.getTime() + NEW_KINGDOM_SHIELD_MS);
  return { active: expiresAt > now, expiresAt: expiresAt.toISOString() };
}

export function matchesRealPlayerPass(
  candidate: MatchQualityCandidate,
  ownTrophies: number,
  ownPower: number,
  pass: RealPlayerMatchPass,
): boolean {
  return Math.abs(candidate.player.trophies - ownTrophies) <= pass.trophyDifference
    && Math.abs(candidate.team.power - ownPower) <= Math.max(1, ownPower * pass.powerDifferenceRatio);
}

export function rankMatchCandidates<T extends MatchQualityCandidate>(
  candidates: readonly T[],
  ownTrophies: number,
  ownPower: number,
): T[] {
  return [...candidates].sort((left, right) => {
    const leftScore = Math.abs(left.player.trophies - ownTrophies) + Math.abs(left.team.power - ownPower) / 10;
    const rightScore = Math.abs(right.player.trophies - ownTrophies) + Math.abs(right.team.power - ownPower) / 10;
    return leftScore - rightScore || left.player.id.localeCompare(right.player.id);
  });
}

@Injectable()
export class RaidCandidateSelector {
  select<T>(rankedCandidates: readonly T[]): T | undefined {
    const poolSize = Math.min(RAID_CANDIDATE_POOL_SIZE, rankedCandidates.length);
    return poolSize === 0 ? undefined : rankedCandidates[this.chooseIndex(poolSize)];
  }

  protected chooseIndex(poolSize: number): number {
    return randomInt(poolSize);
  }
}
