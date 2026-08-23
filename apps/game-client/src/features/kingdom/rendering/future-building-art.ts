import { Container, Ellipse, Graphics } from 'pixi.js';
import type { FutureBuildingId } from '../domain/kingdom-types';
import type { BuildingArtwork } from './building-art';

const C = {
  ink: 0x241b15, stone: 0x77766d, stoneLight: 0xaaa99d, stoneDark: 0x4c4d49,
  timber: 0x58351f, timberLight: 0x8b5730, roofRed: 0x6c2922, roofBlue: 0x294d5c,
  roofDark: 0x343832, gold: 0xd5a94b, window: 0xffc95d, shadow: 0x11130f,
} as const;

function base(width = 150, height = 112): BuildingArtwork {
  const container = new Container();
  const selection = new Graphics().ellipse(0, 13, width * .47, height * .28).fill({ color: C.gold, alpha: .1 }).stroke({ color: 0xffd76c, alpha: .9, width: 3 });
  selection.visible = false;
  container.addChild(selection, new Graphics().ellipse(0, 18, width * .46, 18).fill({ color: C.shadow, alpha: .44 }));
  container.hitArea = new Ellipse(0, -20, width / 2, height / 2);
  container.eventMode = 'static';
  container.cursor = 'pointer';
  return { container, selection, glowParts: [], rotators: [], smoke: null, wavingParts: [] };
}

function window(target: Container, x: number, y: number, art: BuildingArtwork, width = 10, height = 13): void {
  const glow = new Graphics().roundRect(x, y, width, height, 2).fill(C.window).stroke({ color: C.ink, width: 2 });
  target.addChild(glow);
  art.glowParts.push(glow);
}

function banner(color: number): Graphics {
  return new Graphics().poly([0, 0, 18, 4, 15, 23, 8, 18, 0, 23]).fill(color).stroke({ color: C.ink, width: 2 });
}

function smoke(): Container {
  const cloud = new Container();
  cloud.addChild(
    new Graphics().circle(0, 0, 7).fill({ color: 0xd8d3c8, alpha: .4 }),
    new Graphics().circle(4, -11, 10).fill({ color: 0xe2ddd2, alpha: .25 }),
    new Graphics().circle(-2, -24, 12).fill({ color: 0xe6e1d8, alpha: .14 }),
  );
  return cloud;
}

function createBarracks(): BuildingArtwork {
  const art = base(170, 120); const c = art.container;
  c.addChild(
    new Graphics().poly([-63, -39, 48, -39, 62, 7, -52, 7]).fill(C.stone).stroke({ color: C.ink, width: 4 }),
    new Graphics().poly([-73, -38, -4, -76, 65, -38]).fill(C.roofRed).stroke({ color: C.ink, width: 4 }),
    new Graphics().moveTo(-50, -34).lineTo(-50, 5).moveTo(-18, -50).lineTo(-18, 6).moveTo(17, -49).lineTo(17, 6).moveTo(48, -33).lineTo(48, 5).stroke({ color: C.timber, width: 4 }),
    new Graphics().roundRect(-11, -24, 23, 32, 4).fill(0x2d241e).stroke({ color: C.ink, width: 3 }),
    new Graphics().moveTo(73, 13).lineTo(73, -46).moveTo(-73, 13).lineTo(-73, -46).stroke({ color: C.ink, width: 3 }),
  );
  const left = banner(0x8b3328); left.position.set(-73, -45); const right = banner(0x8b3328); right.position.set(73, -45);
  c.addChild(left, right, new Graphics().circle(-33, 10, 12).fill(0x39434b).stroke({ color: 0xb9aa80, width: 2 }).moveTo(29, -5).lineTo(29, 15).moveTo(20, 4).lineTo(38, 4).stroke({ color: 0xb9aa80, width: 3 }));
  art.wavingParts.push(left, right); window(c, 28, -27, art); return art;
}

function createBlacksmith(): BuildingArtwork {
  const art = base(155, 115); const c = art.container;
  c.addChild(
    new Graphics().roundRect(-54, -43, 105, 52, 4).fill(C.stoneDark).stroke({ color: C.ink, width: 4 }),
    new Graphics().poly([-65, -41, -13, -73, 62, -41]).fill(C.roofDark).stroke({ color: C.ink, width: 4 }),
    new Graphics().roundRect(23, -84, 17, 45, 2).fill(C.stone).stroke({ color: C.ink, width: 3 }),
    new Graphics().roundRect(-42, -29, 39, 37, 4).fill(0x271b16).stroke({ color: C.timber, width: 5 }),
    new Graphics().circle(-23, -10, 13).fill({ color: 0xff8c32, alpha: .76 }),
    new Graphics().moveTo(53, -7).lineTo(72, 13).moveTo(72, -7).lineTo(53, 13).moveTo(48, 13).lineTo(77, 13).stroke({ color: 0x292b2b, width: 5 }),
  );
  art.glowParts.push(c.children[c.children.length - 2] as Graphics);
  art.smoke = smoke(); art.smoke.position.set(31, -89); c.addChild(art.smoke); return art;
}

function createAcademy(): BuildingArtwork {
  const art = base(155, 145); const c = art.container;
  c.addChild(
    new Graphics().roundRect(-48, -42, 96, 52, 4).fill(C.stoneLight).stroke({ color: C.ink, width: 4 }),
    new Graphics().poly([-56, -40, 0, -68, 57, -40]).fill(C.roofBlue).stroke({ color: C.ink, width: 4 }),
    new Graphics().roundRect(-18, -104, 36, 67, 4).fill(C.stone).stroke({ color: C.ink, width: 4 }),
    new Graphics().poly([-26, -101, 0, -132, 27, -101]).fill(0x365f70).stroke({ color: C.ink, width: 4 }),
    new Graphics().circle(0, -80, 10).fill(0x22333a).stroke({ color: C.gold, width: 2 }).moveTo(0, -80).lineTo(0, -87).moveTo(0, -80).lineTo(6, -76).stroke({ color: C.gold, width: 2 }),
    new Graphics().roundRect(-9, -22, 18, 32, 8).fill(0x35271d).stroke({ color: C.ink, width: 3 }),
  );
  window(c, -37, -27, art); window(c, 26, -27, art); return art;
}

function createGranary(): BuildingArtwork {
  const art = base(145, 112); const c = art.container;
  c.addChild(
    new Graphics().roundRect(-34, -55, 68, 65, 12).fill(0xb49a66).stroke({ color: C.ink, width: 4 }),
    new Graphics().poly([-46, -52, 0, -86, 47, -52]).fill(C.roofRed).stroke({ color: C.ink, width: 4 }),
    new Graphics().moveTo(-20, -49).lineTo(-20, 8).moveTo(0, -56).lineTo(0, 8).moveTo(20, -49).lineTo(20, 8).stroke({ color: C.timber, width: 4 }),
    new Graphics().roundRect(-8, -19, 16, 29, 5).fill(0x3f2b1e).stroke({ color: C.ink, width: 3 }),
    new Graphics().ellipse(-50, 7, 15, 9).fill(0xc4a76c).stroke({ color: C.ink, width: 2 }),
    new Graphics().ellipse(51, 8, 14, 8).fill(0xc4a76c).stroke({ color: C.ink, width: 2 }),
  );
  return art;
}

function createWatchtower(): BuildingArtwork {
  const art = base(105, 150); const c = art.container;
  c.addChild(
    new Graphics().poly([-28, -85, 28, -85, 35, 13, -35, 13]).fill(C.stone).stroke({ color: C.ink, width: 4 }),
    new Graphics().roundRect(-40, -107, 80, 31, 4).fill(C.timberLight).stroke({ color: C.ink, width: 4 }),
    new Graphics().poly([-48, -104, 0, -137, 48, -104]).fill(C.roofDark).stroke({ color: C.ink, width: 4 }),
    new Graphics().moveTo(-25, -101).lineTo(-25, -77).moveTo(25, -101).lineTo(25, -77).stroke({ color: C.timber, width: 5 }),
    new Graphics().roundRect(-8, -13, 16, 27, 7).fill(0x30241d).stroke({ color: C.ink, width: 3 }),
  );
  window(c, -6, -62, art, 12, 16); const flag = banner(0x315c75); flag.position.set(0, -165); c.addChild(new Graphics().moveTo(0, -136).lineTo(0, -167).stroke({ color: C.ink, width: 3 }), flag); art.wavingParts.push(flag); return art;
}

function createTavern(): BuildingArtwork {
  const art = base(160, 120); const c = art.container;
  c.addChild(
    new Graphics().roundRect(-57, -43, 112, 53, 5).fill(0xa4784c).stroke({ color: C.ink, width: 4 }),
    new Graphics().poly([-67, -40, -15, -72, 68, -40]).fill(C.roofRed).stroke({ color: C.ink, width: 4 }),
    new Graphics().moveTo(-45, -35).lineTo(-45, 8).moveTo(-4, -58).lineTo(-4, 8).moveTo(42, -35).lineTo(42, 8).stroke({ color: C.timber, width: 4 }),
    new Graphics().roundRect(-7, -24, 20, 34, 7).fill(0x372319).stroke({ color: C.ink, width: 3 }),
    new Graphics().moveTo(59, -31).lineTo(75, -31).lineTo(75, -13).stroke({ color: C.timber, width: 3 }).circle(75, -7, 8).fill(C.gold).stroke({ color: C.ink, width: 2 }),
  );
  window(c, -36, -28, art, 13, 14); window(c, 26, -28, art, 13, 14); return art;
}

function createStable(): BuildingArtwork {
  const art = base(170, 105); const c = art.container;
  c.addChild(
    new Graphics().roundRect(-60, -38, 117, 48, 4).fill(C.timberLight).stroke({ color: C.ink, width: 4 }),
    new Graphics().poly([-70, -36, -7, -68, 69, -36]).fill(C.roofDark).stroke({ color: C.ink, width: 4 }),
    new Graphics().moveTo(-44, -33).lineTo(-44, 9).moveTo(-10, -51).lineTo(-10, 9).moveTo(26, -50).lineTo(26, 9).moveTo(51, -32).lineTo(51, 9).stroke({ color: C.timber, width: 5 }),
    new Graphics().roundRect(-31, -21, 25, 31, 4).fill(0x3b281d).stroke({ color: C.ink, width: 3 }),
    new Graphics().roundRect(13, -21, 25, 31, 4).fill(0x3b281d).stroke({ color: C.ink, width: 3 }),
    new Graphics().moveTo(-76, 4).lineTo(-76, 24).moveTo(-38, 7).lineTo(-38, 24).moveTo(-76, 14).lineTo(-38, 14).stroke({ color: C.timber, width: 3 }),
  );
  return art;
}

export function createFutureBuildingArtwork(id: FutureBuildingId): BuildingArtwork {
  switch (id) {
    case 'barracks': return createBarracks();
    case 'blacksmith': return createBlacksmith();
    case 'academy': return createAcademy();
    case 'granary': return createGranary();
    case 'watchtower': return createWatchtower();
    case 'tavern': return createTavern();
    case 'stable': return createStable();
  }
}
