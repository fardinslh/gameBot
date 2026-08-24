import process from 'node:process';
import sharp from 'sharp';

const [basePath, editedPath, outputPath] = process.argv.slice(2);

if (!basePath || !editedPath || !outputPath) {
  throw new Error('Usage: node scripts/composite-kingdom-footprints.mjs BASE EDITED OUTPUT');
}

const WIDTH = 1024;
const HEIGHT = 1536;
const expectedDimensions = { width: WIDTH, height: HEIGHT };

for (const path of [basePath, editedPath]) {
  const { width, height } = await sharp(path).metadata();
  if (width !== expectedDimensions.width || height !== expectedDimensions.height) {
    throw new Error(`${path} must be ${WIDTH}x${HEIGHT}; received ${width}x${height}`);
  }
}

// Only the Mine excavation and the three lower work-yard regions come from the
// edited source. Soft irregular masks keep the approved Castle, river, roads,
// lighting, and outer environment pixel-identical to the clean v2 base.
const maskSvg = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <defs><filter id="soft"><feGaussianBlur stdDeviation="24" /></filter></defs>
    <rect width="100%" height="100%" fill="black" />
    <g fill="white" filter="url(#soft)">
      <path d="M112 166 L878 150 L940 318 L820 438 L148 444 L72 292 Z" />
      <path d="M56 790 L438 770 L478 1028 L344 1110 L46 1054 Z" />
      <path d="M558 782 L970 776 L1010 1048 L866 1118 L548 1034 Z" />
      <path d="M256 986 L754 970 L802 1262 L704 1300 L242 1284 L214 1110 Z" />
    </g>
  </svg>
`);

const mask = await sharp(maskSvg).png().toBuffer();
const edited = await sharp(editedPath)
  .removeAlpha()
  .joinChannel(mask)
  .png()
  .toBuffer();

const info = await sharp(basePath)
  .composite([{ input: edited, blend: 'over' }])
  .removeAlpha()
  .webp({ quality: 88, effort: 6, smartSubsample: true })
  .toFile(outputPath);

console.log(JSON.stringify(info));
