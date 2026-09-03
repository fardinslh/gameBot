import { AnimatedSprite, Assets, Container, Graphics, Texture } from 'pixi.js';
import type { BuildingId } from '../domain/kingdom-types';
import { createAtlasRowFrames } from './sprite-atlas';
import { createCharacterSprite, updateCharacterSprite } from './character-animation';

type AmbientKind = 'GUARD' | 'WORKER' | 'CART' | 'ANIMAL' | 'SCHOLAR' | 'MERCHANT' | 'BUILDER';
export interface AmbientBuildingState { level: number; unlocked: boolean; upgrading: boolean; }
export type AmbientProgressionState = Partial<Record<BuildingId, AmbientBuildingState>>;

interface AmbientDefinition {
  id: string;
  kind: AmbientKind;
  from: readonly [number, number];
  to: readonly [number, number];
  phase: number;
  speed: number;
  priority: number;
  buildingId?: BuildingId;
  minimumLevel?: number;
  minimumCastleLevel?: number;
  activeUpgradeOnly?: boolean;
  color?: number;
}
interface AmbientActor extends AmbientDefinition { container: Container; frames: readonly Texture[]; sprite: AnimatedSprite | null; }

export const MAX_AMBIENT_ACTORS = 14;

const AMBIENT_ROOT = '/assets/kingdom/characters/ambient';
const PEOPLE_ATLAS = `${AMBIENT_ROOT}/people-atlas-v1.webp`;
const GOAT_STRIP = `${AMBIENT_ROOT}/goat-strip-v1.webp`;
const CART_STRIP = `${AMBIENT_ROOT}/cart-strip-v1.webp`;
const PEOPLE_ROW: Readonly<Record<Exclude<AmbientKind, 'CART' | 'ANIMAL'>, number>> = {
  GUARD: 0,
  WORKER: 1,
  MERCHANT: 2,
  SCHOLAR: 3,
  BUILDER: 4,
};

const ACTORS: readonly AmbientDefinition[] = [
  { id: 'castle-guard-west', kind: 'GUARD', from: [250, 710], to: [270, 710], phase: .08, speed: .09, priority: 10, buildingId: 'castle', color: 0x31558a },
  { id: 'castle-guard-east', kind: 'GUARD', from: [390, 710], to: [370, 710], phase: .58, speed: .09, priority: 11, buildingId: 'castle', color: 0x31558a },
  { id: 'farm-worker', kind: 'WORKER', from: [116, 1012], to: [154, 1021], phase: .2, speed: .07, priority: 20, buildingId: 'farm', color: 0x9c6d32 },
  { id: 'lumber-worker', kind: 'WORKER', from: [503, 1018], to: [540, 1008], phase: .7, speed: .065, priority: 21, buildingId: 'lumberMill', color: 0x67503a },
  { id: 'mine-worker', kind: 'WORKER', from: [164, 420], to: [194, 425], phase: .43, speed: .06, priority: 22, buildingId: 'mine', color: 0x776955 },
  { id: 'market-worker', kind: 'MERCHANT', from: [348, 1212], to: [389, 1202], phase: .82, speed: .075, priority: 23, buildingId: 'grandMarket', color: 0x9b4b42 },
  { id: 'resource-cart', kind: 'CART', from: [230, 1085], to: [410, 1085], phase: .12, speed: .035, priority: 30, buildingId: 'farm' },
  { id: 'farm-goat', kind: 'ANIMAL', from: [54, 1024], to: [78, 1021], phase: .63, speed: .055, priority: 31, buildingId: 'farm' },
  { id: 'watchtower-guard', kind: 'GUARD', from: [520, 335], to: [548, 335], phase: .35, speed: .08, priority: 18, buildingId: 'watchtower', color: 0x8f493d },
  { id: 'academy-scholar', kind: 'SCHOLAR', from: [377, 460], to: [403, 468], phase: .46, speed: .052, priority: 24, buildingId: 'academy', color: 0x365f88 },
  { id: 'workshop-builder', kind: 'BUILDER', from: [300, 220], to: [328, 215], phase: .72, speed: .057, priority: 25, buildingId: 'workshop', color: 0x80603d },
  { id: 'blacksmith-smith', kind: 'WORKER', from: [55, 217], to: [78, 213], phase: .27, speed: .062, priority: 26, buildingId: 'blacksmith', color: 0x713a2d },
  { id: 'court-attendant', kind: 'SCHOLAR', from: [292, 745], to: [340, 748], phase: .51, speed: .044, priority: 27, buildingId: 'castle', minimumCastleLevel: 7, color: 0x6b3d76 },
  { id: 'ceremonial-guard', kind: 'GUARD', from: [320, 724], to: [329, 724], phase: .16, speed: .04, priority: 28, buildingId: 'castle', minimumCastleLevel: 17, color: 0x8e2635 },
  { id: 'farm-harvester', kind: 'WORKER', from: [67, 993], to: [103, 1002], phase: .38, speed: .075, priority: 40, buildingId: 'farm', minimumLevel: 5, color: 0xb17b31 },
  { id: 'timber-porter', kind: 'WORKER', from: [535, 984], to: [570, 997], phase: .61, speed: .07, priority: 41, buildingId: 'lumberMill', minimumLevel: 5, color: 0x5d4933 },
  { id: 'ore-cart', kind: 'CART', from: [106, 444], to: [164, 450], phase: .78, speed: .04, priority: 42, buildingId: 'mine', minimumLevel: 9 },
  { id: 'market-merchant', kind: 'MERCHANT', from: [275, 1218], to: [310, 1210], phase: .31, speed: .068, priority: 43, buildingId: 'grandMarket', minimumLevel: 5, color: 0xa25e32 },
  { id: 'watch-signal-runner', kind: 'GUARD', from: [568, 353], to: [584, 365], phase: .68, speed: .085, priority: 44, buildingId: 'watchtower', minimumLevel: 5, color: 0x784035 },
  { id: 'academy-apprentice', kind: 'SCHOLAR', from: [430, 462], to: [450, 470], phase: .14, speed: .058, priority: 45, buildingId: 'academy', minimumLevel: 5, color: 0x426c91 },
  { id: 'forge-apprentice', kind: 'WORKER', from: [105, 212], to: [125, 220], phase: .84, speed: .067, priority: 46, buildingId: 'blacksmith', minimumLevel: 5, color: 0x7a4330 },
  { id: 'workshop-engineer', kind: 'BUILDER', from: [355, 215], to: [377, 224], phase: .42, speed: .055, priority: 47, buildingId: 'workshop', minimumLevel: 5, color: 0x74573b },
  ...([
    ['castle', 286, 716], ['farm', 132, 976], ['lumberMill', 518, 979], ['mine', 137, 407], ['grandMarket', 337, 1188],
    ['watchtower', 535, 342], ['academy', 398, 447], ['workshop', 321, 203], ['blacksmith', 76, 205],
  ] as const).map(([buildingId, x, y], index): AmbientDefinition => ({
    id: `construction-${buildingId}`, kind: 'BUILDER', from: [x - 7, y], to: [x + 7, y + 3], phase: (index * .13) % 1,
    speed: .11, priority: index, buildingId, activeUpgradeOnly: true, color: 0x9a713c,
  })),
] as const;

export interface AmbientLifeArtwork {
  container: Container;
  setProgression(states: AmbientProgressionState, maximumActors?: number): readonly string[];
  update(elapsedSeconds: number): void;
  destroy(): void;
}

export function selectAmbientActorIds(states: AmbientProgressionState, maximumActors = MAX_AMBIENT_ACTORS): readonly string[] {
  const castleLevel = states.castle?.level ?? 1;
  return ACTORS.filter((actor) => {
    const state = actor.buildingId ? states[actor.buildingId] : undefined;
    if (actor.buildingId && !state?.unlocked) return false;
    if (actor.activeUpgradeOnly && !state?.upgrading) return false;
    if ((actor.minimumLevel ?? 1) > (state?.level ?? 1)) return false;
    return (actor.minimumCastleLevel ?? 1) <= castleLevel;
  }).sort((left, right) => left.priority - right.priority).slice(0, Math.max(0, Math.min(MAX_AMBIENT_ACTORS, maximumActors))).map((actor) => actor.id);
}

export function buildingActivityMilestone(level: number): 1 | 5 | 9 | 13 | 17 | 20 {
  if (level >= 20) return 20;
  if (level >= 17) return 17;
  if (level >= 13) return 13;
  if (level >= 9) return 9;
  if (level >= 5) return 5;
  return 1;
}

export function createAmbientLifeArtwork(): AmbientLifeArtwork {
  const container = new Container();
  container.eventMode = 'none';
  container.label = 'ambient-life';
  const actors: AmbientActor[] = ACTORS.map((definition) => {
    const actorContainer = new Container();
    actorContainer.eventMode = 'none';
    actorContainer.label = `ambient-${definition.kind.toLowerCase()}`;
    const actor = { ...definition, container: actorContainer, frames: [], sprite: null };
    actor.container.position.set(...definition.from);
    actor.container.visible = false;
    container.addChild(actor.container);
    return actor;
  });
  let progression: AmbientProgressionState = {};
  let destroyed = false;
  let previousElapsedSeconds = 0;
  void Promise.all([
    Assets.load<Texture>(PEOPLE_ATLAS),
    Assets.load<Texture>(GOAT_STRIP),
    Assets.load<Texture>(CART_STRIP),
  ]).then(([people, goat, cart]) => {
    if (destroyed) return;
    for (const actor of actors) {
      actor.frames = actor.kind === 'CART'
        ? createAtlasRowFrames(cart, 0, 1)
        : actor.kind === 'ANIMAL'
          ? createAtlasRowFrames(goat, 0, 1)
          : createAtlasRowFrames(people, PEOPLE_ROW[actor.kind], 5);
      const artwork = createSpriteActor(actor.kind, actor.frames);
      actor.sprite = artwork.sprite;
      actor.container.addChild(artwork.shadow, artwork.sprite);
    }
  }).catch(() => undefined);
  return {
    container,
    setProgression: (states, maximumActors) => {
      progression = states;
      const visibleIds = new Set(selectAmbientActorIds(states, maximumActors));
      for (const actor of actors) actor.container.visible = visibleIds.has(actor.id);
      return [...visibleIds];
    },
    update: (elapsedSeconds) => {
      const deltaSeconds = Math.max(0, Math.min(.05, elapsedSeconds - previousElapsedSeconds));
      previousElapsedSeconds = elapsedSeconds;
      for (const actor of actors) {
        if (!actor.container.visible) continue;
        const level = actor.buildingId ? progression[actor.buildingId]?.level ?? 1 : 1;
        const milestoneBoost = (buildingActivityMilestone(level) - 1) / 19;
        const cycle = (elapsedSeconds * actor.speed * (1 + milestoneBoost * .32) + actor.phase) % 2;
        const progress = cycle <= 1 ? cycle : 2 - cycle;
        const direction = cycle <= 1 ? 1 : -1;
        actor.container.x = actor.from[0] + (actor.to[0] - actor.from[0]) * progress;
        actor.container.y = actor.from[1] + (actor.to[1] - actor.from[1]) * progress;
        actor.container.scale.x = direction;
        if (actor.sprite) updateCharacterSprite(actor.sprite, deltaSeconds);
      }
    },
    destroy: () => {
      destroyed = true;
      container.destroy({ children: true });
    },
  };
}

function createSpriteActor(kind: AmbientKind, frames: readonly Texture[]): { shadow: Graphics; sprite: AnimatedSprite } {
  const height = kind === 'GUARD' ? 30 : kind === 'CART' ? 24 : kind === 'ANIMAL' ? 17 : 27;
  const width = kind === 'CART' ? 15 : kind === 'ANIMAL' ? 8 : 6;
  const shadow = new Graphics().ellipse(0, 1, width, Math.max(1.5, height * .07)).fill({ color: 0x0b100b, alpha: .3 });
  const fps = kind === 'CART' ? 2 : kind === 'ANIMAL' ? 3 : kind === 'GUARD' ? 2 : 4;
  const sprite = createCharacterSprite({ name: kind === 'GUARD' ? 'idle' : 'walk', fps, frames, loop: true });
  sprite.height = height;
  sprite.scale.x = sprite.scale.y;
  sprite.position.y = 1;
  return { shadow, sprite };
}
