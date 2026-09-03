import { describe, expect, it } from 'vitest';
import { currentRendererResolution, MAX_RENDERER_RESOLUTION } from './pixi-runtime';

describe('Pixi runtime resolution', () => {
  it.each([[.8, 1], [1, 1], [1.25, 1.25], [1.5, 1.5], [2, 2], [3, 2]])('maps DPR %s to resolution %s', (dpr, expected) => {
    expect(currentRendererResolution(dpr)).toBe(expected);
  });

  it('keeps the explicit mobile framebuffer cap', () => {
    expect(MAX_RENDERER_RESOLUTION).toBe(2);
  });
});
