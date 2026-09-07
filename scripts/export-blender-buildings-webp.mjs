import { copyFile, mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const sourceDir = join(root, 'art-source', 'buildings');
const evolutionDir = join(root, 'apps', 'game-client', 'public', 'assets', 'kingdom', 'evolution', 'default');
const buildingsFallbackDir = join(root, 'apps', 'game-client', 'public', 'assets', 'kingdom', 'buildings');
const castleFallback = join(root, 'apps', 'game-client', 'public', 'assets', 'kingdom', 'castle-production-v1.webp');

const buildings = [
  'castle',
  'farm',
  'lumber-mill',
  'mine',
  'grand-market',
  'academy',
  'blacksmith',
  'watchtower',
  'workshop',
];

console.log('=== Exporting 3D Blender Buildings to Production WebP Assets ===');
let exportedCount = 0;
let totalBytes = 0;

for (const bName of buildings) {
  const targetEvolutionFolder = join(evolutionDir, bName);
  await mkdir(targetEvolutionFolder, { recursive: true });

  for (let tier = 1; tier <= 5; tier += 1) {
    const srcPng = join(sourceDir, bName, `tier-${tier}.png`);
    const dstWebp = join(targetEvolutionFolder, `tier-${tier}.webp`);

    const img = sharp(srcPng);
    const webpBuffer = await img
      .webp({
        quality: 92,
        alphaQuality: 100,
        effort: 6,
      })
      .toBuffer();

    await sharp(webpBuffer).toFile(dstWebp);

    const stats = await stat(dstWebp);
    totalBytes += stats.size;
    exportedCount += 1;

    console.log(`  [${bName}] tier-${tier}.webp -> ${(stats.size / 1024).toFixed(1)} KiB`);

    // Single-stage fallbacks for tier 1
    if (tier === 1) {
      const fallbackDst = join(buildingsFallbackDir, `${bName}-stage-1.webp`);
      await copyFile(dstWebp, fallbackDst);
      if (bName === 'castle') {
        await copyFile(dstWebp, castleFallback);
      }
    }
  }
}

console.log(`\nSUCCESS: ${exportedCount} WebP assets exported! Total size: ${(totalBytes / 1024).toFixed(1)} KiB (average ${(totalBytes / exportedCount / 1024).toFixed(1)} KiB/asset)`);
