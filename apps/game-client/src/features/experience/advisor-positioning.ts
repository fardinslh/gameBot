export const ADVISOR_TARGET_GAP = 12;
export const MOBILE_NAV_HEIGHT = 54;

export interface Rect { left: number; top: number; right: number; bottom: number; width: number; height: number; }
export interface AdvisorViewport { width: number; height: number; offsetLeft?: number; offsetTop?: number; safeTop?: number; safeBottom?: number; reservedTop?: number; navHeight?: number; }
export interface AdvisorPlacement { left: number; top: number; side: 'above' | 'below' | 'left' | 'right' | 'fallback'; }

export function expandRect(rect: Rect, gap = ADVISOR_TARGET_GAP): Rect {
  return { left: rect.left - gap, top: rect.top - gap, right: rect.right + gap, bottom: rect.bottom + gap, width: rect.width + gap * 2, height: rect.height + gap * 2 };
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

export function calculateAdvisorPlacement(target: Rect, coach: { width: number; height: number }, viewport: AdvisorViewport): AdvisorPlacement {
  const pad = 8;
  const leftBound = (viewport.offsetLeft ?? 0) + pad;
  const safeTopBound = (viewport.offsetTop ?? 0) + (viewport.safeTop ?? 0) + pad;
  const topBound = Math.max(safeTopBound, viewport.reservedTop ?? safeTopBound);
  const rightBound = (viewport.offsetLeft ?? 0) + viewport.width - pad;
  const bottomBound = (viewport.offsetTop ?? 0) + viewport.height - (viewport.safeBottom ?? 0) - (viewport.navHeight ?? MOBILE_NAV_HEIGHT) - pad;
  const blocked = expandRect(target);
  const clampX = (value: number) => Math.max(leftBound, Math.min(value, rightBound - coach.width));
  const clampY = (value: number) => Math.max(topBound, Math.min(value, bottomBound - coach.height));
  const candidates: AdvisorPlacement[] = [
    { side: 'above', left: clampX(target.left + (target.width - coach.width) / 2), top: target.top - ADVISOR_TARGET_GAP - coach.height },
    { side: 'below', left: clampX(target.left + (target.width - coach.width) / 2), top: target.bottom + ADVISOR_TARGET_GAP },
    { side: 'left', left: target.left - ADVISOR_TARGET_GAP - coach.width, top: clampY(target.top + (target.height - coach.height) / 2) },
    { side: 'right', left: target.right + ADVISOR_TARGET_GAP, top: clampY(target.top + (target.height - coach.height) / 2) },
  ];
  for (const candidate of candidates) {
    const placed = { left: candidate.left, top: candidate.top, right: candidate.left + coach.width, bottom: candidate.top + coach.height, width: coach.width, height: coach.height };
    const inside = placed.left >= leftBound && placed.right <= rightBound && placed.top >= topBound && placed.bottom <= bottomBound;
    if (inside && !rectsOverlap(placed, blocked)) return candidate;
  }
  const aboveSpace = blocked.top - topBound;
  const top = aboveSpace >= coach.height ? blocked.top - coach.height : blocked.bottom;
  return { side: 'fallback', left: clampX(target.left + (target.width - coach.width) / 2), top: clampY(top) };
}

export function toRect(rect: DOMRect): Rect {
  return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
}
