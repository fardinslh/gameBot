import { Container, Ellipse, Graphics, Sprite, Text } from 'pixi.js';
import type { Texture } from 'pixi.js';
import type { BuildingId } from '../domain/kingdom-types';
import { BUILDING_VISUALS, type BuildingVisualId, type PlacementEllipse } from './building-visuals';

export interface BuildingArtwork {
  container: Container;
  glowParts: Graphics[];
  rotators: Graphics[];
  selection: Graphics;
  smoke: Container | null;
  sprite: Sprite;
  wavingParts: Graphics[];
}

function drawEllipse(definition: PlacementEllipse, color: number, alpha: number, width = 2): Graphics {
  return new Graphics()
    .ellipse(definition.x, definition.y, definition.width * .5, definition.height * .5)
    .stroke({ color, alpha, width });
}

function createDebugOverlay(id: BuildingVisualId, sprite: Sprite): Container {
  const visuals = BUILDING_VISUALS[id];
  const overlay = new Container();
  overlay.eventMode = 'none';

  const boundsLeft = visuals.visualOffset.x - visuals.groundAnchor.x * sprite.width;
  const boundsTop = visuals.visualOffset.y - visuals.groundAnchor.y * sprite.height;
  const geometry = new Graphics()
    .rect(boundsLeft, boundsTop, sprite.width, sprite.height)
    .stroke({ color: 0x4bb8ff, alpha: .95, width: 2 })
    .circle(0, 0, 5)
    .fill({ color: 0xff3b30, alpha: .95 })
    .circle(visuals.visualOffset.x, visuals.visualOffset.y, 8)
    .stroke({ color: 0x47e56f, alpha: 1, width: 3 })
    .moveTo(visuals.indicatorAnchor.x - 5, visuals.indicatorAnchor.y)
    .lineTo(visuals.indicatorAnchor.x + 5, visuals.indicatorAnchor.y)
    .moveTo(visuals.indicatorAnchor.x, visuals.indicatorAnchor.y - 5)
    .lineTo(visuals.indicatorAnchor.x, visuals.indicatorAnchor.y + 5)
    .stroke({ color: 0xd66bff, alpha: 1, width: 2 });
  const footprint = drawEllipse(visuals.footprint, 0xff3b30, .95, 2);
  const hitArea = drawEllipse(visuals.hitArea, 0xffcc33, .9, 2);
  const label = new Text({
    text: id,
    style: { fill: 0xffffff, fontFamily: 'Arial', fontSize: 10, fontWeight: '700', stroke: { color: 0x111111, width: 3 } },
  });
  label.anchor.set(.5, 1);
  label.position.set(0, boundsTop - 4);
  overlay.addChild(footprint, hitArea, geometry, label);
  return overlay;
}

export function createSpriteBuildingArtwork(id: BuildingVisualId, texture: Texture, locked = false, debug = false): BuildingArtwork {
  const visuals = BUILDING_VISUALS[id];
  const container = new Container();
  const shadow = new Graphics()
    .ellipse(visuals.shadow.x, visuals.shadow.y, visuals.shadow.width * .5, visuals.shadow.height * .5)
    .fill({ color: 0x11130f, alpha: visuals.shadow.alpha });
  const sprite = new Sprite(texture);
  sprite.anchor.set(visuals.groundAnchor.x, visuals.groundAnchor.y);
  sprite.width = visuals.renderWidth;
  sprite.height = visuals.renderHeight ?? texture.height * (visuals.renderWidth / texture.width);
  sprite.position.copyFrom(visuals.visualOffset);
  sprite.alpha = locked ? .86 : 1;
  const selection = new Graphics()
    .ellipse(visuals.footprint.x, visuals.footprint.y, visuals.footprint.width * .5, visuals.footprint.height * .5)
    .fill({ color: 0xe2b447, alpha: .1 })
    .stroke({ color: 0xffd76c, alpha: .92, width: 3 });
  selection.visible = false;

  container.addChild(shadow, sprite, selection);
  if (debug) container.addChild(createDebugOverlay(id, sprite));
  container.hitArea = new Ellipse(
    visuals.hitArea.x,
    visuals.hitArea.y,
    visuals.hitArea.width * .5,
    visuals.hitArea.height * .5,
  );
  container.eventMode = 'static';
  container.cursor = 'pointer';
  return { container, glowParts: [], rotators: [], selection, smoke: null, sprite, wavingParts: [] };
}

export function createBuildingArtwork(id: BuildingId, texture: Texture, debug = false): BuildingArtwork {
  return createSpriteBuildingArtwork(id, texture, false, debug);
}
