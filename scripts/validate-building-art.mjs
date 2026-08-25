import { existsSync, mkdirSync, statSync } from 'node:fs';
import { chromium } from 'playwright-core';

const browserPath = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find(existsSync);
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
const identity = `building-art-${Date.now()}`;
const WORLD_WIDTH = 640;

async function openPage(viewport, locale = 'fa', debugBuildingLayout = false, debugKingdomLayers = '') {
  const page = await browser.newPage({ viewport });
  await page.route('http://localhost:3001/**', (route) => route.continue({ headers: { ...route.request().headers(), 'x-dev-player-id': identity } }));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(error.stack ?? error.message));
  await page.goto(`http://localhost:3000/?lang=${locale}${debugBuildingLayout ? '&debugBuildingLayout=1' : ''}${debugKingdomLayers ? `&debugKingdomLayers=${debugKingdomLayers}` : ''}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-scene-status="ready"]');
  await page.waitForTimeout(600);
  return page;
}

async function moveWorldBuilding(page, worldY, targetCanvasY) {
  const host = page.locator('.kingdom-scene__canvas');
  const canvas = page.locator('.kingdom-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Kingdom canvas has no layout box');
  const cameraY = Number(await host.getAttribute('data-camera-y'));
  const scale = box.width / WORLD_WIDTH;
  const desiredCamera = targetCanvasY - worldY * scale;
  const dragY = Math.max(-260, Math.min(260, desiredCamera - cameraY));
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + dragY, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(180);
}

async function clickBuilding(page, worldX, worldY) {
  const host = page.locator('.kingdom-scene__canvas');
  const canvas = page.locator('.kingdom-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Kingdom canvas has no layout box');
  const cameraY = Number(await host.getAttribute('data-camera-y'));
  const scale = box.width / WORLD_WIDTH;
  await page.mouse.click(box.x + worldX * scale, box.y + worldY * scale + cameraY);
}

try {
  const main = await openPage({ width: 320, height: 568 });
  const host = main.locator('.kingdom-scene__canvas');
  const metadata = await host.evaluate((element) => ({ ...element.dataset }));
  if (metadata.activeBuildingCount !== '5' || metadata.futureBuildingCount !== '0' || metadata.buildingCount !== '5' || metadata.districtCount) {
    throw new Error(`Building art metadata is invalid: ${JSON.stringify(metadata)}`);
  }
  await main.screenshot({ path: new URL('phase-building-art-after-fa-320.png', artifacts).pathname.slice(1) });
  await main.screenshot({ path: new URL('phase-06-6-simplified-fa-320.png', artifacts).pathname.slice(1) });
  await main.screenshot({ path: new URL('phase-clean-base-final-320.png', artifacts).pathname.slice(1) });
  await clickBuilding(main, 320, 690);
  await main.waitForSelector('[data-building-sheet="castle"]');
  await main.locator('.building-sheet .icon-button').click();
  await main.close();

  const active = [
    { id: 'farm', x: 88, y: 958 },
    { id: 'lumberMill', x: 552, y: 958 },
    { id: 'mine', x: 145, y: 365 },
    { id: 'grandMarket', x: 320, y: 1172 },
  ];
  for (const building of active) {
    const page = await openPage({ width: 320, height: 568 });
    await moveWorldBuilding(page, building.y, 300);
    await clickBuilding(page, building.x, building.y);
    await page.waitForTimeout(260);
    const selectedId = await page.locator('.building-sheet').getAttribute('data-building-sheet');
    if (selectedId !== building.id) throw new Error(`Expected ${building.id} selection, received ${selectedId ?? 'none'}`);
    await page.screenshot({ path: new URL(`phase-building-art-${building.id}-selected-fa-320.png`, artifacts).pathname.slice(1) });
    await page.close();
  }

  const upper = await openPage({ width: 320, height: 568 });
  await moveWorldBuilding(upper, 0, 400);
  const upperCamera = await upper.locator('.kingdom-scene__canvas').evaluate((element) => ({
    current: Number(element.dataset.cameraY),
    maximum: Number(element.dataset.cameraMaxY),
  }));
  if (upperCamera.maximum < 0 || Math.abs(upperCamera.current - upperCamera.maximum) > 2) {
    throw new Error(`HUD-safe upper camera bound failed: ${JSON.stringify(upperCamera)}`);
  }
  await upper.screenshot({ path: new URL('phase-06-6-simplified-upper-fa-320.png', artifacts).pathname.slice(1) });
  await upper.close();

  for (const locale of ['en', 'fa']) {
    for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 812 }, { width: 390, height: 844 }]) {
      const page = await openPage(viewport, locale);
      const dimensions = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        navHeight: document.querySelector('.bottom-navigation')?.getBoundingClientRect().height,
        direction: document.querySelector('.game-viewport')?.getAttribute('dir'),
      }));
      if (dimensions.overflow) throw new Error(`Horizontal overflow at ${locale} ${viewport.width}x${viewport.height}`);
      if (dimensions.navHeight !== 54) throw new Error(`Bottom navigation changed at ${locale} ${viewport.width}x${viewport.height}`);
      if (dimensions.direction !== (locale === 'fa' ? 'rtl' : 'ltr')) throw new Error(`Direction failed for ${locale}`);
      if (locale === 'fa' && viewport.width === 390) {
        await page.screenshot({ path: new URL('phase-building-art-expanded-fa-390.png', artifacts).pathname.slice(1) });
        await page.screenshot({ path: new URL('phase-06-6-simplified-fa-390.png', artifacts).pathname.slice(1) });
        await page.screenshot({ path: new URL('phase-clean-base-final-390.png', artifacts).pathname.slice(1) });
      }
      await page.close();
    }
  }

  const desktop = await openPage({ width: 710, height: 650 });
  await moveWorldBuilding(desktop, 0, 500);
  await moveWorldBuilding(desktop, 0, 500);
  const desktopUpperCamera = await desktop.locator('.kingdom-scene__canvas').evaluate((element) => ({
    current: Number(element.dataset.cameraY),
    maximum: Number(element.dataset.cameraMaxY),
  }));
  if (desktopUpperCamera.maximum < 0 || Math.abs(desktopUpperCamera.current - desktopUpperCamera.maximum) > 2) {
    throw new Error(`Desktop HUD-safe upper camera bound failed: ${JSON.stringify(desktopUpperCamera)}`);
  }
  await desktop.screenshot({ path: new URL('phase-building-layout-upper-desktop-710.png', artifacts).pathname.slice(1) });
  await desktop.screenshot({ path: new URL('phase-06-6-simplified-upper-desktop-710.png', artifacts).pathname.slice(1) });
  for (let step = 0; step < 3; step += 1) await moveWorldBuilding(desktop, 1190, 380);
  await desktop.screenshot({ path: new URL('phase-building-layout-lower-desktop-710.png', artifacts).pathname.slice(1) });
  await desktop.screenshot({ path: new URL('phase-06-6-simplified-lower-desktop-710.png', artifacts).pathname.slice(1) });
  await desktop.close();

  const debugDesktop = await openPage({ width: 710, height: 650 }, 'fa', true);
  if (await debugDesktop.locator('.kingdom-scene__canvas').getAttribute('data-debug-building-layout') !== 'true') {
    throw new Error('Building placement debug overlay did not activate');
  }
  await moveWorldBuilding(debugDesktop, 0, 500);
  await moveWorldBuilding(debugDesktop, 0, 500);
  await debugDesktop.screenshot({ path: new URL('phase-placement-upper-debug-710.png', artifacts).pathname.slice(1) });
  for (let step = 0; step < 3; step += 1) await moveWorldBuilding(debugDesktop, 1190, 380);
  await debugDesktop.screenshot({ path: new URL('phase-placement-lower-debug-710.png', artifacts).pathname.slice(1) });
  await debugDesktop.close();

  const terrainOnly = await openPage({ width: 390, height: 844 }, 'fa', false, 'terrain');
  if (await terrainOnly.locator('.kingdom-scene__canvas').getAttribute('data-debug-kingdom-layers') !== 'terrain') {
    throw new Error('Terrain-only capture mode did not activate');
  }
  await terrainOnly.screenshot({ path: new URL('phase-clean-base-terrain-only-390.png', artifacts).pathname.slice(1) });
  await terrainOnly.close();

  const castleOnly = await openPage({ width: 390, height: 844 }, 'fa', false, 'castle');
  if (await castleOnly.locator('.kingdom-scene__canvas').getAttribute('data-debug-kingdom-layers') !== 'castle') {
    throw new Error('Castle-only capture mode did not activate');
  }
  await castleOnly.screenshot({ path: new URL('phase-clean-base-castle-only-390.png', artifacts).pathname.slice(1) });
  await castleOnly.close();

  const assetNames = ['farm', 'lumber-mill', 'mine', 'grand-market', 'barracks', 'blacksmith', 'academy', 'granary', 'watchtower', 'workshop', 'stable', 'tavern'];
  const assetSizes = Object.fromEntries(assetNames.map((name) => [name, statSync(new URL(`apps/game-client/public/assets/kingdom/buildings/${name}-stage-1.webp`, root)).size]));
  if (Object.values(assetSizes).some((bytes) => bytes > 200_000)) throw new Error(`Building asset exceeds 200KB: ${JSON.stringify(assetSizes)}`);
  if (consoleErrors.length) throw new Error(`Browser console errors: ${consoleErrors.join(' | ')}`);
  console.log('PASS five-building Castle-level-one Kingdom and all active selections');
  console.log('PASS 320x568, 375x812, 390x844 in English LTR and Persian RTL with unchanged 54px navigation');
  console.log(`PASS optimized local WebP assets: ${JSON.stringify(assetSizes)}`);
} finally {
  await browser.close();
}
