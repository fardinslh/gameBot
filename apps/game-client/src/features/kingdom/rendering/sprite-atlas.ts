import { Rectangle, Texture } from 'pixi.js';

export function createAtlasRowFrames(texture: Texture, row: number, rowCount: number, columnCount = 2): readonly Texture[] {
  if (!Number.isInteger(row) || !Number.isInteger(rowCount) || !Number.isInteger(columnCount)
    || row < 0 || row >= rowCount || rowCount < 1 || columnCount < 1) {
    throw new RangeError('Invalid sprite atlas grid');
  }
  const width = texture.frame.width / columnCount;
  const height = texture.frame.height / rowCount;
  return Array.from({ length: columnCount }, (_, column) => new Texture({
    source: texture.source,
    frame: new Rectangle(texture.frame.x + column * width, texture.frame.y + row * height, width, height),
    label: `${texture.label ?? 'actor-atlas'}-${row}-${column}`,
  }));
}
