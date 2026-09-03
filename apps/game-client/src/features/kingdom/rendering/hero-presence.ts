import { AnimatedSprite, Assets, Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { ArmyResponse, HeroKey } from '@crown-and-coin/shared';
import type { BuildingId } from '../domain/kingdom-types';
import type { BuildingSceneState } from './create-kingdom-scene';
import type { KingdomRaidReturnPresentation } from '@/features/raid/domain/raid-journey-presentation';
import { HERO_WORLD_ANIMATION, HERO_WORLD_ASSET, HERO_WORLD_ATLAS, HERO_WORLD_ATLAS_ROW } from '../../heroes/data/hero-world-assets';
import { createAtlasRowFrames } from './sprite-atlas';
import { createCharacterSprite, setCharacterAnimation, updateCharacterSprite } from './character-animation';

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
const CART_STRIP = '/assets/kingdom/characters/ambient/cart-strip-v1.webp';

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
  let markers: Array<{ key: HeroKey; marker: Container; body: AnimatedSprite; frames: readonly Texture[]; glow: Graphics | null; baseX: number; baseY: number }> = [];
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
      void Assets.load<Texture>(HERO_WORLD_ATLAS).then((atlas) => {
        if (destroyed || request !== heroGeneration) return;
        clear(container);
        markers = heroes.map((hero) => {
          const frames = createAtlasRowFrames(atlas, HERO_WORLD_ATLAS_ROW[hero.key], 3);
          const figure = createHeroFigure(hero.key, frames, 58);
          const animation = hero.key === 'MAGE' ? HERO_WORLD_ANIMATION.MAGE.magicIdle : HERO_WORLD_ANIMATION[hero.key].idle;
          setCharacterAnimation(figure.body, { name: hero.key === 'MAGE' ? 'magic-idle' : 'idle', frames, ...animation });
          figure.container.position.set(hero.x, hero.y);
          container.addChild(figure.container);
          return { key: hero.key, marker: figure.container, body: figure.body, frames, glow: figure.glow, baseX: hero.x, baseY: hero.y };
        });
      });
    },
    playReturn: (presentation, reducedMotion, onComplete) => {
      const request = ++returnGeneration;
      cancelReturn();
      void Promise.all([Assets.load<Texture>(HERO_WORLD_ATLAS), Assets.load<Texture>(CART_STRIP)])
        .then(([atlas, cart]) => {
          if (destroyed || request !== returnGeneration) return;
          clear(returnContainer);
          const group = new Container();
          group.eventMode = 'none';
          group.label = 'raid-return-force';
          presentation.commanders.slice(0, 3).forEach((commander, index) => {
            const frames = createAtlasRowFrames(atlas, HERO_WORLD_ATLAS_ROW[commander.key], 3);
            const figure = createHeroFigure(commander.key, frames, 52);
            const animation = commander.key === 'MAGE' ? HERO_WORLD_ANIMATION.MAGE.magicIdle : HERO_WORLD_ANIMATION[commander.key].walk;
            setCharacterAnimation(figure.body, { name: commander.key === 'MAGE' ? 'magic-idle' : 'walk', frames, ...animation });
            figure.container.position.set((index - 1) * 31, index === 1 ? 2 : 0);
            figure.container.alpha = presentation.outcome === 'VICTORY' ? 1 : .68;
            group.addChild(figure.container);
          });
          if (presentation.outcome === 'VICTORY') group.addChild(createLootCart(cart));
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
      for (const { key, marker, body, glow, baseX, baseY } of markers) {
        marker.y = baseY;
        updateCharacterSprite(body, Math.min(deltaMs, 50) / 1_000);
        if (key === 'KNIGHT') {
          marker.x = baseX;
          body.rotation = Math.sin(elapsedSeconds * .7) * .004;
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

function createHeroFigure(key: HeroKey, frames: readonly Texture[], height: number): { container: Container; body: AnimatedSprite; glow: Graphics | null } {
  const figure = new Container();
  figure.eventMode = 'none';
  figure.label = `hero-${key.toLowerCase()}`;
  const shadowWidth = key === 'RANGER' ? height * .22 : height * .18;
  const shadow = new Graphics().ellipse(0, 1, shadowWidth, height * .055).fill({ color: 0x0b100b, alpha: .4 });
  const body = createCharacterSprite({ name: 'idle', fps: 2, frames, loop: true });
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

function createLootCart(texture: Texture): Container {
  const cart = new Container();
  cart.eventMode = 'none';
  cart.label = 'raid-return-loot-cart';
  const shadow = new Graphics().ellipse(67, -4, 15, 3).fill({ color: 0x10140e, alpha: .3 });
  const body = new Sprite(createAtlasRowFrames(texture, 0, 1)[0]);
  body.anchor.set(.5, 1);
  body.height = 27;
  body.scale.x = body.scale.y;
  body.position.set(67, -3);
  cart.addChild(shadow, body);
  return cart;
}
