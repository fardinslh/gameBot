import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const source = resolve('art-source/buildings/polished-v2');
const destination = resolve('apps/game-client/public/assets/kingdom/buildings/polished-v2');
const buildings = ['castle', 'farm', 'lumber-mill', 'grand-market', 'academy', 'blacksmith', 'watchtower', 'workshop'];
const tiersOnly = process.argv.includes('--tiers');
const selectedBuilding = process.argv.find((argument) => argument.startsWith('--building='))?.split('=')[1];
if (selectedBuilding && !buildings.includes(selectedBuilding)) throw new Error(`Unknown building: ${selectedBuilding}`);
const jobs = buildings.filter((building) => !selectedBuilding || building === selectedBuilding).flatMap((building) => tiersOnly
  ? [2, 3, 4, 5].map((tier) => ({
    label: `${building} tier ${tier}`,
    input: resolve(source, 'tiers', building, `tier-${tier}.png`),
    output: resolve(destination, building, `tier-${tier}.webp`),
  }))
  : [{ label: building, input: resolve(source, `${building}.png`), output: resolve(destination, `${building}.webp`) }]);
// Validate the whole requested set before changing any runtime assets.
for (const job of jobs) {
  const input = sharp(job.input);
  const metadata = await input.metadata();
  const stats = await input.stats();
  if (!metadata.hasAlpha || stats.channels[3].min !== 0) {
    throw new Error(`${job.label}: source must contain genuine transparency`);
  }
}
for (const job of jobs) {
  // Normalize transparent margins without stretching architecture. Keeping the
  // canvas square gives every runtime sprite the same ground registration.
  await mkdir(dirname(job.output), { recursive: true });
  await sharp(job.input).trim({ threshold: 10 }).resize(480, 480, { fit: 'contain', position: 'south', background: '#00000000' })
    .extend({ top: 16, bottom: 16, left: 16, right: 16, background: '#00000000' })
    .webp({ quality: 88, alphaQuality: 100, effort: 6 }).toFile(job.output);
  console.log(`${job.label}: ${job.output}`);
}
