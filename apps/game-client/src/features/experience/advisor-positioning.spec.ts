import { describe, expect, it } from 'vitest';
import { calculateAdvisorPlacement, expandRect, rectsOverlap, type Rect } from './advisor-positioning';

const coach = { width: 300, height: 98 };
function target(left: number, top: number, width = 120, height = 44): Rect { return { left, top, right: left + width, bottom: top + height, width, height }; }
function placed(left: number, top: number): Rect { return { left, top, right: left + coach.width, bottom: top + coach.height, width: coach.width, height: coach.height }; }

describe.each([{ width: 320, height: 568 }, { width: 375, height: 812 }, { width: 390, height: 844 }])('advisor placement at $width×$height', (viewport) => {
  it.each([
    ['top', target((viewport.width - 120) / 2, 118)], ['middle', target((viewport.width - 120) / 2, viewport.height / 2)],
    ['bottom CTA', target(10, viewport.height - 118, viewport.width - 20)], ['left edge', target(2, 280, 70)], ['right edge', target(viewport.width - 72, 280, 70)],
  ])('keeps the whole coach clear of a %s target', (_name, targetRect) => {
    const result = calculateAdvisorPlacement(targetRect, coach, viewport);
    expect(rectsOverlap(placed(result.left, result.top), expandRect(targetRect))).toBe(false);
    expect(result.left).toBeGreaterThanOrEqual(8); expect(result.left + coach.width).toBeLessThanOrEqual(viewport.width - 8);
  });
});

it('places the owner-reported bottom-sheet upgrade case above its full CTA', () => {
  const upgrade = target(20, 494, 280, 46); const result = calculateAdvisorPlacement(upgrade, coach, { width: 320, height: 568 });
  expect(result.side).toBe('above'); expect(result.top + coach.height).toBeLessThanOrEqual(upgrade.top - 12);
});
