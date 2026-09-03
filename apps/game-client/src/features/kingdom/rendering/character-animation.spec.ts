import { describe, expect, it } from 'vitest';
import { AnimatedSprite, Texture } from 'pixi.js';
import { createCharacterSprite, setCharacterAnimation, updateCharacterSprite } from './character-animation';

describe('character animation', () => {
  it('creates a manually-driven Pixi AnimatedSprite with named frame animation', () => {
    const sprite = createCharacterSprite({ name: 'walk', fps: 6, frames: [Texture.WHITE, Texture.EMPTY], loop: true });
    expect(sprite).toBeInstanceOf(AnimatedSprite);
    expect(sprite.autoUpdate).toBe(false);
    expect(sprite.label).toBe('animation-walk');
    expect(sprite.textures).toHaveLength(2);
    updateCharacterSprite(sprite, .2);
    expect(sprite.currentFrame).toBe(1);
  });

  it('freezes a reduced-motion animation on its first frame', () => {
    const sprite = createCharacterSprite({ name: 'idle', fps: 2, frames: [Texture.WHITE, Texture.EMPTY], loop: true });
    setCharacterAnimation(sprite, { name: 'magic-idle', fps: 4, frames: [Texture.EMPTY, Texture.WHITE], loop: true }, true);
    expect(sprite.label).toBe('animation-magic-idle');
    expect(sprite.playing).toBe(false);
    expect(sprite.currentFrame).toBe(0);
  });
});
