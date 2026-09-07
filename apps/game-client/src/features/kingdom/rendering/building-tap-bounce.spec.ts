import { describe, expect, it } from 'vitest';
import { calculateSquashStretchScale } from './building-tap-bounce';

describe('calculateSquashStretchScale', () => {
  const baseScale = 0.85;

  it('returns exact base scale at start (progress = 0) and end (progress = 1)', () => {
    const start = calculateSquashStretchScale(0, baseScale);
    expect(start.scaleX).toBe(baseScale);
    expect(start.scaleY).toBe(baseScale);

    const end = calculateSquashStretchScale(1, baseScale);
    expect(end.scaleX).toBe(baseScale);
    expect(end.scaleY).toBe(baseScale);
  });

  it('clamps bounds for out-of-range progress (< 0 or > 1)', () => {
    const negative = calculateSquashStretchScale(-0.2, baseScale);
    expect(negative.scaleX).toBe(baseScale);
    expect(negative.scaleY).toBe(baseScale);

    const overflow = calculateSquashStretchScale(1.5, baseScale);
    expect(overflow.scaleX).toBe(baseScale);
    expect(overflow.scaleY).toBe(baseScale);
  });

  it('squashes wider and shorter during initial compression (progress ~0.15)', () => {
    const { scaleX, scaleY } = calculateSquashStretchScale(0.15, baseScale);
    expect(scaleX).toBeGreaterThan(baseScale);
    expect(scaleY).toBeLessThan(baseScale);
    expect(scaleX - baseScale).toBeCloseTo(baseScale - scaleY, 5);
  });

  it('rebounds taller and narrower during upward stretch (progress ~0.5)', () => {
    const { scaleX, scaleY } = calculateSquashStretchScale(0.5, baseScale);
    expect(scaleX).toBeLessThan(baseScale);
    expect(scaleY).toBeGreaterThan(baseScale);
    expect(baseScale - scaleX).toBeCloseTo(scaleY - baseScale, 5);
  });

  it('decays smoothly with exponential damping over time', () => {
    const peak1 = calculateSquashStretchScale(0.15, baseScale);
    const peak2 = calculateSquashStretchScale(0.5, baseScale);

    const amplitude1 = Math.abs(peak1.scaleX - baseScale);
    const amplitude2 = Math.abs(peak2.scaleX - baseScale);

    expect(amplitude2).toBeLessThan(amplitude1);
  });
});
