import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const browserPath = [
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find(existsSync);

if (!browserPath) throw new Error('No supported local Chromium browser was found');

const outputDir = path.resolve('artifacts', 'terrain-clean');
mkdirSync(outputDir, { recursive: true });

const viewports = [
  { width: 320, height: 568 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
];
const locales = ['en', 'fa'];
const zooms = [1, 2];

async function runCaptures() {
  const browser = await chromium.launch({
    executablePath: browserPath,
    headless: true,
  });

  const captures = [];

  try {
    // 1. Capture Kingdom with buildings mounted (fa/en, 3 viewports, 100% and 200%)
    for (const locale of locales) {
      for (const vp of viewports) {
        for (const zoom of zooms) {
          const context = await browser.newContext({
            viewport: vp,
            deviceScaleFactor: zoom,
          });
          const page = await context.newPage();
          const playerId = `capture-clean-${locale}-${vp.width}-${zoom}`;
          await page.route('http://localhost:3001/**', (route) =>
            route.continue({
              headers: { ...route.request().headers(), 'x-dev-player-id': playerId },
            })
          );

          await page.goto(`http://localhost:3000/?lang=${locale}`, { waitUntil: 'domcontentloaded' });
          await page.waitForSelector('[data-scene-status="ready"] canvas');
          await page.waitForTimeout(600);

          const filename = `kingdom-${locale}-${vp.width}x${vp.height}-${zoom * 100}pct.png`;
          const filePath = path.join(outputDir, filename);
          await page.screenshot({ path: filePath });
          captures.push(filename);
          console.log(`Captured: ${filename}`);
          await context.close();
        }
      }
    }

    // 2. Capture terrain-only registration (?debugKingdomLayers=terrain)
    {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
      });
      const page = await context.newPage();
      await page.route('http://localhost:3001/**', (route) =>
        route.continue({
          headers: { ...route.request().headers(), 'x-dev-player-id': 'capture-registration' },
        })
      );
      await page.goto('http://localhost:3000/?lang=en&debugKingdomLayers=terrain', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-scene-status="ready"] canvas');
      await page.waitForTimeout(600);

      const filename = 'terrain-registration-debug.png';
      const filePath = path.join(outputDir, filename);
      await page.screenshot({ path: filePath });
      captures.push(filename);
      console.log(`Captured: ${filename}`);
      await context.close();
    }

    // 3. Capture v3 vs v5 side-by-side at 390x844
    {
      // Capture v5 baseline
      const ctxV5 = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
      });
      const pageV5 = await ctxV5.newPage();
      await pageV5.route('http://localhost:3001/**', (route) =>
        route.continue({
          headers: { ...route.request().headers(), 'x-dev-player-id': 'capture-v5-side' },
        })
      );
      await pageV5.goto('http://localhost:3000/?lang=en', { waitUntil: 'domcontentloaded' });
      await pageV5.waitForSelector('[data-scene-status="ready"] canvas');
      await pageV5.waitForTimeout(600);
      const v5Buffer = await pageV5.screenshot();
      await ctxV5.close();

      // Capture v3 by routing the v5 request to serve v3
      const ctxV3 = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
      });
      const pageV3 = await ctxV3.newPage();
      const v3WebpPath = path.resolve('apps', 'game-client', 'public', 'assets', 'kingdom', 'terrain', 'kingdom-base-v3.webp');
      const v3BufferBytes = readFileSync(v3WebpPath);
      await pageV3.route('**/kingdom-base-v5.webp', (route) =>
        route.fulfill({
          body: v3BufferBytes,
          contentType: 'image/webp',
        })
      );
      await pageV3.route('http://localhost:3001/**', (route) =>
        route.continue({
          headers: { ...route.request().headers(), 'x-dev-player-id': 'capture-v3-side' },
        })
      );
      await pageV3.goto('http://localhost:3000/?lang=en', { waitUntil: 'domcontentloaded' });
      await pageV3.waitForSelector('[data-scene-status="ready"] canvas');
      await pageV3.waitForTimeout(600);
      const v3Buffer = await pageV3.screenshot();
      await ctxV3.close();

      // Stitch side-by-side with sharp
      const v5Meta = await sharp(v5Buffer).metadata();
      const v3Meta = await sharp(v3Buffer).metadata();

      const combinedWidth = (v3Meta.width || 780) + (v5Meta.width || 780);
      const combinedHeight = Math.max(v3Meta.height || 1688, v5Meta.height || 1688);

      const sideBySideFilename = 'side-by-side-v3-vs-v5-390x844.png';
      const sideBySidePath = path.join(outputDir, sideBySideFilename);

      await sharp({
        create: {
          width: combinedWidth,
          height: combinedHeight,
          channels: 4,
          background: { r: 15, g: 18, b: 15, alpha: 1 },
        },
      })
        .composite([
          { input: v3Buffer, left: 0, top: 0 },
          { input: v5Buffer, left: v3Meta.width || 780, top: 0 },
        ])
        .png()
        .toFile(sideBySidePath);

      captures.push(sideBySideFilename);
      console.log(`Captured: ${sideBySideFilename}`);
    }
  } finally {
    await browser.close();
  }

  console.log('\nAll captures successfully generated under artifacts/terrain-clean/:');
  captures.forEach((c) => console.log(` - ${c}`));
}

runCaptures().catch((err) => {
  console.error('Capture script failed:', err);
  process.exit(1);
});
