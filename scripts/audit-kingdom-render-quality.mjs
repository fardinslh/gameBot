import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const publicRoot = join(root, 'apps', 'game-client', 'public');
const worldWidth = 640;
const viewports = [320, 375, 390];
const zooms = [1, 1.25, 1.5, 2];
const rendererDpr = 2;
const assets = [
  { id: 'terrain', path: '/assets/kingdom/terrain/kingdom-base-v5.webp', sourceWidth: 2048, worldWidth: 1024 },
  { id: 'knight', path: '/assets/kingdom/characters/heroes/hero-atlas-v2.webp', sourceWidth: 160, worldWidth: 58 },
  { id: 'ranger', path: '/assets/kingdom/characters/heroes/hero-atlas-v2.webp', sourceWidth: 160, worldWidth: 58 },
  { id: 'mage', path: '/assets/kingdom/characters/heroes/hero-atlas-v2.webp', sourceWidth: 160, worldWidth: 58 },
  ...[
    ['guard', 96, 30], ['worker', 96, 27], ['merchant', 96, 27], ['scholar', 96, 27], ['builder', 96, 27],
  ].map(([id, sourceWidth, worldHeight]) => ({ id, path: '/assets/kingdom/characters/ambient/people-atlas-v1.webp', sourceWidth, worldWidth: Number(worldHeight) * .8 })),
];

const buildingConfig = [
  ['castle', 'castle', 1.48, 224], ['farm', 'farm', .97, 198], ['lumberMill', 'lumber-mill', .96, 198],
  ['mine', 'mine', 1, 206], ['grandMarket', 'grand-market', 1.03, 212], ['academy', 'academy', .84, 208],
  ['blacksmith', 'blacksmith', .84, 202], ['watchtower', 'watchtower', .76, 161], ['workshop', 'workshop', .78, 202],
];
for (const [id, folder, layoutScale, renderWidth] of buildingConfig) {
  const path = `/assets/kingdom/evolution/default/${folder}/tier-5.webp`;
  const metadata = await sharp(join(publicRoot, path)).metadata();
  assets.push({ id, path, sourceWidth: metadata.width, worldWidth: renderWidth * layoutScale });
}

const rows = [];
for (const asset of assets) {
  const absolute = join(publicRoot, asset.path);
  const [metadata, fileInfo] = await Promise.all([sharp(absolute).metadata(), stat(absolute)]);
  const samples = [];
  for (const viewport of viewports) {
    for (const zoom of zooms) {
      const cssWidth = asset.worldWidth * viewport / worldWidth * zoom;
      const physicalWidth = cssWidth * rendererDpr;
      samples.push({ viewport, zoom, cssWidth: round(cssWidth), physicalWidth: round(physicalWidth), sourcePerPhysicalPixel: round(asset.sourceWidth / physicalWidth) });
    }
  }
  rows.push({ ...asset, canvas: `${metadata.width}x${metadata.height}`, bytes: fileInfo.size, samples, worstRatio: Math.min(...samples.map((sample) => sample.sourcePerPhysicalPixel)) });
}

const report = {
  generatedAt: new Date().toISOString(),
  assumptions: { rendererDpr, viewports, worldWidth, zooms },
  interpretation: 'Ratios below 1 magnify source pixels and require genuine higher-detail source art; filtering or sharpening cannot restore detail.',
  rows,
  risks: rows.filter((row) => row.worstRatio < 1).map(({ id, path, worstRatio }) => ({ id, path, worstRatio })),
};
const terrainRow = rows.find((r) => r.id === 'terrain');
if (terrainRow) {
  const sample390_100 = terrainRow.samples.find((s) => s.viewport === 390 && s.zoom === 1);
  if (!sample390_100 || sample390_100.sourcePerPhysicalPixel <= 0.82) {
    throw new Error(`Terrain density regression: ratio at 390px/DPR2/100% is ${sample390_100?.sourcePerPhysicalPixel}, which is not strictly better than v3 baseline 0.82!`);
  }
}

const outputArgument = process.argv.find((argument) => argument.startsWith('--output='));
if (outputArgument) {
  const output = join(root, outputArgument.slice('--output='.length));
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Wrote Kingdom render-quality audit to ${output}.`);
} else console.table(rows.map(({ id, canvas, worstRatio }) => ({ id, canvas, worstRatio })));

function round(value) { return Math.round(value * 100) / 100; }
