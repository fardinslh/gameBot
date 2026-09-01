import { Container, Graphics } from 'pixi.js';
import type { KingdomExpansionStage } from '@crown-and-coin/shared';

type AmbientKind = 'GUARD' | 'WORKER' | 'CART' | 'ANIMAL';

interface AmbientDefinition {
  id: string;
  kind: AmbientKind;
  from: readonly [number, number];
  to: readonly [number, number];
  phase: number;
  requiredStage: KingdomExpansionStage;
  speed: number;
  color?: number;
}

interface AmbientActor extends AmbientDefinition {
  container: Container;
}

const ACTORS: readonly AmbientDefinition[] = [
  { id: 'castle-guard-west', kind: 'GUARD', from: [250, 710], to: [270, 710], phase: .08, requiredStage: 1, speed: .09, color: 0x31558a },
  { id: 'castle-guard-east', kind: 'GUARD', from: [390, 710], to: [370, 710], phase: .58, requiredStage: 1, speed: .09, color: 0x31558a },
  { id: 'watchtower-guard', kind: 'GUARD', from: [520, 335], to: [548, 335], phase: .35, requiredStage: 2, speed: .08, color: 0x8f493d },
  { id: 'farm-worker', kind: 'WORKER', from: [116, 1012], to: [154, 1021], phase: .2, requiredStage: 1, speed: .07, color: 0x9c6d32 },
  { id: 'lumber-worker', kind: 'WORKER', from: [503, 1018], to: [540, 1008], phase: .7, requiredStage: 1, speed: .065, color: 0x67503a },
  { id: 'mine-worker', kind: 'WORKER', from: [164, 420], to: [194, 425], phase: .43, requiredStage: 1, speed: .06, color: 0x776955 },
  { id: 'market-worker', kind: 'WORKER', from: [348, 1212], to: [389, 1202], phase: .82, requiredStage: 1, speed: .075, color: 0x9b4b42 },
  { id: 'resource-cart', kind: 'CART', from: [230, 1085], to: [410, 1085], phase: .12, requiredStage: 1, speed: .035 },
  { id: 'farm-goat', kind: 'ANIMAL', from: [54, 1024], to: [78, 1021], phase: .63, requiredStage: 1, speed: .055 },
] as const;

export interface AmbientLifeArtwork {
  container: Container;
  setExpansionStage(stage: KingdomExpansionStage): number;
  update(elapsedSeconds: number): void;
  destroy(): void;
}

export function createAmbientLifeArtwork(initialStage: KingdomExpansionStage): AmbientLifeArtwork {
  const container = new Container();
  container.eventMode = 'none';
  container.label = 'ambient-life';
  const actors: AmbientActor[] = ACTORS.map((definition) => {
    const actor = { ...definition, container: createActor(definition) };
    actor.container.position.set(...definition.from);
    container.addChild(actor.container);
    return actor;
  });

  const setExpansionStage = (stage: KingdomExpansionStage): number => {
    let visible = 0;
    for (const actor of actors) {
      actor.container.visible = actor.requiredStage <= stage;
      if (actor.container.visible) visible += 1;
    }
    return visible;
  };

  setExpansionStage(initialStage);
  return {
    container,
    setExpansionStage,
    update: (elapsedSeconds) => {
      for (const actor of actors) {
        if (!actor.container.visible) continue;
        const cycle = (elapsedSeconds * actor.speed + actor.phase) % 2;
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
  return createPerson(definition.kind === 'GUARD', definition.color ?? 0x71583e);
}

function createPerson(guard: boolean, tunic: number): Container {
  const actor = new Container();
  actor.eventMode = 'none';
  actor.addChild(new Graphics().ellipse(0, 2, 7, 2.3).fill({ color: 0x10140e, alpha: .34 }));
  const body = new Graphics()
    .poly([-4, -13, 4, -13, 5, -3, 2, 1, -3, 1, -5, -3]).fill({ color: tunic })
    .circle(0, -17, 3.8).fill({ color: 0xc69a68 })
    .moveTo(-2, 1).lineTo(-3, 6).moveTo(2, 1).lineTo(3, 6).stroke({ color: 0x33291f, width: 2 });
  if (guard) {
    body.poly([-5, -20, 0, -23, 5, -20, 3.5, -16, -3.5, -16]).fill({ color: 0x777a77 });
    body.moveTo(6, -20).lineTo(6, 4).stroke({ color: 0x7b6544, width: 1.4 });
    body.poly([4.4, -20, 7.6, -20, 6, -25]).fill({ color: 0xaeb4af });
  } else {
    body.arc(0, -18, 4.6, Math.PI, Math.PI * 2).stroke({ color: 0xd2b887, width: 1.4 });
  }
  actor.addChild(body);
  return actor;
}

function createCart(): Container {
  const cart = new Container();
  cart.eventMode = 'none';
  cart.addChild(new Graphics().ellipse(0, 3, 13, 3).fill({ color: 0x11150f, alpha: .3 }));
  cart.addChild(new Graphics()
    .poly([-10, -8, 8, -8, 6, 0, -8, 0]).fill({ color: 0x76502d })
    .rect(-7, -12, 5, 4).fill({ color: 0xb28a4a })
    .rect(-1, -13, 6, 5).fill({ color: 0x94703b })
    .circle(-7, 1, 3.4).fill({ color: 0x2e241a }).circle(6, 1, 3.4).fill({ color: 0x2e241a })
    .circle(-7, 1, 1.2).fill({ color: 0x9b7a4c }).circle(6, 1, 1.2).fill({ color: 0x9b7a4c })
    .moveTo(8, -5).lineTo(15, -2).stroke({ color: 0x6d4b2c, width: 1.6 }));
  return cart;
}

function createAnimal(): Container {
  const animal = new Container();
  animal.eventMode = 'none';
  animal.addChild(new Graphics().ellipse(0, 2, 7, 2).fill({ color: 0x11140f, alpha: .25 }));
  animal.addChild(new Graphics()
    .ellipse(0, -5, 7, 4.5).fill({ color: 0xd2c2a1 })
    .circle(6, -8, 3.2).fill({ color: 0xbba783 })
    .poly([5, -11, 3, -15, 7, -12]).fill({ color: 0x8c7658 })
    .poly([8, -10, 10, -14, 10, -10]).fill({ color: 0x8c7658 })
    .moveTo(-4, -2).lineTo(-4, 3).moveTo(3, -2).lineTo(3, 3).stroke({ color: 0x5b4a37, width: 1.4 }));
  return animal;
}
