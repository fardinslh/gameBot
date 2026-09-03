import { AnimatedSprite, Texture } from 'pixi.js';

export interface CharacterAnimation {
  name: string;
  fps: number;
  frames: readonly Texture[];
  loop: boolean;
}

export function createCharacterSprite(animation: CharacterAnimation): AnimatedSprite {
  const sprite = new AnimatedSprite({ textures: [...animation.frames], autoUpdate: false });
  sprite.label = `animation-${animation.name}`;
  sprite.animationSpeed = animation.fps / 60;
  sprite.loop = animation.loop;
  sprite.anchor.set(.5, 1);
  sprite.play();
  return sprite;
}

export function updateCharacterSprite(sprite: AnimatedSprite, deltaSeconds: number): void {
  sprite.update({ deltaTime: deltaSeconds * 60, deltaMS: deltaSeconds * 1_000, elapsedMS: deltaSeconds * 1_000, lastTime: 0, speed: 1 } as Parameters<AnimatedSprite['update']>[0]);
}

export function setCharacterAnimation(sprite: AnimatedSprite, animation: CharacterAnimation, reducedMotion = false): void {
  sprite.textures = [...animation.frames];
  sprite.label = `animation-${animation.name}`;
  sprite.animationSpeed = animation.fps / 60;
  sprite.loop = animation.loop;
  if (reducedMotion) sprite.gotoAndStop(0);
  else sprite.play();
}
