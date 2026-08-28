import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENTS,
  DAILY_COMPLETION_REWARDS,
  DAILY_MISSION_COUNT,
  DAILY_MISSIONS,
  DAILY_RETURN_REWARDS,
  WEEKLY_MISSION_COUNT,
  WEEKLY_MISSIONS,
} from './retention.config';

describe('retention configuration', () => {
  it('keeps mission pools varied, scarce, and free of revenge chores', () => {
    expect(DAILY_MISSION_COUNT).toBe(3);
    expect(WEEKLY_MISSION_COUNT).toBe(3);
    expect(DAILY_MISSIONS).toHaveLength(6);
    expect(WEEKLY_MISSIONS).toHaveLength(5);
    expect([...DAILY_MISSIONS, ...WEEKLY_MISSIONS].some((mission) => mission.metric === 'REVENGE_COMPLETED')).toBe(false);
    expect(DAILY_COMPLETION_REWARDS.some((reward) => reward.resource === 'GEMS' && reward.amount === 2n)).toBe(true);
  });

  it('defines all nine achievement families with ordered positive tiers', () => {
    expect(ACHIEVEMENTS).toHaveLength(9);
    expect(new Set(ACHIEVEMENTS.map((achievement) => achievement.key)).size).toBe(9);
    for (const achievement of ACHIEVEMENTS) {
      expect(achievement.tiers.length).toBeGreaterThanOrEqual(3);
      for (let index = 0; index < achievement.tiers.length; index += 1) {
        expect(achievement.tiers[index].tier).toBe(index + 1);
        expect(achievement.tiers[index].target).toBeGreaterThan(index === 0 ? 0n : achievement.tiers[index - 1].target);
      }
    }
  });

  it('defines one positive reward for each day in the seven-day return cycle', () => {
    expect(DAILY_RETURN_REWARDS.map((day) => day.dayIndex)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const day of DAILY_RETURN_REWARDS) {
      expect(day.rewards.length).toBeGreaterThan(0);
      expect(day.rewards.every((reward) => reward.amount > 0n)).toBe(true);
    }
  });
});
