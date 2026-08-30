import { Container, Graphics, Text } from 'pixi.js';
import type { Locale } from '@/i18n/config';
import { localizeDigits } from '@/i18n/numbers';

export const BUILDING_STATUS_BADGE = Object.freeze({
  height: 22,
  width: 42,
  radius: 8,
  fontSize: 11,
});

export const BUILDING_UPGRADE_INDICATOR = Object.freeze({
  height: 20,
  width: 20,
  radius: 7,
  gap: 6,
});

export type BuildingStatusIndicator = 'upgrade' | 'active' | null;

interface PointLike {
  x: number;
  y: number;
}

interface BuildingStatusPositionInput {
  anchor: PointLike;
  buildingPosition: PointLike;
  buildingScale: number;
  resolution: number;
  worldPosition: PointLike;
  worldScale: number;
}

interface BuildingStatusLayoutInput extends Omit<BuildingStatusPositionInput, 'anchor'> {
  statusStackAnchor: PointLike;
}

export interface BuildingStatusLayout {
  levelBadge: PointLike;
  upgradeIndicator: PointLike;
}

export function createBuildingStatusBadge(level: number, resolution = 1, locale: Locale = 'en'): Container {
  const badge = new Container();
  badge.eventMode = 'none';
  badge.label = 'building-level-badge';
  drawBuildingStatusBadge(badge, level, resolution, locale);
  return badge;
}

export function drawBuildingStatusBadge(badge: Container, level: number, resolution = 1, locale: Locale = 'en'): void {
  badge.removeChildren().forEach((child) => child.destroy());
  const { height, width, radius, fontSize } = BUILDING_STATUS_BADGE;
  const background = new Graphics()
    .roundRect(-width / 2, -height / 2, width, height, radius)
    .fill({ color: 0x17140f, alpha: .96 })
    .stroke({ color: 0xe2b447, alpha: .96, width: 1 });
  const text = new Text({
    text: `Lv. ${localizeDigits(level, locale)}`,
    resolution: Math.max(1, resolution),
    style: {
      fill: 0xffe7a1,
      fontFamily: 'Inter, "Segoe UI", Tahoma, Arial, sans-serif',
      fontSize,
      fontWeight: '800',
      letterSpacing: -.15,
    },
  });
  text.anchor.set(.5);
  badge.addChild(background, text);
}

export function createBuildingUpgradeIndicator(state: BuildingStatusIndicator): Graphics {
  const indicator = new Graphics();
  indicator.eventMode = 'none';
  indicator.label = 'building-upgrade-indicator';
  drawBuildingUpgradeIndicator(indicator, state);
  return indicator;
}

export function drawBuildingUpgradeIndicator(indicator: Graphics, state: BuildingStatusIndicator): void {
  indicator.clear();
  indicator.visible = state !== null;
  if (!state) return;
  const { height, width, radius } = BUILDING_UPGRADE_INDICATOR;
  const color = state === 'active' ? 0xe2b447 : 0x8ecb68;
  indicator
    .roundRect(-width / 2, -height / 2, width, height, radius)
    .fill({ color: 0x17140f, alpha: .94 })
    .stroke({ color, width: 1.5 });
  if (state === 'upgrade') {
    indicator.moveTo(0, 6).lineTo(0, -4).moveTo(-4, 0).lineTo(0, -5).lineTo(4, 0).stroke({ color, width: 2.5 });
  } else {
    indicator.circle(0, 0, 6).stroke({ color, width: 1.5 });
    indicator.moveTo(0, 0).lineTo(0, -3.5).moveTo(0, 0).lineTo(3.5, 2).stroke({ color, width: 1.5 });
  }
}

export function calculateBuildingStatusPosition({
  anchor,
  buildingPosition,
  buildingScale,
  resolution,
  worldPosition,
  worldScale,
}: BuildingStatusPositionInput): PointLike {
  const safeResolution = Math.max(1, resolution);
  const snap = (value: number): number => Math.round(value * safeResolution) / safeResolution;
  return {
    x: snap(worldPosition.x + (buildingPosition.x + anchor.x * buildingScale) * worldScale),
    y: snap(worldPosition.y + (buildingPosition.y + anchor.y * buildingScale) * worldScale),
  };
}

export function calculateBuildingStatusLayout({
  statusStackAnchor,
  ...transform
}: BuildingStatusLayoutInput): BuildingStatusLayout {
  const levelBadge = calculateBuildingStatusPosition({ anchor: statusStackAnchor, ...transform });
  const indicator = {
    x: levelBadge.x,
    y: snapToResolution(
      levelBadge.y - BUILDING_STATUS_BADGE.height / 2
        - BUILDING_UPGRADE_INDICATOR.gap
        - BUILDING_UPGRADE_INDICATOR.height / 2,
      transform.resolution,
    ),
  };
  return { levelBadge, upgradeIndicator: indicator };
}

export function statusElementsOverlap(levelBadge: PointLike, indicator: PointLike, gap = 0): boolean {
  return Math.abs(levelBadge.x - indicator.x)
      < (BUILDING_STATUS_BADGE.width + BUILDING_UPGRADE_INDICATOR.width) / 2 + gap
    && Math.abs(levelBadge.y - indicator.y)
      < (BUILDING_STATUS_BADGE.height + BUILDING_UPGRADE_INDICATOR.height) / 2 + gap;
}

function snapToResolution(value: number, resolution: number): number {
  const safeResolution = Math.max(1, resolution);
  return Math.round(value * safeResolution) / safeResolution;
}
