import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import process from 'node:process';
import { chromium } from 'playwright-core';

const root = new URL('../', import.meta.url);
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browserPath = existsSync(edgePath) ? edgePath : existsSync(chromePath) ? chromePath : undefined;
const nextCli = new URL('node_modules/next/dist/bin/next', root).pathname.slice(1);

const healthServer = createServer((request, response) => {
  response.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
  response.setHeader('Content-Type', 'application/json');
  response.statusCode = request.url === '/health' ? 200 : 404;
  response.end(request.url === '/health' ? '{"status":"ok"}' : '{"status":"not_found"}');
});

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

const client = startClient();
let browser;

try {
  await new Promise((resolve, reject) => {
    healthServer.once('error', reject);
    healthServer.listen(3001, resolve);
  });
  await waitForUrl('http://localhost:3000/?lang=en');
  browser = await chromium.launch({ executablePath: browserPath, headless: true });
  const page = await browser.newPage({ viewport: { width: 320, height: 740 } });
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto('http://localhost:3000/?lang=en', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-scene-status="ready"]');
  const buildingCount = await page.locator('.kingdom-scene__canvas').getAttribute('data-building-count');
  if (buildingCount !== '5') throw new Error(`Expected five Pixi buildings, found ${buildingCount ?? 'none'}`);

  const canvas = page.locator('.kingdom-canvas');
  const buildingPoints = [
    { id: 'castle', x: 160, y: 311 },
    { id: 'lumberMill', x: 74, y: 200 },
    { id: 'mine', x: 243, y: 207 },
    { id: 'farm', x: 74, y: 459 },
    { id: 'grandMarket', x: 234, y: 459 },
  ];

  for (const building of buildingPoints) {
    await canvas.click({ position: { x: building.x, y: building.y } });
    await page.waitForSelector(`[data-building-sheet="${building.id}"]`);
    await page.locator('.building-sheet .icon-button').click();
    await page.waitForFunction(() => document.querySelector('.building-sheet')?.getAttribute('aria-hidden') === 'true');
  }

  await page.locator('[data-nav-id="raid"]').click();
  await page.waitForSelector('.coming-soon-toast--visible');

  for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 812 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(150);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    if (overflow) throw new Error(`Horizontal overflow at ${viewport.width}x${viewport.height}`);
  }

  await page.goto('http://localhost:3000/?lang=fa', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-scene-status="ready"]');
  const direction = await page.locator('.game-viewport').getAttribute('dir');
  if (direction !== 'rtl') throw new Error('Persian layout did not switch to RTL');
  await page.locator('.kingdom-canvas').click({ position: { x: 195, y: 354 } });
  await page.waitForSelector('[data-building-sheet="castle"]');
  await page.waitForTimeout(300);

  mkdirSync(new URL('artifacts/', root), { recursive: true });
  await page.screenshot({ path: new URL('artifacts/phase-02-kingdom-fa.png', root).pathname.slice(1), fullPage: true });

  if (consoleErrors.length > 0) throw new Error(`Browser console errors: ${consoleErrors.join(' | ')}`);
  console.log('PASS Pixi scene + 5 interactive buildings');
  console.log('PASS detail sheet + coming-soon navigation');
  console.log('PASS 320/375/390 responsive + Persian RTL + browser console');
} finally {
  await browser?.close();
  client.kill();
  healthServer.close();
}
