import { Assets, Container, Graphics, Sprite } from 'pixi.js';
import type { ArmyResponse, HeroKey } from '@crown-and-coin/shared';
import type { BuildingId } from '../domain/kingdom-types';
import type { BuildingSceneState } from './create-kingdom-scene';
import type { KingdomRaidReturnPresentation } from '@/features/raid/domain/raid-journey-presentation';
import { HERO_WORLD_ASSET } from '../../heroes/data/hero-world-assets';

export interface KingdomHeroPresence {
  key: HeroKey;
  level: number;
  worldAsset: string;
  x: number;
  y: number;
}

const HOME: Record<HeroKey, { buildingId: BuildingId; x: number; y: number }> = {
  KNIGHT: { buildingId: 'castle', x: 225, y: 752 },
  RANGER: { buildingId: 'lumberMill', x: 483, y: 1_045 },
  MAGE: { buildingId: 'academy', x: 456, y: 475 },
};
const RETURN_START_Y = 850;
const RETURN_HOME_Y = 720;

export function deriveKingdomHeroPresences(army: ArmyResponse | null, buildings: Partial<Record<BuildingId, BuildingSceneState>>): readonly KingdomHeroPresence[] {
  if (!army) return [];
  return army.formation.slots.flatMap((slot) => {
    const home = HOME[slot.commander.key];
    if (!home || buildings[home.buildingId]?.locked !== false) return [];
    return [{ key: slot.commander.key, level: slot.commander.level, worldAsset: HERO_WORLD_ASSET[slot.commander.key], x: home.x, y: home.y }];
  });
}

export interface HeroPresenceArtwork {
  container: Container;
  returnContainer: Container;
  setHeroes(heroes: readonly KingdomHeroPresence[]): void;
  playReturn(presentation: KingdomRaidReturnPresentation, reducedMotion: boolean, onComplete: () => void): void;
  update(deltaMs: number, elapsedSeconds: number): void;
  destroy(): void;
}

export function createHeroPresenceArtwork(): HeroPresenceArtwork {
  const container = new Container();
  const returnContainer = new Container();
  container.eventMode = 'none';
  returnContainer.eventMode = 'none';
  container.label = 'kingdom-heroes';
  returnContainer.label = 'raid-return-procession';
  let heroGeneration = 0;
  let returnGeneration = 0;
  let destroyed = false;
  let markers: Array<{ key: HeroKey; marker: Container; body: Sprite; glow: Graphics | null; baseX: number; baseY: number; bodyScaleY: number }> = [];
  let returnAnimation: { elapsedMs: number; durationMs: number; group: Container; outcome: 'VICTORY' | 'DEFEAT'; onComplete: () => void } | null = null;
  let reducedReturnTimer: ReturnType<typeof setTimeout> | null = null;

  const clear = (target: Container): void => { target.removeChildren().forEach((child) => child.destroy({ children: true })); };
  const cancelReturn = (): void => {
    if (reducedReturnTimer !== null) {
      clearTimeout(reducedReturnTimer);
      reducedReturnTimer = null;
    }
    returnAnimation = null;
    clear(returnContainer);
  };
  const finishReturn = (): void => {
    const complete = returnAnimation?.onComplete;
    cancelReturn();
    complete?.();
  };

  return {
    container,
    returnContainer,
    setHeroes: (heroes) => {
      const request = ++heroGeneration;
      void Promise.all(heroes.map(async (hero) => ({ hero, texture: await Assets.load(hero.worldAsset) }))).then((loaded) => {
        if (destroyed || request !== heroGeneration) return;
        clear(container);
        markers = loaded.map(({ hero, texture }) => {
          const figure = createHeroFigure(hero.key, texture, 62);
          figure.container.position.set(hero.x, hero.y);
          container.addChild(figure.container);
          return { key: hero.key, marker: figure.container, body: figure.body, glow: figure.glow, baseX: hero.x, baseY: hero.y, bodyScaleY: figure.body.scale.y };
        });
      });
    },
    playReturn: (presentation, reducedMotion, onComplete) => {
      const request = ++returnGeneration;
      cancelReturn();
      void Promise.all(presentation.commanders.map(async (commander) => ({ commander, texture: await Assets.load(HERO_WORLD_ASSET[commander.key]) })))
        .then((loaded) => {
          if (destroyed || request !== returnGeneration) return;
          clear(returnContainer);
          const group = new Container();
          group.eventMode = 'none';
          group.label = 'raid-return-force';
          loaded.slice(0, 3).forEach(({ commander, texture }, index) => {
            const figure = createHeroFigure(commander.key, texture, 54);
            figure.container.position.set((index - 1) * 31, index === 1 ? 2 : 0);
            figure.container.alpha = presentation.outcome === 'VICTORY' ? 1 : .68;
            group.addChild(figure.container);
          });
          if (presentation.outcome === 'VICTORY') group.addChild(createLootCart());
          group.position.set(405, reducedMotion ? RETURN_HOME_Y : RETURN_START_Y);
          returnContainer.addChild(group);
          returnAnimation = { elapsedMs: 0, durationMs: reducedMotion ? 450 : 1_300, group, outcome: presentation.outcome, onComplete };
          if (reducedMotion) {
            reducedReturnTimer = setTimeout(() => {
              if (!destroyed && request === returnGeneration) finishReturn();
            }, 180);
          }
        })
        .catch(() => {
          if (destroyed || request !== returnGeneration) return;
          cancelReturn();
          onComplete();
        });
    },
    update: (deltaMs, elapsedSeconds) => {
      for (const { key, marker, body, glow, baseX, baseY, bodyScaleY } of markers) {
        marker.y = baseY;
        if (key === 'KNIGHT') {
          marker.x = baseX;
          body.rotation = Math.sin(elapsedSeconds * .7) * .008;
          body.scale.y = bodyScaleY * (1 + Math.sin(elapsedSeconds * 1.1) * .004);
        } else if (key === 'RANGER') {
          const patrol = Math.sin(elapsedSeconds * .52);
          marker.x = baseX + patrol * 6;
          marker.scale.x = Math.cos(elapsedSeconds * .52) >= 0 ? 1 : -1;
          body.rotation = Math.sin(elapsedSeconds * .9) * .006;
        } else {
          marker.x = baseX;
          body.rotation = Math.sin(elapsedSeconds * .58) * .005;
          if (glow) glow.alpha = .18 + (Math.sin(elapsedSeconds * 1.35) + 1) * .09;
        }
      }
      if (!returnAnimation) return;
      // Asset/building work during a fresh Kingdom mount can produce a large first
      // ticker delta. Do not let that skip this short, presentation-only journey.
      returnAnimation.elapsedMs += Math.min(deltaMs, 50);
      const progress = Math.min(1, returnAnimation.elapsedMs / returnAnimation.durationMs);
      const eased = 1 - (1 - progress) ** 3;
      returnAnimation.group.y = RETURN_START_Y + (RETURN_HOME_Y - RETURN_START_Y) * eased;
      returnAnimation.group.alpha = progress < .78 ? 1 : Math.max(0, 1 - (progress - .78) / .22);
      if (progress >= 1) finishReturn();
    },
    destroy: () => {
      destroyed = true;
      heroGeneration += 1;
      returnGeneration += 1;
      cancelReturn();
      container.destroy({ children: true });
      returnContainer.destroy({ children: true });
    },
  };
}

function createHeroFigure(key: HeroKey, texture: Awaited<ReturnType<typeof Assets.load>>, height: number): { container: Container; body: Sprite; glow: Graphics | null } {
  const figure = new Container();
  figure.eventMode = 'none';
  figure.label = `hero-${key.toLowerCase()}`;
  const shadowWidth = key === 'RANGER' ? height * .22 : height * .18;
  const shadow = new Graphics().ellipse(0, 1, shadowWidth, height * .055).fill({ color: 0x0b100b, alpha: .4 });
  const body = new Sprite(texture);
  body.anchor.set(.5, 1);
  body.height = height;
  body.scale.x = body.scale.y;
  body.position.y = 1;
  const glow = key === 'MAGE'
    ? new Graphics().circle(height * .135, -height * .78, height * .07).fill({ color: 0x7769e8, alpha: .22 })
    : null;
  figure.addChild(shadow, body);
  if (glow) figure.addChild(glow);
  return { container: figure, body, glow };
}

function createLootCart(): Graphics {
  const cart = new Graphics().ellipse(67, -5, 16, 4).fill({ color: 0x10140e, alpha: .35 }).roundRect(55, -22, 25, 13, 3).fill({ color: 0x80552d }).rect(59, -28, 7, 7).fill({ color: 0xd6a83f })
    .rect(68, -29, 8, 8).fill({ color: 0x9b7435 }).circle(60, -7, 4).fill({ color: 0x2f2519 }).circle(75, -7, 4).fill({ color: 0x2f2519 });
  cart.label = 'raid-return-loot-cart';
  return cart;
}
