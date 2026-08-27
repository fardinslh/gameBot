import { existsSync, mkdirSync } from 'node:fs';
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

await waitForUrl('http://localhost:3000/dev/buildings');
await waitForUrl('http://localhost:3001/health');
const browser = await chromium.launch({ executablePath: browserPath, headless: true });
const root = new URL('../', import.meta.url);
const artifacts = new URL('artifacts/building-evolution/', root);
mkdirSync(artifacts, { recursive: true });
const errors = [];
const buildings = [
  ['castle', 'Castle'],
  ['farm', 'Farm'],
  ['lumberMill', 'Lumber Mill'],
  ['mine', 'Mine'],
  ['grandMarket', 'Grand Market'],
];
const levels = [1, 5, 9, 13, 17, 20];
const snapshotSet = process.argv.find((argument) => argument.startsWith('--snapshot-set='))?.split('=')[1];
const representativeStates = [
  ['castle', 1],
  ['castle', 20],
  ['farm', 7],
  ['mine', 13],
  ['grandMarket', 20],
];

try {
  const lab = await browser.newPage({ viewport: { width: 900, height: 760 }, deviceScaleFactor: 1 });
  lab.on('console', (message) => { if (message.type() === 'error') errors.push(`lab console: ${message.text()}`); });
  lab.on('pageerror', (error) => errors.push(`lab page: ${error.stack ?? error.message}`));
  await lab.goto('http://localhost:3000/dev/buildings', { waitUntil: 'domcontentloaded' });
  await lab.waitForSelector('[data-visual-state]');
  const activeTheme = await lab.locator('main').getAttribute('data-kingdom-theme');
  if (activeTheme !== 'DEFAULT') throw new Error(`Building Lab theme mismatch: ${activeTheme}`);
  for (const [buildingId, label] of buildings) {
    await lab.locator('select').selectOption(buildingId);
    for (const level of levels) {
      await lab.getByRole('button', { name: String(level), exact: true }).click();
      const expectedTier = level < 5 ? 'EARLY' : level < 9 ? 'DEVELOPED' : level < 13 ? 'ADVANCED' : level < 17 ? 'FORTIFIED' : 'PRESTIGE';
      await lab.waitForFunction(
        ({ expectedTier, level }) => document.querySelector('[data-visual-state]')?.getAttribute('data-visual-state')?.startsWith(`${expectedTier}:${(level - 1) % 4}:`),
        { expectedTier, level },
      );
      await lab.waitForTimeout(140);
      await lab.locator('article').first().screenshot({ path: new URL(`${buildingId}-level-${level}.png`, artifacts).pathname.slice(1) });
    }
    console.log(`CAPTURED ${label}: ${levels.join(', ')}`);
  }
  if (snapshotSet) {
    for (const [buildingId, level] of representativeStates) {
      await lab.locator('select').selectOption(String(buildingId));
      await lab.locator('input[type="range"]').fill(String(level));
      await lab.waitForFunction(
        (expectedLevel) => document.querySelector('article header span')?.textContent === `Level ${expectedLevel}`,
        level,
      );
      await lab.waitForTimeout(140);
      await lab.locator('article').first().screenshot({
        path: new URL(`${snapshotSet}-${buildingId}-level-${level}.png`, artifacts).pathname.slice(1),
      });
    }
  }
  await lab.getByRole('button', { name: '1 vs 20' }).click();
  for (const [buildingId] of buildings) {
    await lab.locator('select').selectOption(buildingId);
    await lab.waitForSelector('[data-visual-state="EARLY:0:standard"]');
    await lab.waitForSelector('[data-visual-state="PRESTIGE:3:capstone"]');
    await lab.locator('section').filter({ has: lab.locator('article') }).last().screenshot({ path: new URL(`${buildingId}-comparison-1-vs-20.png`, artifacts).pathname.slice(1) });
  }
  await lab.close();

  const identity = `retention-01a-${Date.now()}`;
  await fetch('http://localhost:3001/onboarding/skip', { method: 'POST', headers: { 'x-dev-player-id': identity } });
  for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 812 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    await page.route('http://localhost:3001/**', (route) => route.continue({ headers: { ...route.request().headers(), 'x-dev-player-id': identity } }));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(`${viewport.width} console: ${message.text()}`); });
    page.on('pageerror', (error) => errors.push(`${viewport.width} page: ${error.stack ?? error.message}`));
    await page.goto('http://localhost:3000/?lang=fa', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-scene-status="ready"]');
    await page.waitForTimeout(650);
    const layout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      navHeight: document.querySelector('.bottom-navigation')?.getBoundingClientRect().height,
      scene: { ...document.querySelector('.kingdom-scene__canvas')?.dataset },
    }));
    if (layout.overflow) throw new Error(`Horizontal overflow at ${viewport.width}x${viewport.height}`);
    if (layout.navHeight !== 54) throw new Error(`Navigation height changed at ${viewport.width}x${viewport.height}: ${layout.navHeight}`);
    if (layout.scene.buildingCount !== '5') throw new Error(`Kingdom building count failed: ${JSON.stringify(layout.scene)}`);
    await page.screenshot({ path: new URL(`kingdom-fa-${viewport.width}x${viewport.height}.png`, artifacts).pathname.slice(1) });
    await page.close();
  }
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('PASS Building Evolution Lab captures and 320x568, 375x812, 390x844 Kingdom validation');
} finally {
  await browser.close();
}
