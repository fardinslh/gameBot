import { describe, expect, it } from 'vitest';
import type { BuildingId } from '../domain/kingdom-types';
import { buildingActivityMilestone, MAX_AMBIENT_ACTORS, selectAmbientActorIds, type AmbientProgressionState } from './ambient-life';

const allBuildings = (level = 1): AmbientProgressionState => Object.fromEntries(([
  'castle', 'farm', 'lumberMill', 'mine', 'grandMarket', 'academy', 'blacksmith', 'watchtower', 'workshop',
] as const satisfies readonly BuildingId[]).map((id) => [id, { level, unlocked: true, upgrading: false }]));

describe('progression-aware ambient life', () => {
  it('keeps early life restrained and only shows unlocked districts', () => {
    const early = allBuildings();
    early.academy = { level: 1, unlocked: false, upgrading: false };
    early.blacksmith = { level: 1, unlocked: false, upgrading: false };
    early.watchtower = { level: 1, unlocked: false, upgrading: false };
    early.workshop = { level: 1, unlocked: false, upgrading: false };
    const ids = selectAmbientActorIds(early);
    expect(ids).toHaveLength(8);
    expect(ids.some((id) => id.includes('academy') || id.includes('watchtower'))).toBe(false);
  });

  it('adds specialists and court life while enforcing the mobile budget', () => {
    const ids = selectAmbientActorIds(allBuildings(20));
    expect(ids).toContain('court-attendant');
    expect(ids).toContain('ceremonial-guard');
    expect(ids).toHaveLength(MAX_AMBIENT_ACTORS);
  });

  it('prioritizes a construction worker from existing active-upgrade state', () => {
    const states = allBuildings(9);
    states.mine = { level: 9, unlocked: true, upgrading: true };
    expect(selectAmbientActorIds(states)).toContain('construction-mine');
  });

  it.each([[1, 1], [4, 1], [5, 5], [9, 9], [13, 13], [17, 17], [20, 20]])(
    'maps building level %i to its existing visual milestone %i',
    (level, milestone) => expect(buildingActivityMilestone(level)).toBe(milestone),
  );
});
