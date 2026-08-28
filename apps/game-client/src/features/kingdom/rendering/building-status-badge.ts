import { Container, Graphics, Text } from 'pixi.js';

export const BUILDING_STATUS_BADGE = Object.freeze({
  height: 22,
  width: 42,
  radius: 8,
  fontSize: 11,
});

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

export function createBuildingStatusBadge(level: number, resolution = 1): Container {
  const badge = new Container();
  badge.eventMode = 'none';
  badge.label = 'building-level-badge';
  drawBuildingStatusBadge(badge, level, resolution);
  return badge;
}

export function drawBuildingStatusBadge(badge: Container, level: number, resolution = 1): void {
  badge.removeChildren().forEach((child) => child.destroy());
  const { height, width, radius, fontSize } = BUILDING_STATUS_BADGE;
  const background = new Graphics()
    .roundRect(-width / 2, -height / 2, width, height, radius)
    .fill({ color: 0x17140f, alpha: .96 })
    .stroke({ color: 0xe2b447, alpha: .96, width: 1 });
  const text = new Text({
    text: `Lv. ${level}`,
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
