import { Container, Graphics } from 'pixi.js';
import type { KingdomExpansionPresentation } from '../data/kingdom-expansion-stages';

export interface ExpansionAreaArtwork {
  container: Container;
  environment: Container;
  mist: Container;
}

export function createExpansionAreaArtwork(stage: KingdomExpansionPresentation): ExpansionAreaArtwork {
  const container = new Container();
  const environment = new Container();
  const mist = createMist();
  container.eventMode = 'none';
  environment.eventMode = 'none';
  mist.eventMode = 'none';

  if (stage.environment === 'DEFENSIVE_FRONTIER') drawDefensiveFrontier(environment);
  if (stage.environment === 'SCHOLARLY_TERRACE') drawScholarlyTerrace(environment);
  if (stage.environment === 'ENGINEERING_YARD') drawEngineeringYard(environment);
  if (stage.environment === 'FORGE_YARD') drawForgeYard(environment);

  container.addChild(environment, mist);
  return { container, environment, mist };
}

function drawDefensiveFrontier(target: Container): void {
  target.addChild(irregularGround(0x596046, .13, [-62, 5, -44, -23, 8, -31, 55, -15, 65, 11, 30, 27, -31, 25]));
  const rock = new Graphics();
  for (const [x, y, radius] of [[-54, 9, 6], [-40, -17, 4], [43, -11, 7], [55, 10, 4]] as const) {
    rock.circle(x, y, radius).fill({ color: 0x77745c, alpha: .38 }).stroke({ color: 0x25291f, alpha: .35, width: 1 });
  }
  const fence = new Graphics()
    .moveTo(-60, -24).lineTo(-21, -35).moveTo(24, -34).lineTo(61, -22)
    .stroke({ color: 0x4b3925, alpha: .78, width: 4 });
  for (const x of [-55, -39, -23, 28, 44, 59]) fence.moveTo(x, -39 + Math.abs(x) * .22).lineTo(x, -19 + Math.abs(x) * .12);
  fence.stroke({ color: 0x2f281e, alpha: .86, width: 3 });
  const approach = new Graphics().moveTo(-8, 34).lineTo(-3, 17).lineTo(4, 4).stroke({ color: 0x9a815a, alpha: .2, width: 18 });
  target.addChild(approach, rock, fence);
}

function drawScholarlyTerrace(target: Container): void {
  target.addChild(irregularGround(0x74705a, .11, [-68, 12, -56, -24, -14, -37, 48, -28, 69, 0, 49, 28, -16, 34]));
  const paving = new Graphics();
  const stones = [[-49, -12], [-25, -23], [2, -27], [29, -20], [48, -7], [-38, 9], [-10, 4], [20, 2], [42, 13], [-20, 23], [10, 20]] as const;
  for (const [x, y] of stones) paving.roundRect(x - 8, y - 4, 16, 8, 2).fill({ color: 0xa39572, alpha: .2 }).stroke({ color: 0x4c4a3c, alpha: .28, width: 1 });
  const path = new Graphics().moveTo(-3, 39).lineTo(0, 24).lineTo(10, 9).stroke({ color: 0xb09b72, alpha: .18, width: 15 });
  const shrubs = new Graphics()
    .circle(-61, -3, 7).circle(-53, 4, 6).circle(57, -5, 8).circle(52, 5, 5)
    .fill({ color: 0x30472a, alpha: .62 });
  target.addChild(path, paving, shrubs);
}

function drawEngineeringYard(target: Container): void {
  target.addChild(irregularGround(0x66543c, .13, [-72, 12, -57, -28, -8, -35, 62, -20, 72, 12, 42, 31, -35, 29]));
  const timber = new Graphics();
  for (let index = 0; index < 4; index += 1) {
    timber.roundRect(-68 + index * 7, -22 - index * 2, 45, 5, 2).fill({ color: 0x6f4a2b, alpha: .68 }).stroke({ color: 0x33281d, alpha: .5, width: 1 });
  }
  const crates = new Graphics()
    .rect(43, -19, 20, 16).fill({ color: 0x715337, alpha: .66 }).stroke({ color: 0x352a20, alpha: .62, width: 2 })
    .moveTo(43, -19).lineTo(63, -3).moveTo(63, -19).lineTo(43, -3).stroke({ color: 0x453321, alpha: .55, width: 1 });
  const track = new Graphics().moveTo(5, 34).lineTo(5, 8).lineTo(18, -8).stroke({ color: 0xa17e51, alpha: .18, width: 16 });
  target.addChild(track, timber, crates);
}

function drawForgeYard(target: Container): void {
  target.addChild(irregularGround(0x443c34, .17, [-65, 7, -52, -29, -5, -37, 57, -20, 69, 10, 37, 29, -33, 27]));
  const stone = new Graphics();
  for (const [x, y] of [[-52, -14], [-33, -25], [36, -24], [54, -8], [47, 16], [-44, 13]] as const) {
    stone.roundRect(x - 7, y - 4, 14, 8, 3).fill({ color: 0x656056, alpha: .36 });
  }
  const wood = new Graphics();
  for (let index = 0; index < 3; index += 1) wood.roundRect(38, 10 - index * 7, 28, 5, 2).fill({ color: 0x634327, alpha: .72 });
  const ember = new Graphics().ellipse(-49, 4, 11, 5).fill({ color: 0xd46b2d, alpha: .14 });
  const path = new Graphics().moveTo(6, 35).lineTo(3, 17).lineTo(-5, 4).stroke({ color: 0x7e6850, alpha: .2, width: 16 });
  target.addChild(path, stone, wood, ember);
}

function irregularGround(color: number, alpha: number, points: number[]): Graphics {
  const shape = new Graphics().moveTo(points[0], points[1]);
  for (let index = 2; index < points.length; index += 2) shape.lineTo(points[index], points[index + 1]);
  return shape.closePath().fill({ color, alpha }).stroke({ color: 0x272c21, alpha: .18, width: 2 });
}

function createMist(): Container {
  const mist = new Container();
  mist.addChild(
    new Graphics().ellipse(-34, -12, 52, 20).fill({ color: 0xcbd0bd, alpha: .2 }),
    new Graphics().ellipse(24, -5, 58, 23).fill({ color: 0xd7d7c7, alpha: .18 }),
    new Graphics().ellipse(0, 19, 70, 19).fill({ color: 0xbfc9ba, alpha: .14 }),
  );
  return mist;
}
