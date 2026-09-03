import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const masterInputPath = path.resolve('art-source', 'terrain', 'kingdom-base-v5-master.png');
const publicWebpPath = path.resolve('apps', 'game-client', 'public', 'assets', 'kingdom', 'terrain', 'kingdom-base-v5.webp');

const REQUIRED_MIN_WIDTH = 2048;
const REQUIRED_MIN_HEIGHT = 3072;
const TARGET_ASPECT = 2 / 3;
const MAX_ASPECT_TOLERANCE = 0.02; // max 2% deviation
const MAX_WEBP_SIZE_BYTES = 900 * 1024; // 900 KiB

async function processTerrainMaster() {
  if (!fs.existsSync(masterInputPath)) {
    throw new Error(`Master input file not found: ${masterInputPath}`);
  }

  const metadata = await sharp(masterInputPath).metadata();
  console.log('Master input metadata:', {
    format: metadata.format,
    width: metadata.width,
    height: metadata.height,
    channels: metadata.channels
  });

  // RULE: REFUSE any input narrower than 2048px or shorter than 3072px
  if (!metadata.width || metadata.width < REQUIRED_MIN_WIDTH) {
    throw new Error(`INTEGRITY VIOLATION: Master input width is ${metadata.width}px, which is narrower than the required ${REQUIRED_MIN_WIDTH}px. Upscaling is strictly forbidden!`);
  }
  if (!metadata.height || metadata.height < REQUIRED_MIN_HEIGHT) {
    throw new Error(`INTEGRITY VIOLATION: Master input height is ${metadata.height}px, which is shorter than the required ${REQUIRED_MIN_HEIGHT}px. Upscaling is strictly forbidden!`);
  }

  // Aspect ratio check (2:3 within 2%)
  const aspect = metadata.width / metadata.height;
  const aspectDeviation = Math.abs(aspect - TARGET_ASPECT) / TARGET_ASPECT;
  if (aspectDeviation > MAX_ASPECT_TOLERANCE) {
    throw new Error(`INTEGRITY VIOLATION: Aspect ratio deviation ${(aspectDeviation * 100).toFixed(2)}% exceeds maximum tolerance of ${(MAX_ASPECT_TOLERANCE * 100)}%`);
  }

  // Ensure output directory exists
  fs.mkdirSync(path.dirname(publicWebpPath), { recursive: true });

  console.log(`Processing master into production WebP (quality 85, effort 6)...`);
  const webpInfo = await sharp(masterInputPath)
    .removeAlpha()
    .webp({
      quality: 85,
      effort: 6,
      smartSubsample: true
    })
    .toFile(publicWebpPath);

  console.log('Production WebP output info:', webpInfo);

  if (webpInfo.width !== REQUIRED_MIN_WIDTH || webpInfo.height !== REQUIRED_MIN_HEIGHT) {
    throw new Error(`Output dimensions mismatch: expected ${REQUIRED_MIN_WIDTH}x${REQUIRED_MIN_HEIGHT}, got ${webpInfo.width}x${webpInfo.height}`);
  }

  if (webpInfo.size > MAX_WEBP_SIZE_BYTES) {
    throw new Error(`Output size ${webpInfo.size} exceeds budget of ${MAX_WEBP_SIZE_BYTES} bytes (900 KiB)`);
  }

  console.log(`PASS: kingdom-base-v5.webp successfully produced at ${webpInfo.width}x${webpInfo.height}, ${webpInfo.size} bytes (${(webpInfo.size / 1024).toFixed(1)} KiB)`);
}

processTerrainMaster().catch((err) => {
  console.error('Failed to process terrain master:', err);
  process.exit(1);
});
