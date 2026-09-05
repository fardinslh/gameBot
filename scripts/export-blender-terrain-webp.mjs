import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const masterInputPath = path.resolve('art-source', 'terrain', 'kingdom-blender-master.png');
const v6WebpPath = path.resolve('apps', 'game-client', 'public', 'assets', 'kingdom', 'terrain', 'kingdom-base-v6.webp');
const v5WebpPath = path.resolve('apps', 'game-client', 'public', 'assets', 'kingdom', 'terrain', 'kingdom-base-v5.webp');

const REQUIRED_MIN_WIDTH = 2048;
const REQUIRED_MIN_HEIGHT = 3072;
const MAX_WEBP_SIZE_BYTES = 900 * 1024; // 900 KiB

async function exportBlenderWebp() {
  if (!fs.existsSync(masterInputPath)) {
    throw new Error(`Master Blender render not found: ${masterInputPath}`);
  }

  const metadata = await sharp(masterInputPath).metadata();
  console.log('Blender master metadata:', {
    format: metadata.format,
    width: metadata.width,
    height: metadata.height,
  });

  if (metadata.width < REQUIRED_MIN_WIDTH || metadata.height < REQUIRED_MIN_HEIGHT) {
    throw new Error(`Dimensions ${metadata.width}x${metadata.height} below required ${REQUIRED_MIN_WIDTH}x${REQUIRED_MIN_HEIGHT}`);
  }

  fs.mkdirSync(path.dirname(v6WebpPath), { recursive: true });

  for (const targetPath of [v6WebpPath, v5WebpPath]) {
    const info = await sharp(masterInputPath)
      .removeAlpha()
      .webp({ quality: 85, effort: 6, smartSubsample: true })
      .toFile(targetPath);

    console.log(`Exported WebP to ${targetPath}:`, info);
    if (info.size > MAX_WEBP_SIZE_BYTES) {
      throw new Error(`Size ${info.size} exceeds budget ${MAX_WEBP_SIZE_BYTES}`);
    }
  }

  console.log('SUCCESS: Both v6 and v5 production WebP terrain assets exported cleanly!');
}

exportBlenderWebp().catch((err) => {
  console.error('WebP export failed:', err);
  process.exit(1);
});
