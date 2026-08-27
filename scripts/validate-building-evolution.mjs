import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const assetRoot = join(root, 'apps', 'game-client', 'public', 'assets', 'kingdom', 'evolution');
const implementedThemes = [{ id: 'DEFAULT', namespace: 'default' }];
const buildingFolders = ['castle', 'farm', 'lumber-mill', 'mine', 'grand-market'];
const failures = [];
let totalBytes = 0;

const themeDirectories = (await readdir(assetRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const expectedThemeDirectories = implementedThemes.map((theme) => theme.namespace).sort();
if (JSON.stringify(themeDirectories) !== JSON.stringify(expectedThemeDirectories)) {
  failures.push(`theme namespaces mismatch: expected ${expectedThemeDirectories.join(', ')}, found ${themeDirectories.join(', ')}`);
}

for (const theme of implementedThemes) {
  for (const building of buildingFolders) {
    for (let tier = 1; tier <= 5; tier += 1) {
      const path = join(assetRoot, theme.namespace, building, `tier-${tier}.webp`);
      try {
        const [info, bytes] = await Promise.all([stat(path), readFile(path)]);
        totalBytes += info.size;
        if (info.size < 10_000) failures.push(`${theme.id}/${building} tier ${tier}: suspiciously small (${info.size} bytes)`);
        if (info.size > 250_000) failures.push(`${theme.id}/${building} tier ${tier}: exceeds 250 KB (${info.size} bytes)`);
        if (bytes.subarray(0, 4).toString('ascii') !== 'RIFF' || bytes.subarray(8, 12).toString('ascii') !== 'WEBP') {
          failures.push(`${theme.id}/${building} tier ${tier}: invalid WebP container`);
        }
      } catch (error) {
        failures.push(`${theme.id}/${building} tier ${tier}: missing (${error instanceof Error ? error.message : String(error)})`);
      }
    }
  }
}

const progressionSource = await readFile(join(
  root,
  'apps', 'game-client', 'src', 'features', 'kingdom', 'rendering', 'building-visual-progression.ts',
), 'utf8');
for (const token of ['BuildingVisualRequest', 'KingdomThemeId', 'BUILDING_VISUAL_CATALOG', 'EARLY', 'DEVELOPED', 'ADVANCED', 'FORTIFIED', 'PRESTIGE', 'prestige-capstone']) {
  if (!progressionSource.includes(token)) failures.push(`visual configuration missing token: ${token}`);
}
if (!progressionSource.includes('Math.floor((level - 1) / 4)')) failures.push('visual configuration does not derive five level tiers');
if (!progressionSource.includes('Array.from({ length: minorStep }')) failures.push('visual configuration does not derive per-level minor details');

if (failures.length) {
  console.error(`Building evolution validation failed:\n- ${failures.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log(`Building evolution validation passed: ${implementedThemes.length} implemented theme, 20 levels tested by Vitest, 25 DEFAULT WebP assets inspected, ${(totalBytes / 1024).toFixed(1)} KiB total.`);
}
