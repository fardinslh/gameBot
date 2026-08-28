import { mkdir, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const root = process.cwd();
const assetRoot = join(root, 'apps', 'game-client', 'public', 'assets', 'kingdom', 'evolution', 'default');
const viewports = [320, 375, 390];
const dpr = 2;
const worldWidth = 640;
const alphaThreshold = 8;
const buildings = [
  { id: 'castle', folder: 'castle', layoutScale: 1.48, renderWidths: [158, 186, 202, 214, 224] },
  { id: 'farm', folder: 'farm', layoutScale: .97, renderWidths: [154, 170, 182, 190, 198] },
  { id: 'lumberMill', folder: 'lumber-mill', layoutScale: .96, renderWidths: [150, 168, 180, 190, 198] },
  { id: 'mine', folder: 'mine', layoutScale: 1, renderWidths: [158, 178, 190, 198, 206] },
  { id: 'grandMarket', folder: 'grand-market', layoutScale: 1.03, renderWidths: [156, 176, 194, 204, 212] },
];

const rows = [];
for (const building of buildings) {
  for (let tier = 1; tier <= 5; tier += 1) {
    const file = join(assetRoot, building.folder, `tier-${tier}.webp`);
    const [metadata, fileInfo, raw] = await Promise.all([
      sharp(file).metadata(),
      stat(file),
      sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    ]);
    const bounds = findAlphaBounds(raw.data, raw.info.width, raw.info.height, raw.info.channels, alphaThreshold);
    const renderWidth = building.renderWidths[tier - 1];
    const display = Object.fromEntries(viewports.map((viewport) => {
      const worldScale = viewport / worldWidth;
      const cssCanvasWidth = renderWidth * building.layoutScale * worldScale;
      const opaqueCssWidth = cssCanvasWidth * bounds.width / raw.info.width;
      const normalRatio = bounds.width / (opaqueCssWidth * dpr);
      return [viewport, {
        cssCanvasWidth: round(cssCanvasWidth),
        opaqueCssWidth: round(opaqueCssWidth),
        sourcePerPhysicalPixel100: round(normalRatio),
        sourcePerPhysicalPixel150: round(normalRatio / 1.5),
        sourcePerPhysicalPixel200: round(normalRatio / 2),
      }];
    }));
    rows.push({
      building: building.id,
      tier,
      file: `default/${building.folder}/${basename(file)}`,
      bytes: fileInfo.size,
      format: metadata.format,
      width: metadata.width,
      height: metadata.height,
      hasAlpha: metadata.hasAlpha === true,
      opaqueBounds: bounds,
      renderWidth,
      layoutScale: building.layoutScale,
      display,
    });
  }
}

const totalBytes = rows.reduce((sum, row) => sum + row.bytes, 0);
const initialTierBytes = rows.filter((row) => row.tier === 1).reduce((sum, row) => sum + row.bytes, 0);
const largest = rows.reduce((current, row) => row.bytes > current.bytes ? row : current);
const smallestOpaque = rows.reduce((current, row) => row.opaqueBounds.width * row.opaqueBounds.height < current.opaqueBounds.width * current.opaqueBounds.height ? row : current);
const risks = rows.filter((row) => row.display[390].sourcePerPhysicalPixel200 < 1);
const report = {
  generatedAt: new Date().toISOString(),
  assumptions: { alphaThreshold, dpr, viewports, worldWidth, inspectionZooms: [1, 1.5, 2] },
  rows,
  summary: {
    totalBytes,
    initialFiveTier1Bytes: initialTierBytes,
    largest: { file: largest.file, bytes: largest.bytes },
    smallestOpaqueContent: { file: smallestOpaque.file, bounds: smallestOpaque.opaqueBounds },
    resolutionRiskFilesAt390Dpr2Zoom2: risks.map((row) => row.file),
  },
};

const outputArgument = process.argv.find((argument) => argument.startsWith('--output='));
if (outputArgument) {
  const outputPath = join(root, outputArgument.slice('--output='.length));
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Wrote texture audit to ${outputPath}.`);
} else if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.table(rows.map((row) => ({
    building: row.building,
    tier: row.tier,
    source: `${row.width}x${row.height}`,
    opaque: `${row.opaqueBounds.width}x${row.opaqueBounds.height}+${row.opaqueBounds.left}+${row.opaqueBounds.top}`,
    alpha: row.hasAlpha ? 'yes' : 'no',
    KiB: round(row.bytes / 1024),
    '390 CSS': row.display[390].opaqueCssWidth,
    '100% ratio': row.display[390].sourcePerPhysicalPixel100,
    '150% ratio': row.display[390].sourcePerPhysicalPixel150,
    '200% ratio': row.display[390].sourcePerPhysicalPixel200,
  })));
  console.log(`Total: ${(totalBytes / 1024).toFixed(1)} KiB; current Tier-1 initial set: ${(initialTierBytes / 1024).toFixed(1)} KiB.`);
  console.log(`Largest: ${largest.file} (${(largest.bytes / 1024).toFixed(1)} KiB).`);
  console.log(`Smallest opaque content: ${smallestOpaque.file} (${smallestOpaque.opaqueBounds.width}x${smallestOpaque.opaqueBounds.height}).`);
  console.log(`Potential 390px / DPR2 / 200% risks: ${risks.length ? risks.map((row) => row.file).join(', ') : 'none'}.`);
}

function findAlphaBounds(data, width, height, channels, threshold) {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * channels + 3] <= threshold) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (right < left || bottom < top) return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
  return { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1 };
}

function round(value) {
  return Math.round(value * 100) / 100;
}
