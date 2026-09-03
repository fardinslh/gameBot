import { describe, expect, it } from 'vitest';
import { Rectangle, Texture } from 'pixi.js';
import { createAtlasRowFrames } from './sprite-atlas';

describe('sprite atlas frames', () => {
  it('slices one requested row into equal animation frames', () => {
    const texture = new Texture({ source: Texture.WHITE.source, frame: new Rectangle(4, 6, 60, 90) });
    const frames = createAtlasRowFrames(texture, 1, 3);
    expect(frames.map(({ frame }) => [frame.x, frame.y, frame.width, frame.height])).toEqual([
      [4, 36, 30, 30],
      [34, 36, 30, 30],
    ]);
  });

  it('rejects rows outside the declared grid', () => {
    expect(() => createAtlasRowFrames(Texture.WHITE, 3, 3)).toThrow(RangeError);
  });
});
