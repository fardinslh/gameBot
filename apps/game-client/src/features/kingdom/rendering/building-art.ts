import { Container, Ellipse, Graphics, Sprite } from 'pixi.js';
import type { Texture } from 'pixi.js';
import type { BuildingId } from '../domain/kingdom-types';

export interface BuildingArtwork {
  container: Container;
  glowParts: Graphics[];
  rotators: Graphics[];
  selection: Graphics;
  smoke: Container | null;
  wavingParts: Graphics[];
}

const COLORS = {
  outline: 0x2b2118,
  shadow: 0x12130f,
  stone: 0x9b927f,
  stoneLight: 0xc6bda7,
  stoneDark: 0x655f55,
  timber: 0x6b3d22,
  timberLight: 0x9b6234,
  roof: 0x6f231b,
  roofLight: 0xa44329,
  gold: 0xe2b447,
  window: 0xffcf61,
  crop: 0xb88c32,
  cropLight: 0xd9b64e,
  canvasRed: 0x8d3027,
  canvasBlue: 0x315c6a,
  grass: 0x496332,
};

function baseArtwork(hitWidth = 150, hitHeight = 115): BuildingArtwork {
  const container = new Container();
  const selection = new Graphics()
    .ellipse(0, 11, hitWidth * 0.47, hitHeight * 0.3)
    .fill({ color: COLORS.gold, alpha: 0.1 })
    .stroke({ color: 0xffd76c, alpha: 0.95, width: 3 });
  selection.visible = false;
  container.addChild(selection);
  container.hitArea = new Ellipse(0, -20, hitWidth / 2, hitHeight / 2);
  container.eventMode = 'static';
  container.cursor = 'pointer';
  return { container, glowParts: [], rotators: [], selection, smoke: null, wavingParts: [] };
}

function addShadow(target: Container, width: number, y = 16): void {
  target.addChild(new Graphics().ellipse(0, y, width, 18).fill({ color: COLORS.shadow, alpha: 0.42 }));
}

function addWindow(target: Container, x: number, y: number, width = 9, height = 13): Graphics {
  const window = new Graphics()
    .roundRect(x, y, width, height, 2)
    .fill(COLORS.window)
    .stroke({ color: COLORS.outline, width: 2 });
  target.addChild(window);
  return window;
}

function addStoneCourses(target: Container, x: number, y: number, width: number, rows: number): void {
  const courses = new Graphics();
  for (let row = 0; row < rows; row += 1) {
    const lineY = y + row * 13;
    courses.moveTo(x, lineY).lineTo(x + width, lineY).stroke({ color: COLORS.stoneDark, alpha: 0.38, width: 1.5 });
    for (let joint = row % 2 ? 10 : 22; joint < width; joint += 24) {
      courses.moveTo(x + joint, lineY).lineTo(x + joint, lineY + 12).stroke({ color: COLORS.stoneDark, alpha: 0.28, width: 1 });
    }
  }
  target.addChild(courses);
}

function addSmoke(): Container {
  const smoke = new Container();
  smoke.addChild(
    new Graphics().circle(0, 0, 7).fill({ color: 0xd8d2c3, alpha: 0.44 }),
    new Graphics().circle(5, -10, 9).fill({ color: 0xe3ddcf, alpha: 0.3 }),
    new Graphics().circle(-2, -22, 11).fill({ color: 0xe8e3d8, alpha: 0.18 }),
  );
  return smoke;
}

function createCastle(): BuildingArtwork {
  const art = baseArtwork(190, 160);
  const { container } = art;
  addShadow(container, 77, 22);

  const wall = new Graphics()
    .roundRect(-55, -44, 110, 65, 5)
    .fill(COLORS.stone)
    .stroke({ color: COLORS.outline, width: 4 });
  container.addChild(wall);
  addStoneCourses(container, -52, -39, 104, 5);

  for (const x of [-62, 38]) {
    container.addChild(
      new Graphics()
        .roundRect(x, -70, 29, 89, 4)
        .fill(COLORS.stoneLight)
        .stroke({ color: COLORS.outline, width: 4 }),
      new Graphics()
        .poly([x - 6, -68, x + 14.5, -94, x + 35, -68])
        .fill(COLORS.roof)
        .stroke({ color: COLORS.outline, width: 4 }),
    );
  }

  container.addChild(
    new Graphics()
      .roundRect(-28, -91, 56, 109, 5)
      .fill(COLORS.stoneLight)
      .stroke({ color: COLORS.outline, width: 4 }),
    new Graphics()
      .poly([-36, -88, 0, -125, 36, -88])
      .fill(COLORS.roofLight)
      .stroke({ color: COLORS.outline, width: 4 }),
    new Graphics()
      .roundRect(-11, -20, 22, 40, 10)
      .fill(0x3b281d)
      .stroke({ color: COLORS.outline, width: 3 }),
  );
  addStoneCourses(container, -25, -83, 50, 7);
  container.addChild(
    new Graphics().poly([-55, 17, -46, 5, -34, 17]).fill(COLORS.stoneDark).stroke({ color: COLORS.outline, width: 2 }),
    new Graphics().poly([34, 17, 46, 5, 55, 17]).fill(COLORS.stoneDark).stroke({ color: COLORS.outline, width: 2 }),
    new Graphics().roundRect(-7, -13, 14, 33, 7).fill(0x1c1713).stroke({ color: 0xc79a45, width: 1.5 }),
  );

  for (const x of [-48, -17, 9, 39]) {
    art.glowParts.push(addWindow(container, x, x === -17 || x === 9 ? -69 : -39));
  }

  const flagPole = new Graphics().moveTo(0, -124).lineTo(0, -157).stroke({ color: 0x3d2b1b, width: 3 });
  const flag = new Graphics().poly([0, 0, 29, 8, 0, 17]).fill(COLORS.gold).stroke({ color: COLORS.outline, width: 2 });
  flag.position.set(0, -156);
  container.addChild(flagPole, flag);
  art.wavingParts.push(flag);
  return art;
}

function createProductionCastle(texture: Texture): BuildingArtwork {
  const art = baseArtwork(225, 205);
  addShadow(art.container, 98, 18);
  const sprite = new Sprite(texture);
  sprite.anchor.set(.5, 1);
  sprite.width = 220;
  sprite.height = 230;
  sprite.position.set(0, 22);
  art.container.addChild(sprite);
  return art;
}

function createFarm(): BuildingArtwork {
  const art = baseArtwork();
  const { container } = art;
  addShadow(container, 65, 19);

  const field = new Graphics().poly([-76, 8, -18, -12, 49, 6, -16, 25]).fill(COLORS.crop).stroke({ color: COLORS.outline, width: 3 });
  for (let offset = -54; offset <= 18; offset += 18) {
    field.moveTo(offset, 5).lineTo(offset + 42, 16).stroke({ color: COLORS.cropLight, width: 4, alpha: 0.9 });
  }
  container.addChild(field);
  container.addChild(new Graphics().moveTo(-73, -2).lineTo(-75, 22).moveTo(-44, -9).lineTo(-46, 17).moveTo(-74, 10).lineTo(-19, -6).stroke({ color: 0x6e4729, width: 3 }));
  container.addChild(
    new Graphics().roundRect(-18, -47, 58, 57, 4).fill(0xc7a66c).stroke({ color: COLORS.outline, width: 4 }),
    new Graphics().poly([-27, -44, 11, -76, 50, -44]).fill(COLORS.roof).stroke({ color: COLORS.outline, width: 4 }),
    new Graphics().roundRect(21, -86, 12, 37, 2).fill(COLORS.timber).stroke({ color: COLORS.outline, width: 3 }),
  );
  container.addChild(
    new Graphics().roundRect(46, -44, 21, 49, 8).fill(0xb99a65).stroke({ color: COLORS.outline, width: 3 }),
    new Graphics().poly([43, -42, 56, -57, 70, -42]).fill(COLORS.roof).stroke({ color: COLORS.outline, width: 3 }),
  );
  art.glowParts.push(addWindow(container, -6, -33, 11, 13));

  const windmill = new Graphics();
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 2) {
    windmill.moveTo(0, 0).lineTo(Math.cos(angle) * 25, Math.sin(angle) * 25).stroke({ color: 0xe2d4b2, width: 5 });
  }
  windmill.circle(0, 0, 5).fill(COLORS.timber);
  windmill.position.set(47, -42);
  container.addChild(windmill);
  art.rotators.push(windmill);
  art.smoke = addSmoke();
  art.smoke.position.set(27, -91);
  container.addChild(art.smoke);
  return art;
}

function createLumberMill(): BuildingArtwork {
  const art = baseArtwork();
  const { container } = art;
  addShadow(container, 67, 19);

  for (let i = 0; i < 3; i += 1) {
    container.addChild(
      new Graphics()
        .roundRect(-70 + i * 3, -3 - i * 11, 55, 10, 5)
        .fill(COLORS.timberLight)
        .stroke({ color: COLORS.outline, width: 2 }),
    );
  }
  container.addChild(
    new Graphics().roundRect(-21, -50, 70, 61, 3).fill(COLORS.timberLight).stroke({ color: COLORS.outline, width: 4 }),
    new Graphics().poly([-32, -47, 14, -77, 59, -47]).fill(0x465539).stroke({ color: COLORS.outline, width: 4 }),
    new Graphics().moveTo(-15, -45).lineTo(-15, 7).moveTo(9, -53).lineTo(9, 7).moveTo(33, -45).lineTo(33, 7).stroke({ color: COLORS.timber, width: 5 }),
  );
  container.addChild(
    new Graphics().moveTo(-19, -44).lineTo(43, 4).moveTo(43, -44).lineTo(-19, 4).stroke({ color: COLORS.timber, alpha: 0.8, width: 3 }),
    new Graphics().roundRect(-72, 9, 47, 8, 4).fill(0x8c542e).stroke({ color: COLORS.outline, width: 2 }),
    new Graphics().circle(-68, 13, 3).fill(0xd0a06b).circle(-28, 13, 3).fill(0xd0a06b),
  );
  art.glowParts.push(addWindow(container, 20, -33, 12, 14));

  const saw = new Graphics().circle(0, 0, 19).fill(0xb7b8b2).stroke({ color: COLORS.outline, width: 3 });
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
    saw.moveTo(Math.cos(angle) * 12, Math.sin(angle) * 12).lineTo(Math.cos(angle) * 22, Math.sin(angle) * 22).stroke({ color: 0xd7d7ce, width: 4 });
  }
  saw.circle(0, 0, 5).fill(COLORS.timber);
  saw.position.set(50, -4);
  container.addChild(saw);
  art.rotators.push(saw);
  art.smoke = addSmoke();
  art.smoke.position.set(-5, -70);
  container.addChild(art.smoke);
  return art;
}

function createMine(): BuildingArtwork {
  const art = baseArtwork();
  const { container } = art;
  addShadow(container, 68, 19);
  container.addChild(
    new Graphics().poly([-72, 12, -59, -46, -31, -72, 2, -56, 28, -81, 66, -42, 76, 12]).fill(COLORS.stoneDark).stroke({ color: COLORS.outline, width: 4 }),
    new Graphics().poly([-56, -31, -31, -57, -8, -40, 13, -62, 45, -29]).fill(COLORS.stone).stroke({ color: 0x756f64, width: 3 }),
    new Graphics().roundRect(-27, -34, 54, 48, 22).fill(0x27231f).stroke({ color: COLORS.timber, width: 7 }),
    new Graphics().moveTo(-18, 17).lineTo(-27, 37).moveTo(18, 17).lineTo(27, 37).moveTo(-27, 37).lineTo(27, 37).stroke({ color: 0x8b7a5e, width: 3 }),
    new Graphics().roundRect(29, -2, 38, 23, 4).fill(0x59636a).stroke({ color: COLORS.outline, width: 3 }),
  );
  container.addChild(
    new Graphics().moveTo(-36, 31).lineTo(38, 31).moveTo(-25, 19).lineTo(-34, 43).moveTo(25, 19).lineTo(34, 43).stroke({ color: 0x9a8968, width: 2 }),
    new Graphics().roundRect(30, -5, 35, 16, 3).fill(0x67737a).stroke({ color: 0x25231f, width: 2 }),
    new Graphics().circle(37, 15, 6).fill(0x302b26).stroke({ color: 0x8f846e, width: 2 }).circle(59, 15, 6).fill(0x302b26).stroke({ color: 0x8f846e, width: 2 }),
  );
  const torch = new Graphics().circle(0, 0, 8).fill({ color: 0xffa63c, alpha: 0.82 });
  torch.position.set(-36, -19);
  container.addChild(torch);
  art.glowParts.push(torch);
  return art;
}

function createGrandMarket(): BuildingArtwork {
  const art = baseArtwork(165, 125);
  const { container } = art;
  addShadow(container, 75, 20);
  container.addChild(
    new Graphics().roundRect(-31, -55, 62, 67, 4).fill(0xd4b778).stroke({ color: COLORS.outline, width: 4 }),
    new Graphics().poly([-43, -52, 0, -88, 43, -52]).fill(COLORS.canvasRed).stroke({ color: COLORS.outline, width: 4 }),
  );
  art.glowParts.push(addWindow(container, -8, -39, 16, 17));

  const stalls = [
    { x: -70, color: COLORS.canvasBlue },
    { x: 43, color: COLORS.gold },
  ];
  for (const stall of stalls) {
    container.addChild(
      new Graphics().roundRect(stall.x, -23, 37, 34, 3).fill(COLORS.timberLight).stroke({ color: COLORS.outline, width: 3 }),
      new Graphics().poly([stall.x - 6, -22, stall.x + 18, -46, stall.x + 45, -22]).fill(stall.color).stroke({ color: COLORS.outline, width: 3 }),
    );
  }
  container.addChild(
    new Graphics().roundRect(-63, 12, 20, 15, 2).fill(0x8d5b32).stroke({ color: COLORS.outline, width: 2 }),
    new Graphics().roundRect(43, 12, 18, 14, 2).fill(0xa97438).stroke({ color: COLORS.outline, width: 2 }),
    new Graphics().circle(-53, 8, 3).fill(COLORS.gold).circle(51, 8, 3).fill(0xb74732),
  );

  const banner = new Graphics().roundRect(0, 0, 17, 27, 2).fill(COLORS.gold).stroke({ color: COLORS.outline, width: 2 });
  banner.position.set(-8, -108);
  container.addChild(new Graphics().moveTo(0, -84).lineTo(0, -112).stroke({ color: COLORS.outline, width: 3 }), banner);
  art.wavingParts.push(banner);
  return art;
}

export function createBuildingArtwork(id: BuildingId, castleTexture?: Texture): BuildingArtwork {
  switch (id) {
    case 'castle': return castleTexture ? createProductionCastle(castleTexture) : createCastle();
    case 'farm': return createFarm();
    case 'lumberMill': return createLumberMill();
    case 'mine': return createMine();
    case 'grandMarket': return createGrandMarket();
  }
}
