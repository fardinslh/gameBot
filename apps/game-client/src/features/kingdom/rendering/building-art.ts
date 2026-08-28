import { Container, Ellipse, Graphics, Sprite, Text } from 'pixi.js';
import type { Texture } from 'pixi.js';
import type { BuildingId } from '../domain/kingdom-types';
import { BUILDING_VISUALS, type BuildingVisualId, type PlacementEllipse } from './building-visuals';
import type { BuildingVisualState, CoreEvolutionBuildingId } from './building-visual-progression';

export interface BuildingArtwork {
  construction: Container;
  container: Container;
  evolutionDetails: Container;
  glowParts: Graphics[];
  rotators: Graphics[];
  selection: Graphics;
  smoke: Container | null;
  sprite: Sprite;
  transformation: Container;
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
    .moveTo(visuals.upgradeIndicatorAnchor.x - 5, visuals.upgradeIndicatorAnchor.y)
    .lineTo(visuals.upgradeIndicatorAnchor.x + 5, visuals.upgradeIndicatorAnchor.y)
    .moveTo(visuals.upgradeIndicatorAnchor.x, visuals.upgradeIndicatorAnchor.y - 5)
    .lineTo(visuals.upgradeIndicatorAnchor.x, visuals.upgradeIndicatorAnchor.y + 5)
    .stroke({ color: 0xd66bff, alpha: 1, width: 2 });
  if (id === 'mine') {
    // Alpha analysis shows no meaningful transparent padding, so the cyan
    // visible-pixel bounds intentionally sit just inside the blue sprite bounds.
    geometry
      .rect(boundsLeft + 3, boundsTop + 3, sprite.width - 6, sprite.height - 6)
      .stroke({ color: 0x00f5d4, alpha: .95, width: 1.5 });
  }
  const footprint = drawEllipse(visuals.footprint, 0xff3b30, .95, 2);
  const shadow = drawEllipse(visuals.shadow, 0xff8c32, .95, 2);
  const hitArea = drawEllipse(visuals.hitArea, 0xffcc33, .9, 2);
  const label = new Text({
    text: id === 'mine'
      ? `${id}  anchor(${visuals.groundAnchor.x.toFixed(3)}, ${visuals.groundAnchor.y.toFixed(3)})`
      : id,
    style: { fill: 0xffffff, fontFamily: 'Arial', fontSize: 10, fontWeight: '700', stroke: { color: 0x111111, width: 3 } },
  });
  label.anchor.set(.5, 1);
  label.position.set(0, boundsTop - 4);
  overlay.addChild(footprint, shadow, hitArea, geometry, label);
  return overlay;
}

export function createSpriteBuildingArtwork(
  id: BuildingVisualId,
  texture: Texture,
  locked = false,
  debug = false,
  visualState?: BuildingVisualState,
  upgrading = false,
): BuildingArtwork {
  const visuals = BUILDING_VISUALS[id];
  const container = new Container();
  const shadow = new Graphics()
    .ellipse(visuals.shadow.x, visuals.shadow.y, visuals.shadow.width * .5, visuals.shadow.height * .5)
    .fill({ color: 0x11130f, alpha: visuals.shadow.alpha });
  const sprite = new Sprite(texture);
  sprite.anchor.set(visuals.groundAnchor.x, visuals.groundAnchor.y);
  sizeBuildingSprite(sprite, id, visualState);
  sprite.position.copyFrom(visuals.visualOffset);
  sprite.alpha = locked ? .86 : 1;
  const evolutionDetails = new Container();
  evolutionDetails.eventMode = 'none';
  const construction = new Container();
  construction.eventMode = 'none';
  const transformation = createTransformationEffect();
  transformation.visible = false;
  const selection = new Graphics()
    .ellipse(visuals.footprint.x, visuals.footprint.y, visuals.footprint.width * .5, visuals.footprint.height * .5)
    .fill({ color: 0xe2b447, alpha: .1 })
    .stroke({ color: 0xffd76c, alpha: .92, width: 3 });
  selection.visible = false;

  container.addChild(shadow, sprite, evolutionDetails, construction, transformation, selection);
  if (debug) container.addChild(createDebugOverlay(id, sprite));
  container.hitArea = new Ellipse(
    visuals.hitArea.x,
    visuals.hitArea.y,
    visuals.hitArea.width * .5,
    visuals.hitArea.height * .5,
  );
  container.eventMode = 'static';
  container.cursor = 'pointer';
  const artwork = {
    construction,
    container,
    evolutionDetails,
    glowParts: [],
    rotators: [],
    selection,
    smoke: null,
    sprite,
    transformation,
    wavingParts: [],
  };
  if (visualState) applyBuildingVisualState(artwork, id as CoreEvolutionBuildingId, visualState, upgrading);
  return artwork;
}

export function createBuildingArtwork(
  id: BuildingId,
  texture: Texture,
  debug = false,
  visualState?: BuildingVisualState,
  upgrading = false,
): BuildingArtwork {
  return createSpriteBuildingArtwork(id, texture, false, debug, visualState, upgrading);
}

export function applyBuildingVisualState(
  artwork: BuildingArtwork,
  id: CoreEvolutionBuildingId,
  state: BuildingVisualState,
  upgrading: boolean,
): void {
  sizeBuildingSprite(artwork.sprite, id, state);
  replaceChildren(artwork.evolutionDetails, createEvolutionDetails(id, state));
  replaceChildren(artwork.construction, upgrading ? createConstructionDetails(id) : null);
}

function sizeBuildingSprite(sprite: Sprite, id: BuildingVisualId, state?: BuildingVisualState): void {
  const visuals = BUILDING_VISUALS[id];
  const width = state?.renderWidth ?? visuals.renderWidth;
  sprite.width = width;
  sprite.height = state ? sprite.texture.height * (width / sprite.texture.width) : visuals.renderHeight ?? sprite.texture.height * (width / sprite.texture.width);
}

function replaceChildren(container: Container, next: Container | null): void {
  container.removeChildren().forEach((child) => child.destroy({ children: true }));
  if (next) container.addChild(next);
}

function createEvolutionDetails(id: CoreEvolutionBuildingId, state: BuildingVisualState): Container {
  const container = new Container();
  container.eventMode = 'none';
  const count = state.detailIds.length - (state.capstone ? 1 : 0);
  if (count >= 1) container.addChild(createPrimaryProp(id, state.tierNumber));
  if (count >= 2) container.addChild(createSecondaryProp(id, state.tierNumber));
  if (count >= 3) container.addChild(createTertiaryProp(id, state.tierNumber));
  if (state.capstone) container.addChild(createCapstoneProp(id));
  return container;
}

function createPrimaryProp(id: CoreEvolutionBuildingId, tier: number): Graphics {
  const color = id === 'mine' ? 0x76706a : id === 'grandMarket' ? 0xb24632 : 0x9a6a33;
  const prop = new Graphics();
  if (id === 'castle') {
    prop.circle(-54, -12, 2.5).fill({ color: 0xffc55c, alpha: .9 }).circle(54, -12, 2.5).fill({ color: 0xffc55c, alpha: .9 });
  } else if (id === 'farm') {
    prop.roundRect(-61, -9, 13 + tier, 7, 2).fill({ color: 0xc5963f, alpha: .96 }).stroke({ color: 0x715025, width: 1 });
    prop.moveTo(-59, -6).lineTo(-47 + tier, -6).stroke({ color: 0xe0bd68, alpha: .72, width: 1 });
  } else if (id === 'lumberMill') {
    for (let index = 0; index < 3; index += 1) prop.roundRect(-62, -7 - index * 3, 18, 3, 1).fill({ color: 0x76502d, alpha: .98 });
  } else if (id === 'mine') {
    prop.roundRect(-62, -11, 19, 10, 2).fill({ color: 0x453c34, alpha: .98 }).stroke({ color: 0x8c765c, width: 1 });
    prop.circle(-58, 0, 2.5).fill({ color: 0x1e2325 }).circle(-47, 0, 2.5).fill({ color: 0x1e2325 });
  } else {
    prop.roundRect(-64, -10, 15, 9, 2).fill({ color, alpha: .96 }).stroke({ color: 0xd4a45c, width: .8 });
    prop.roundRect(-47, -8, 10, 7, 1.5).fill({ color: 0x7c5431, alpha: .96 });
  }
  return prop;
}

function createSecondaryProp(id: CoreEvolutionBuildingId, tier: number): Graphics {
  const bannerColor = id === 'grandMarket' ? 0x9c3328 : 0x21476d;
  const prop = new Graphics();
  if (id === 'farm') {
    prop.moveTo(43, 1).lineTo(67, -5).moveTo(44, -3).lineTo(66, -9).stroke({ color: 0x79552c, width: 1.4 });
    for (let x = 44; x <= 66; x += 8) prop.moveTo(x, 2).lineTo(x, -11).stroke({ color: 0x8d6333, width: 1.4 });
  } else if (id === 'lumberMill') {
    prop.circle(57, -8, 7).stroke({ color: 0x92693b, width: 1.8 }).moveTo(57, -15).lineTo(57, -1).moveTo(50, -8).lineTo(64, -8).stroke({ color: 0x6f4c29, width: 1.2 });
  } else if (id === 'mine') {
    prop.circle(55, -12, 2.5).fill({ color: 0xffb94b, alpha: .9 }).circle(55, -12, 5 + tier * .35).stroke({ color: 0xd38934, alpha: .22, width: 1 });
  } else {
    prop.moveTo(61, -11).lineTo(61, -40).stroke({ color: 0x7e5a2a, width: 1.8 });
    prop.moveTo(62, -39).lineTo(74, -35).lineTo(62, -28).closePath().fill({ color: bannerColor, alpha: .96 }).stroke({ color: 0xd5aa4e, width: .8 });
  }
  return prop;
}

function createTertiaryProp(id: CoreEvolutionBuildingId, tier: number): Graphics {
  const prop = new Graphics();
  const gold = 0xe0b64e;
  if (id === 'castle') {
    prop.moveTo(-70, -3).lineTo(-70, -35).moveTo(70, -3).lineTo(70, -35).stroke({ color: 0x80602c, width: 1.8 });
    prop.moveTo(-69, -34).lineTo(-57, -30).lineTo(-69, -23).closePath().fill({ color: 0x234c78 }).moveTo(69, -34).lineTo(57, -30).lineTo(69, -23).closePath().fill({ color: 0x234c78 });
  } else if (id === 'farm') {
    prop.roundRect(45, -10, 20, 8, 2).fill({ color: 0x78502c }).circle(49, 0, 3).stroke({ color: 0x39291c, width: 1.2 }).circle(61, 0, 3).stroke({ color: 0x39291c, width: 1.2 });
  } else if (id === 'lumberMill') {
    prop.moveTo(47, -1).lineTo(66, -17).lineTo(69, -16).lineTo(51, 1).stroke({ color: 0x79522e, width: 2.5 });
    prop.circle(68, -18, 3 + tier * .25).stroke({ color: 0xaaa29a, width: 1.2 });
  } else if (id === 'mine') {
    for (let index = 0; index < 4; index += 1) prop.circle(-9 + index * 6, -2 - (index % 2) * 3, 3).fill({ color: index === 3 ? gold : 0x6c665f, alpha: .95 });
  } else {
    for (const x of [-58, 58]) prop.circle(x, -10, 2.5).fill({ color: 0xffbd55 }).circle(x, -10, 5).stroke({ color: gold, alpha: .2, width: 1 });
  }
  return prop;
}

function createCapstoneProp(id: CoreEvolutionBuildingId): Graphics {
  const prop = new Graphics();
  const y = id === 'castle' ? -194 : id === 'mine' ? -160 : -150;
  prop.circle(0, y, 8).fill({ color: 0xf5c95d, alpha: .1 }).stroke({ color: 0xffdc76, alpha: .58, width: 1 });
  prop.moveTo(-4, y + 2).lineTo(-5, y - 4).lineTo(-2, y - 1).lineTo(0, y - 6).lineTo(2, y - 1).lineTo(5, y - 4).lineTo(4, y + 2).closePath().fill({ color: 0xf2c758, alpha: .95 });
  return prop;
}

function createConstructionDetails(id: CoreEvolutionBuildingId): Container {
  const container = new Container();
  const top = id === 'castle' ? -105 : id === 'mine' ? -74 : -66;
  const scaffold = new Graphics()
    .moveTo(36, 0).lineTo(36, top).moveTo(72, 0).lineTo(72, top + 13)
    .moveTo(32, top + 14).lineTo(76, top + 26).moveTo(34, top + 40).lineTo(74, top + 49)
    .stroke({ color: 0x9a7040, alpha: .88, width: 3 })
    .moveTo(35, -3).lineTo(74, -3).stroke({ color: 0x6b4828, alpha: .95, width: 5 });
  const supplies = new Graphics()
    .roundRect(-66, -12, 27, 12, 3).fill({ color: 0x735032, alpha: .96 })
    .roundRect(-37, -9, 18, 9, 2).fill({ color: 0x9b7442, alpha: .96 });
  container.addChild(scaffold, supplies);
  return container;
}

function createTransformationEffect(): Container {
  const container = new Container();
  container.eventMode = 'none';
  container.addChild(new Graphics()
    .ellipse(0, -22, 92, 48)
    .fill({ color: 0xf4cc6b, alpha: .22 })
    .stroke({ color: 0xffe38a, alpha: .75, width: 3 }));
  const dust = new Graphics();
  for (let index = 0; index < 7; index += 1) {
    dust.circle(-54 + index * 18, -8 - (index % 3) * 9, 6 + (index % 2) * 3).fill({ color: 0xc9ac77, alpha: .36 });
  }
  container.addChild(dust);
  return container;
}
