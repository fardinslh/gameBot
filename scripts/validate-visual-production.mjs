import { existsSync, mkdirSync, statSync } from 'node:fs';
import { chromium } from 'playwright-core';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browserPath = existsSync(edgePath) ? edgePath : existsSync(chromePath) ? chromePath : undefined;
if (!browserPath) throw new Error('No supported local Chromium browser was found');

async function waitForUrl(url, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { const response = await fetch(url); if (response.ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

await waitForUrl('http://localhost:3001/health');
await waitForUrl('http://localhost:3000/?lang=fa');
const browser = await chromium.launch({ executablePath: browserPath, headless: true });
const root = new URL('../', import.meta.url);
const artifacts = new URL('artifacts/', root);
mkdirSync(artifacts, { recursive: true });
const consoleErrors = [];
const identity = `phase065-browser-${Date.now()}`;

async function attach(page) {
  await page.route('http://localhost:3001/**', (route) => route.continue({ headers: { ...route.request().headers(), 'x-dev-player-id': identity } }));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(error.stack ?? error.message));
}

async function clickWorldBuilding(page, worldX, worldY) {
  const host = page.locator('.kingdom-scene__canvas');
  const canvas = page.locator('.kingdom-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Kingdom canvas has no layout box');
  const cameraY = Number(await host.getAttribute('data-camera-y'));
  const scale = box.width / 640;
  await canvas.click({ position: { x: worldX * scale, y: worldY * scale + cameraY } });
}

try {
  const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
  await attach(page);
  await page.goto('http://localhost:3000/?lang=fa', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-scene-status="ready"]');
  await page.waitForTimeout(800);
  const canvasHost = page.locator('.kingdom-scene__canvas');
  const counts = await canvasHost.evaluate((element) => ({ ...element.dataset }));
  if (counts.activeBuildingCount !== '5' || counts.futureBuildingCount !== '0' || counts.buildingCount !== '5' || counts.districtCount || counts.panEnabled !== 'true') throw new Error(`Simplified world metadata is invalid: ${JSON.stringify(counts)}`);
  await page.screenshot({ path: new URL('phase-06-5-kingdom-after-fa-320.png', artifacts).pathname.slice(1) });
  await page.screenshot({ path: new URL('phase-06-6-simplified-after-fa-320.png', artifacts).pathname.slice(1) });

  const canvas = page.locator('.kingdom-canvas');
  const cameraBefore = Number(await canvasHost.getAttribute('data-camera-y'));
  await page.mouse.move(160, 390);
  await page.mouse.down();
  await page.mouse.move(160, 170, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  const cameraAfter = Number(await canvasHost.getAttribute('data-camera-y'));
  if (!(cameraAfter < cameraBefore)) throw new Error(`Bounded camera did not pan: before=${cameraBefore}, after=${cameraAfter}`);
  await page.screenshot({ path: new URL('phase-06-5-outer-district-fa-320.png', artifacts).pathname.slice(1) });
  await page.screenshot({ path: new URL('phase-06-6-simplified-lower-fa-320.png', artifacts).pathname.slice(1) });

  await clickWorldBuilding(page, 320, 1172);
  await page.waitForSelector('[data-building-sheet="grandMarket"]');
  await page.waitForTimeout(320);
  await page.screenshot({ path: new URL('phase-06-5-active-building-detail-fa-320.png', artifacts).pathname.slice(1) });
  await page.locator('.building-sheet .icon-button').click();

  await page.mouse.move(160, 170);
  await page.mouse.down();
  await page.mouse.move(160, 480, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  await page.screenshot({ path: new URL('phase-06-5-military-district-fa-320.png', artifacts).pathname.slice(1) });
  await page.screenshot({ path: new URL('phase-06-6-simplified-upper-fa-320.png', artifacts).pathname.slice(1) });
  await page.close();

  for (const locale of ['en', 'fa']) {
    for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 812 }, { width: 390, height: 844 }]) {
      const layoutPage = await browser.newPage({ viewport });
      await attach(layoutPage);
      await layoutPage.goto(`http://localhost:3000/?lang=${locale}`, { waitUntil: 'domcontentloaded' });
      await layoutPage.waitForSelector('[data-scene-status="ready"]');
      const dimensions = await layoutPage.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        navHeight: document.querySelector('.bottom-navigation')?.getBoundingClientRect().height,
        direction: document.querySelector('.game-viewport')?.getAttribute('dir'),
        world: { ...document.querySelector('.kingdom-scene__canvas')?.dataset },
      }));
      if (dimensions.overflow) throw new Error(`Horizontal overflow at ${locale} ${viewport.width}x${viewport.height}`);
      if (dimensions.navHeight !== 54) throw new Error(`Bottom navigation changed at ${locale} ${viewport.width}x${viewport.height}`);
      if (dimensions.direction !== (locale === 'fa' ? 'rtl' : 'ltr')) throw new Error(`Direction failed for ${locale}`);
      if (dimensions.world.buildingCount !== '5' || dimensions.world.futureBuildingCount !== '0') throw new Error(`World failed at ${locale} ${viewport.width}x${viewport.height}`);
      await layoutPage.close();
    }
  }

  const terrainBytes = statSync(new URL('apps/game-client/public/assets/kingdom/terrain/kingdom-base-v3.webp', root)).size;
  const castleBytes = statSync(new URL('apps/game-client/public/assets/kingdom/castle-production-v1.webp', root)).size;
  if (terrainBytes > 700_000 || castleBytes > 150_000) throw new Error(`Visual assets exceed mobile budget: terrain=${terrainBytes}, castle=${castleBytes}`);
  if (consoleErrors.length) throw new Error(`Browser console errors: ${consoleErrors.join(' | ')}`);
  console.log('PASS simplified five-building Kingdom + bounded mobile pan + active interactions');
  console.log('PASS 320x568, 375x812, 390x844 in English LTR and Persian RTL with unchanged 54px navigation');
  console.log(`PASS local WebP budget terrain=${terrainBytes}B castle=${castleBytes}B and clean browser console`);
} finally {
  await browser.close();
}
