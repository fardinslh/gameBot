import { existsSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const browserPath = ['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].find(existsSync);
if (!browserPath) throw new Error('No supported local Chromium browser was found');
const artifacts = new URL('../artifacts/zoom-quality/', import.meta.url);
mkdirSync(fileURLToPath(artifacts), { recursive: true });
const browser = await chromium.launch({ executablePath: browserPath, headless: true });
const rows = [];

try {
  for (const dpr of [1, 1.25, 1.5, 2, 3]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: dpr });
    const page = await context.newPage();
    const errors = [];
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('http://localhost:3001/**', (route) => route.continue({ headers: { ...route.request().headers(), 'x-dev-player-id': `render-quality-${dpr}` } }));
    await page.goto('http://localhost:3000/?lang=en', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-scene-status="ready"] canvas');
    await page.waitForTimeout(250);
    rows.push(await measure(page, dpr, 'initial'));
    await page.setViewportSize({ width: 320, height: 568 });
    await page.waitForTimeout(150);
    rows.push(await measure(page, dpr, 'resize'));
    if (errors.length) throw new Error(`Console errors at DPR ${dpr}: ${errors.join(' | ')}`);
    await context.close();
  }
} finally {
  await browser.close();
}

await writeFile(fileURLToPath(new URL('renderer-resolution-matrix.json', artifacts)), `${JSON.stringify(rows, null, 2)}\n`);
console.table(rows);
console.log('PASS renderer CSS/logical/physical sizes and capped live DPR resolution matrix');

async function measure(page, requestedDpr, phase) {
  const metrics = await page.locator('.kingdom-scene__canvas').evaluate((host) => {
    const canvas = host.querySelector('canvas');
    const rect = canvas?.getBoundingClientRect();
    return {
      cssSize: rect ? `${Math.round(rect.width)}x${Math.round(rect.height)}` : '',
      logicalSize: host.getAttribute('data-renderer-logical-size'),
      physicalSize: canvas ? `${canvas.width}x${canvas.height}` : '',
      resolution: Number(host.getAttribute('data-renderer-resolution')),
      devicePixelRatio: window.devicePixelRatio,
    };
  });
  const [cssWidth, cssHeight] = metrics.cssSize.split('x').map(Number);
  const [physicalWidth, physicalHeight] = metrics.physicalSize.split('x').map(Number);
  const expectedResolution = Math.min(Math.max(metrics.devicePixelRatio, 1), 2);
  if (Math.abs(metrics.resolution - expectedResolution) > .001
    || physicalWidth !== Math.round(cssWidth * expectedResolution)
    || physicalHeight !== Math.round(cssHeight * expectedResolution)) {
    throw new Error(`Resolution mismatch: ${JSON.stringify({ requestedDpr, phase, ...metrics })}`);
  }
  return { requestedDpr, phase, ...metrics };
}
