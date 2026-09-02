import { Container, Graphics } from 'pixi.js';
import type { BuildingId } from '../domain/kingdom-types';

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
interface AmbientActor extends AmbientDefinition { container: Container; }

export const MAX_AMBIENT_ACTORS = 14;

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
  setProgression(states: AmbientProgressionState): readonly string[];
  update(elapsedSeconds: number): void;
  destroy(): void;
}

export function selectAmbientActorIds(states: AmbientProgressionState): readonly string[] {
  const castleLevel = states.castle?.level ?? 1;
  return ACTORS.filter((actor) => {
    const state = actor.buildingId ? states[actor.buildingId] : undefined;
    if (actor.buildingId && !state?.unlocked) return false;
    if (actor.activeUpgradeOnly && !state?.upgrading) return false;
    if ((actor.minimumLevel ?? 1) > (state?.level ?? 1)) return false;
    return (actor.minimumCastleLevel ?? 1) <= castleLevel;
  }).sort((left, right) => left.priority - right.priority).slice(0, MAX_AMBIENT_ACTORS).map((actor) => actor.id);
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
    const actor = { ...definition, container: createActor(definition) };
    actor.container.position.set(...definition.from);
    actor.container.visible = false;
    container.addChild(actor.container);
    return actor;
  });
  let progression: AmbientProgressionState = {};
  return {
    container,
    setProgression: (states) => {
      progression = states;
      const visibleIds = new Set(selectAmbientActorIds(states));
      for (const actor of actors) actor.container.visible = visibleIds.has(actor.id);
      return [...visibleIds];
    },
    update: (elapsedSeconds) => {
      for (const actor of actors) {
        if (!actor.container.visible) continue;
        const level = actor.buildingId ? progression[actor.buildingId]?.level ?? 1 : 1;
        const milestoneBoost = (buildingActivityMilestone(level) - 1) / 19;
        const cycle = (elapsedSeconds * actor.speed * (1 + milestoneBoost * .32) + actor.phase) % 2;
        const progress = cycle <= 1 ? cycle : 2 - cycle;
        const direction = cycle <= 1 ? 1 : -1;
        actor.container.x = actor.from[0] + (actor.to[0] - actor.from[0]) * progress;
        actor.container.y = actor.from[1] + (actor.to[1] - actor.from[1]) * progress + Math.sin(elapsedSeconds * 2.2 + actor.phase * 8) * .7;
        actor.container.scale.x = direction;
        if (actor.kind === 'GUARD') actor.container.rotation = Math.sin(elapsedSeconds * 1.4 + actor.phase * 7) * .018;
        if (actor.kind === 'ANIMAL') actor.container.rotation = Math.sin(elapsedSeconds * 1.9) * .025;
      }
    },
    destroy: () => container.destroy({ children: true }),
  };
}

function createActor(definition: AmbientDefinition): Container {
  if (definition.kind === 'CART') return createCart();
  if (definition.kind === 'ANIMAL') return createAnimal();
  return createPerson(definition.kind, definition.color ?? 0x71583e);
}

function createPerson(kind: Exclude<AmbientKind, 'CART' | 'ANIMAL'>, tunic: number): Container {
  const guard = kind === 'GUARD';
  const actor = new Container();
  actor.eventMode = 'none';
  actor.addChild(new Graphics().ellipse(0, 2, 7, 2.3).fill({ color: 0x10140e, alpha: .3 }));
  const body = new Graphics().poly([-4, -13, 4, -13, 5, -3, 2, 1, -3, 1, -5, -3]).fill({ color: tunic })
    .circle(0, -17, 3.8).fill({ color: 0xc69a68 }).moveTo(-2, 1).lineTo(-3, 6).moveTo(2, 1).lineTo(3, 6).stroke({ color: 0x33291f, width: 2 });
  if (guard) {
    body.poly([-5, -20, 0, -23, 5, -20, 3.5, -16, -3.5, -16]).fill({ color: 0x777a77 });
    body.moveTo(6, -20).lineTo(6, 4).stroke({ color: 0x7b6544, width: 1.4 });
    body.poly([4.4, -20, 7.6, -20, 6, -25]).fill({ color: 0xaeb4af });
  } else {
    body.arc(0, -18, 4.6, Math.PI, Math.PI * 2).stroke({ color: kind === 'SCHOLAR' ? 0xd6c56c : 0xd2b887, width: 1.4 });
    if (kind === 'SCHOLAR') body.rect(4, -12, 5, 7).fill({ color: 0xceb665 }).stroke({ color: 0x6b5228, width: .7 });
    if (kind === 'BUILDER') body.moveTo(4, -10).lineTo(9, -17).stroke({ color: 0x8b6a3f, width: 1.8 });
    if (kind === 'MERCHANT') body.circle(5, -8, 3).fill({ color: 0x9d7444 });
  }
  actor.addChild(body);
  return actor;
}

function createCart(): Container {
  const cart = new Container();
  cart.eventMode = 'none';
  cart.addChild(new Graphics().ellipse(0, 3, 13, 3).fill({ color: 0x11150f, alpha: .3 }));
  cart.addChild(new Graphics().poly([-10, -8, 8, -8, 6, 0, -8, 0]).fill({ color: 0x76502d })
    .rect(-7, -12, 5, 4).fill({ color: 0xb28a4a }).rect(-1, -13, 6, 5).fill({ color: 0x94703b })
    .circle(-7, 1, 3.4).fill({ color: 0x2e241a }).circle(6, 1, 3.4).fill({ color: 0x2e241a })
    .circle(-7, 1, 1.2).fill({ color: 0x9b7a4c }).circle(6, 1, 1.2).fill({ color: 0x9b7a4c })
    .moveTo(8, -5).lineTo(15, -2).stroke({ color: 0x6d4b2c, width: 1.6 }));
  return cart;
}

function createAnimal(): Container {
  const animal = new Container();
  animal.eventMode = 'none';
  animal.addChild(new Graphics().ellipse(0, 2, 7, 2).fill({ color: 0x11140f, alpha: .25 }));
  animal.addChild(new Graphics().ellipse(0, -5, 7, 4.5).fill({ color: 0xd2c2a1 }).circle(6, -8, 3.2).fill({ color: 0xbba783 })
    .poly([5, -11, 3, -15, 7, -12]).fill({ color: 0x8c7658 }).poly([8, -10, 10, -14, 10, -10]).fill({ color: 0x8c7658 })
    .moveTo(-4, -2).lineTo(-4, 3).moveTo(3, -2).lineTo(3, 3).stroke({ color: 0x5b4a37, width: 1.4 }));
  return animal;
}
