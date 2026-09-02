import { Assets, Container, Graphics, Sprite } from 'pixi.js';
import type { ArmyResponse, HeroKey } from '@crown-and-coin/shared';
import type { BuildingId } from '../domain/kingdom-types';
import type { BuildingSceneState } from './create-kingdom-scene';
import type { KingdomRaidReturnPresentation } from '@/features/raid/domain/raid-journey-presentation';

export interface KingdomHeroPresence {
  key: HeroKey;
  level: number;
  portraitAsset: string;
  x: number;
  y: number;
}

const HOME: Record<HeroKey, { buildingId: BuildingId; x: number; y: number }> = {
  KNIGHT: { buildingId: 'castle', x: 225, y: 752 },
  RANGER: { buildingId: 'lumberMill', x: 483, y: 1_045 },
  MAGE: { buildingId: 'academy', x: 456, y: 475 },
};

export function deriveKingdomHeroPresences(army: ArmyResponse | null, buildings: Partial<Record<BuildingId, BuildingSceneState>>): readonly KingdomHeroPresence[] {
  if (!army) return [];
  return army.formation.slots.flatMap((slot) => {
    const home = HOME[slot.commander.key];
    if (!home || buildings[home.buildingId]?.locked !== false) return [];
    return [{ key: slot.commander.key, level: slot.commander.level, portraitAsset: slot.commander.portraitAsset, x: home.x, y: home.y }];
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
  let markers: Array<{ key: HeroKey; marker: Container; baseY: number }> = [];
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
      void Promise.all(heroes.map(async (hero) => ({ hero, texture: await Assets.load(hero.portraitAsset) }))).then((loaded) => {
        if (destroyed || request !== heroGeneration) return;
        clear(container);
        markers = loaded.map(({ hero, texture }) => {
          const marker = createHeroMarker(hero.key, texture, 42);
          marker.position.set(hero.x, hero.y);
          container.addChild(marker);
          return { key: hero.key, marker, baseY: hero.y };
        });
      });
    },
    playReturn: (presentation, reducedMotion, onComplete) => {
      const request = ++returnGeneration;
      cancelReturn();
      void Promise.all(presentation.commanders.map(async (commander) => ({ commander, texture: await Assets.load(commander.portraitAsset) })))
        .then((loaded) => {
          if (destroyed || request !== returnGeneration) return;
          clear(returnContainer);
          const group = new Container();
          group.eventMode = 'none';
          loaded.slice(0, 3).forEach(({ commander, texture }, index) => {
            const marker = createHeroMarker(commander.key, texture, 34);
            marker.position.set((index - 1) * 42, 0);
            marker.alpha = presentation.outcome === 'VICTORY' ? 1 : .72;
            group.addChild(marker);
          });
          if (presentation.outcome === 'VICTORY') group.addChild(createLootCart());
          group.position.set(320, reducedMotion ? 815 : 1_080);
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
      for (const { key, marker, baseY } of markers) {
        marker.y = baseY + Math.sin(elapsedSeconds * (key === 'RANGER' ? 1.4 : 1.1) + key.length) * .9;
        if (key === 'MAGE') marker.alpha = .9 + Math.sin(elapsedSeconds * 1.8) * .1;
      }
      if (!returnAnimation) return;
      returnAnimation.elapsedMs += deltaMs;
      const progress = Math.min(1, returnAnimation.elapsedMs / returnAnimation.durationMs);
      const eased = 1 - (1 - progress) ** 3;
      returnAnimation.group.y = 1_080 + (815 - 1_080) * eased;
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

function createHeroMarker(key: HeroKey, texture: Awaited<ReturnType<typeof Assets.load>>, size: number): Container {
  const marker = new Container();
  marker.eventMode = 'none';
  marker.label = `hero-${key.toLowerCase()}`;
  const centerY = -size * .55;
  const shadow = new Graphics().ellipse(0, 0, size * .43, size * .13).fill({ color: 0x10140e, alpha: .42 });
  const mask = new Graphics().circle(0, centerY, size * .5).fill(0xffffff);
  const portrait = new Sprite(texture);
  portrait.anchor.set(.5);
  portrait.position.set(0, centerY);
  portrait.width = size;
  portrait.height = size;
  portrait.mask = mask;
  const color = key === 'KNIGHT' ? 0xc84d3d : key === 'RANGER' ? 0x5f9b4c : 0x7565c7;
  const frame = new Graphics().circle(0, centerY, size * .52).stroke({ color: 0xe0bd68, width: 2, alpha: .94 }).circle(size * .35, centerY + size * .36, size * .13).fill({ color }).stroke({ color: 0xf4d98d, width: 1 });
  marker.addChild(shadow, portrait, mask, frame);
  return marker;
}

function createLootCart(): Graphics {
  return new Graphics().roundRect(55, -22, 25, 13, 3).fill({ color: 0x80552d }).rect(59, -28, 7, 7).fill({ color: 0xd6a83f })
    .rect(68, -29, 8, 8).fill({ color: 0x9b7435 }).circle(60, -7, 4).fill({ color: 0x2f2519 }).circle(75, -7, 4).fill({ color: 0x2f2519 });
}
