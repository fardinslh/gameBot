import process from 'node:process';
import sharp from 'sharp';

const [, , inputPath, outputPath, maximumSize = '720'] = process.argv;

if (!inputPath || !outputPath) {
  console.error('Usage: node scripts/process-evolution-asset.mjs <input> <output> [max-size]');
  process.exit(1);
}

const source = sharp(inputPath, { failOn: 'error' });
const metadata = await source.metadata();
let pipeline;

if (metadata.hasAlpha) {
  pipeline = source;
} else {
  const { data, info } = await source.raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(info.width * info.height * 4);
  const background = new Uint8Array(info.width * info.height);
  const queue = new Int32Array(info.width * info.height);
  let head = 0;
  let tail = 0;

  const isCheckerPixel = (index) => {
    const offset = index * info.channels;
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    return Math.max(red, green, blue) - Math.min(red, green, blue) <= 12
      && (red + green + blue) / 3 >= 218;
  };
  const enqueue = (index) => {
    if (background[index] || !isCheckerPixel(index)) return;
    background[index] = 1;
    queue[tail++] = index;
  };

  for (let x = 0; x < info.width; x += 1) {
    enqueue(x);
    enqueue((info.height - 1) * info.width + x);
  }
  for (let y = 0; y < info.height; y += 1) {
    enqueue(y * info.width);
    enqueue(y * info.width + info.width - 1);
  }
  while (head < tail) {
    const index = queue[head++];
    const x = index % info.width;
    const y = Math.floor(index / info.width);
    if (x > 0) enqueue(index - 1);
    if (x + 1 < info.width) enqueue(index + 1);
    if (y > 0) enqueue(index - info.width);
    if (y + 1 < info.height) enqueue(index + info.width);
  }

  for (let index = 0; index < background.length; index += 1) {
    const sourceOffset = index * info.channels;
    const targetOffset = index * 4;
    rgba[targetOffset] = data[sourceOffset];
    rgba[targetOffset + 1] = data[sourceOffset + 1];
    rgba[targetOffset + 2] = data[sourceOffset + 2];
    rgba[targetOffset + 3] = background[index] ? 0 : 255;
  }
  pipeline = sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } });
}

await pipeline
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 })
  .resize({ width: Number(maximumSize), height: Number(maximumSize), fit: 'inside', withoutEnlargement: true })
  .webp({ quality: 88, alphaQuality: 95, effort: 6 })
  .toFile(outputPath);

const result = await sharp(outputPath).metadata();
console.log(`${outputPath}: ${result.width}x${result.height}, alpha=${result.hasAlpha}`);
