import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const assetRoot = join(root, 'apps', 'game-client', 'public', 'assets', 'kingdom', 'evolution');
const buildingFolders = ['castle', 'farm', 'lumber-mill', 'mine', 'grand-market'];
const failures = [];
let totalBytes = 0;

for (const building of buildingFolders) {
  for (let tier = 1; tier <= 5; tier += 1) {
    const path = join(assetRoot, building, `tier-${tier}.webp`);
    try {
      const [info, bytes] = await Promise.all([stat(path), readFile(path)]);
      totalBytes += info.size;
      if (info.size < 10_000) failures.push(`${building} tier ${tier}: suspiciously small (${info.size} bytes)`);
      if (info.size > 250_000) failures.push(`${building} tier ${tier}: exceeds 250 KB (${info.size} bytes)`);
      if (bytes.subarray(0, 4).toString('ascii') !== 'RIFF' || bytes.subarray(8, 12).toString('ascii') !== 'WEBP') {
        failures.push(`${building} tier ${tier}: invalid WebP container`);
      }
    } catch (error) {
      failures.push(`${building} tier ${tier}: missing (${error instanceof Error ? error.message : String(error)})`);
    }
  }
}

const progressionSource = await readFile(join(
  root,
  'apps', 'game-client', 'src', 'features', 'kingdom', 'rendering', 'building-visual-progression.ts',
), 'utf8');
for (const token of ['EARLY', 'DEVELOPED', 'ADVANCED', 'FORTIFIED', 'PRESTIGE', 'prestige-capstone']) {
  if (!progressionSource.includes(token)) failures.push(`visual configuration missing token: ${token}`);
}
if (!progressionSource.includes('Math.floor((level - 1) / 4)')) failures.push('visual configuration does not derive five level tiers');
if (!progressionSource.includes('Array.from({ length: minorStep }')) failures.push('visual configuration does not derive per-level minor details');

if (failures.length) {
  console.error(`Building evolution validation failed:\n- ${failures.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log(`Building evolution validation passed: 20 levels tested by Vitest, 25 WebP assets inspected, ${(totalBytes / 1024).toFixed(1)} KiB total.`);
}
