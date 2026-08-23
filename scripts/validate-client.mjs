import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import process from 'node:process';
import { chromium } from 'playwright-core';

const root = new URL('../', import.meta.url);
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browserPath = existsSync(edgePath) ? edgePath : existsSync(chromePath) ? chromePath : undefined;
const nextCli = new URL('node_modules/next/dist/bin/next', root).pathname.slice(1);

function startClient() {
  return spawn(process.execPath, [nextCli, 'start', '--port', '3000'], {
    cwd: new URL('apps/game-client/', root),
    env: { ...process.env, NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function waitForUrl(url, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

if (!browserPath) throw new Error('No supported local Chromium browser was found');

let client;
let browser;

try {
  await waitForUrl('http://localhost:3001/health');
  try {
    await waitForUrl('http://localhost:3000/?lang=en', 1_000);
  } catch {
    client = startClient();
    await waitForUrl('http://localhost:3000/?lang=en');
  }
  browser = await chromium.launch({ executablePath: browserPath, headless: true });
  const page = await browser.newPage({ viewport: { width: 320, height: 740 } });
  const testPlayerId = `browser-validation-${Date.now()}`;
  await page.route('http://localhost:3001/**', (route) => route.continue({
    headers: { ...route.request().headers(), 'x-dev-player-id': testPlayerId },
  }));
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto('http://localhost:3000/?lang=en', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-scene-status="ready"]');
  await page.waitForSelector('.resource-hud__server');
  await page.waitForSelector('.collect-button');
  const buildingCount = await page.locator('.kingdom-scene__canvas').getAttribute('data-building-count');
  if (buildingCount !== '12') throw new Error(`Expected twelve Pixi buildings, found ${buildingCount ?? 'none'}`);
  if (await page.locator('.kingdom-scene__canvas').getAttribute('data-active-building-count') !== '5') throw new Error('Expected five active Pixi buildings');
  if (await page.locator('.kingdom-scene__canvas').getAttribute('data-future-building-count') !== '7') throw new Error('Expected seven future Pixi buildings');

  const canvas = page.locator('.kingdom-canvas');
  const buildingPoints = [
    { id: 'castle', x: 160, y: 345 },
    { id: 'mine', x: 110, y: 215 },
    { id: 'farm', x: 50, y: 504 },
    { id: 'lumberMill', x: 267, y: 501 },
    { id: 'grandMarket', x: 160, y: 596 },
  ];

  for (const building of buildingPoints) {
    await canvas.click({ position: { x: building.x, y: building.y } });
    await page.waitForSelector(`[data-building-sheet="${building.id}"]`);
    await page.locator('.building-sheet .icon-button').click();
    await page.waitForFunction(() => document.querySelector('.building-sheet')?.getAttribute('aria-hidden') === 'true');
  }

  await canvas.click({ position: { x: 159, y: 462 } });
  await page.waitForSelector('[data-locked-building="granary"]');
  await page.locator('.locked-building-sheet__close').click();
  await page.waitForFunction(() => document.querySelector('.locked-building-sheet')?.getAttribute('aria-hidden') === 'true');

  const balancesBeforeCollect = await page.locator('.resource-chip').evaluateAll((items) => items.map((item) => item.getAttribute('data-balance')));
  await page.waitForTimeout(8_000);
  await page.locator('.collect-button').click();
  await page.waitForSelector('.collect-feedback--visible');
  const balancesAfterCollect = await page.locator('.resource-chip').evaluateAll((items) => items.map((item) => item.getAttribute('data-balance')));
  if (balancesBeforeCollect.join('|') === balancesAfterCollect.join('|')) throw new Error('Collect did not update authoritative HUD balances');

  await page.locator('[data-nav-id="guild"]').click();
  await page.waitForSelector('.coming-soon-toast--visible');

  for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 812 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(150);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    if (overflow) throw new Error(`Horizontal overflow at ${viewport.width}x${viewport.height}`);
  }

  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('http://localhost:3000/?lang=fa', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-scene-status="ready"]');
  await page.waitForSelector('.collect-button');
  const direction = await page.locator('.game-viewport').getAttribute('dir');
  if (direction !== 'rtl') throw new Error('Persian layout did not switch to RTL');
  await page.locator('.kingdom-canvas').click({ position: { x: 110, y: 215 } });
  await page.waitForSelector('[data-building-sheet="mine"]');
  const levelBeforeUpgrade = Number(await page.locator('.building-sheet__stats strong').first().textContent());
  await page.locator('.upgrade-button').click();
  await page.waitForSelector('.upgrade-preview--active');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-scene-status="ready"]');
  await page.waitForSelector('.collect-button');
  await page.locator('.kingdom-canvas').click({ position: { x: 110, y: 215 } });
  await page.waitForSelector('[data-building-sheet="mine"]');
  await page.waitForSelector('.upgrade-preview--active');

  mkdirSync(new URL('artifacts/', root), { recursive: true });
  await page.screenshot({ path: new URL('artifacts/phase-03-kingdom-fa.png', root).pathname.slice(1), fullPage: true });

  await page.waitForTimeout(8_000);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-scene-status="ready"]');
  await page.waitForSelector('.collect-button');
  await page.locator('.kingdom-canvas').click({ position: { x: 110, y: 215 } });
  const levelAfterUpgrade = Number(await page.locator('.building-sheet__stats strong').first().textContent());
  if (levelAfterUpgrade !== levelBeforeUpgrade + 1) throw new Error('Server did not reconcile the completed upgrade exactly once');

  if (consoleErrors.length > 0) throw new Error(`Browser console errors: ${consoleErrors.join(' | ')}`);
  console.log('PASS expanded Pixi scene + 5 active and 7 locked interactive buildings');
  console.log('PASS server-backed Collect + persisted upgrade timer/completion');
  console.log('PASS detail sheet + coming-soon navigation');
  console.log('PASS 320/375/390 responsive + Persian RTL + browser console');
} finally {
  await browser?.close();
  client?.kill();
}
