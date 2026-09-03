import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnimatedSprite, Assets, Texture } from 'pixi.js';
import type { BuildingId } from '../domain/kingdom-types';
import { buildingActivityMilestone, createAmbientLifeArtwork, MAX_AMBIENT_ACTORS, selectAmbientActorIds, type AmbientProgressionState } from './ambient-life';

const allBuildings = (level = 1): AmbientProgressionState => Object.fromEntries(([
  'castle', 'farm', 'lumberMill', 'mine', 'grandMarket', 'academy', 'blacksmith', 'watchtower', 'workshop',
] as const satisfies readonly BuildingId[]).map((id) => [id, { level, unlocked: true, upgrading: false }]));

describe('progression-aware ambient life', () => {
  afterEach(() => vi.restoreAllMocks());

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

  it('shares the normal actor budget with three persistent Heroes', () => {
    expect(selectAmbientActorIds(allBuildings(20), MAX_AMBIENT_ACTORS - 3)).toHaveLength(11);
  });

  it('renders visible inhabitants from sprite assets rather than procedural bodies', async () => {
    vi.spyOn(Assets, 'load').mockImplementation(() => Promise.resolve(Texture.WHITE) as unknown as ReturnType<typeof Assets.load>);
    const artwork = createAmbientLifeArtwork();
    artwork.setProgression(allBuildings());
    await vi.waitFor(() => expect(artwork.container.children[0]?.children.some((child) => child instanceof AnimatedSprite)).toBe(true));
    const sprite = artwork.container.children[0]?.children.find((child) => child instanceof AnimatedSprite);
    expect(sprite?.textures).toHaveLength(2);
    expect(sprite?.label).toBe('animation-idle');
    expect(artwork.container.children.filter((actor) => actor.visible)).toHaveLength(selectAmbientActorIds(allBuildings()).length);
    artwork.destroy();
  });

  it.each([[1, 1], [4, 1], [5, 5], [9, 9], [13, 13], [17, 17], [20, 20]])(
    'maps building level %i to its existing visual milestone %i',
    (level, milestone) => expect(buildingActivityMilestone(level)).toBe(milestone),
  );
});
