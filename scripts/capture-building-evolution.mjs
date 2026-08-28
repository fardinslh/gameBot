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
const kingdomOnly = process.argv.includes('--kingdom-only');
const representativeStates = [
  ['castle', 1],
  ['castle', 20],
  ['farm', 7],
  ['mine', 13],
  ['grandMarket', 20],
];
const fidelityStates = [
  ['castle', 20],
  ['farm', 20],
  ['lumberMill', 20],
  ['mine', 20],
  ['grandMarket', 20],
];
const statusBuildings = ['castle', 'farm', 'lumberMill', 'mine', 'grandMarket', 'academy', 'blacksmith', 'watchtower', 'workshop'];
const statusStates = ['normal', 'upgrade', 'active', 'selected'];
const isDevLabStrictTeardownError = (error) => error.message.includes("Cannot read properties of null (reading 'geometry')")
  && (error.stack ?? '').includes('_BatcherPipe.execute');

try {
  if (!kingdomOnly) {
  let lab = await browser.newPage({ viewport: { width: 900, height: 760 }, deviceScaleFactor: 1 });
  const labConsoleHandler = (message) => { if (message.type() === 'error') errors.push(`lab console: ${message.text()}`); };
  const labPageErrorHandler = (error) => {
    if (!isDevLabStrictTeardownError(error)) errors.push(`lab page: ${error.stack ?? error.message}`);
  };
  lab.on('console', labConsoleHandler);
  lab.on('pageerror', labPageErrorHandler);
  await lab.goto('http://localhost:3000/dev/buildings', { waitUntil: 'domcontentloaded' });
  await lab.waitForSelector('[data-visual-state]');
  const activeTheme = await lab.locator('main').getAttribute('data-kingdom-theme');
  if (activeTheme !== 'DEFAULT') throw new Error(`Building Lab theme mismatch: ${activeTheme}`);
  for (const [buildingId, label] of buildings) {
    await lab.locator('select').nth(0).selectOption(buildingId);
    for (const level of levels) {
      await lab.getByRole('button', { name: String(level), exact: true }).click();
      const expectedTier = level < 5 ? 'EARLY' : level < 9 ? 'DEVELOPED' : level < 13 ? 'ADVANCED' : level < 17 ? 'FORTIFIED' : 'PRESTIGE';
      await lab.waitForFunction(
        ({ buildingId, expectedTier, level }) => [...document.querySelectorAll('[data-building-id]')].some((element) => (
          element.getAttribute('data-building-id') === buildingId
          && element.getAttribute('data-building-level') === String(level)
          && element.getAttribute('data-visual-state')?.startsWith(`${expectedTier}:${(level - 1) % 4}:`)
        )),
        { buildingId, expectedTier, level },
      );
      await lab.waitForTimeout(140);
      await lab.locator('article').first().screenshot({ path: new URL(`${buildingId}-level-${level}.png`, artifacts).pathname.slice(1) });
    }
    console.log(`CAPTURED ${label}: ${levels.join(', ')}`);
  }
  if (snapshotSet) {
    for (const [buildingId, level] of representativeStates) {
      await lab.locator('select').nth(0).selectOption(String(buildingId));
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
    await lab.getByRole('button', { name: '150%' }).click();
    await lab.locator('select').nth(0).selectOption('castle');
    await lab.locator('input[type="range"]').fill('20');
    await lab.waitForFunction(() => [...document.querySelectorAll('[data-building-id]')].some((element) => (
      element.getAttribute('data-building-id') === 'castle'
      && element.getAttribute('data-building-level') === '20'
    )));
    await lab.waitForTimeout(140);
    await lab.locator('article').first().screenshot({
      path: new URL(`${snapshotSet}-castle-level-20-150.png`, artifacts).pathname.slice(1),
    });
    await lab.getByRole('button', { name: '200%' }).click();
    for (const [buildingId, level] of fidelityStates) {
      await lab.locator('select').nth(0).selectOption(String(buildingId));
      await lab.locator('input[type="range"]').fill(String(level));
      await lab.waitForFunction(
        ({ buildingId, level }) => [...document.querySelectorAll('[data-building-id]')].some((element) => (
          element.getAttribute('data-building-id') === buildingId
          && element.getAttribute('data-building-level') === String(level)
        )),
        { buildingId, level },
      );
      await lab.waitForTimeout(140);
      await lab.locator('article').first().screenshot({
        path: new URL(`${snapshotSet}-${buildingId}-level-${level}-200.png`, artifacts).pathname.slice(1),
      });
    }
    await lab.waitForFunction(() => document.querySelectorAll('[data-badge-levels="1,8,12,20"]').length === 3);
    for (const statusBuilding of statusBuildings) {
      await lab.locator('select').nth(1).selectOption(statusBuilding);
      for (const statusState of statusStates) {
        await lab.getByRole('button', { name: statusState, exact: true }).click();
        await lab.waitForFunction(({ statusBuilding, statusState }) => {
          const fixture = document.querySelector('[data-status-building]');
          return fixture?.getAttribute('data-status-building') === statusBuilding
            && fixture.getAttribute('data-status-state') === statusState
            && fixture.getAttribute('data-status-overlap') === 'false'
            && fixture.getAttribute('data-status-stack-aligned') === 'true';
        }, { statusBuilding, statusState });
      }
    }
    await lab.locator('select').nth(1).selectOption('castle');
    await lab.getByRole('button', { name: 'upgrade', exact: true }).click();
    await lab.waitForFunction(() => document.querySelector('[data-status-building="castle"]')?.getAttribute('data-status-stack-aligned') === 'true');
    await lab.getByLabel('Production building badge checks').screenshot({
      path: new URL(`${snapshotSet}-badge-viewport-matrix.png`, artifacts).pathname.slice(1),
    });
  }
  // Release the many sequential Pixi inspection runtimes before rendering the
  // side-by-side matrix. Large fidelity textures otherwise make this transition
  // timing-dependent in headless Chromium.
  lab.off('console', labConsoleHandler);
  lab.off('pageerror', labPageErrorHandler);
  await lab.close();
  for (const [buildingId] of buildings) {
    lab = await browser.newPage({ viewport: { width: 900, height: 760 }, deviceScaleFactor: 1 });
    const comparisonConsoleHandler = (message) => { if (message.type() === 'error') errors.push(`lab comparison console: ${message.text()}`); };
    const comparisonPageErrorHandler = (error) => {
      if (!isDevLabStrictTeardownError(error)) errors.push(`lab comparison page: ${error.stack ?? error.message}`);
    };
    lab.on('console', comparisonConsoleHandler);
    lab.on('pageerror', comparisonPageErrorHandler);
    await lab.goto('http://localhost:3000/dev/buildings', { waitUntil: 'domcontentloaded' });
    await lab.waitForSelector('[data-visual-state]');
    await lab.locator('select').nth(0).selectOption(buildingId);
    await lab.getByRole('button', { name: '1 vs 20' }).click();
    await lab.waitForFunction(({ expectedBuildingId }) => {
      const previews = [...document.querySelectorAll(`[data-building-id="${expectedBuildingId}"]`)];
      const levels = previews.map((element) => element.getAttribute('data-building-level'));
      return levels.includes('1') && levels.includes('20');
    }, { expectedBuildingId: buildingId });
    await lab.locator('section').filter({ has: lab.locator('article') }).last().screenshot({ path: new URL(`${buildingId}-comparison-1-vs-20.png`, artifacts).pathname.slice(1) });
    lab.off('console', comparisonConsoleHandler);
    lab.off('pageerror', comparisonPageErrorHandler);
    await lab.close();
  }
  }

  const identity = `retention-01a-${Date.now()}`;
  await fetch('http://localhost:3001/onboarding/skip', { method: 'POST', headers: { 'x-dev-player-id': identity } });
  for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 812 }, { width: 390, height: 844 }, { width: 520, height: 920 }]) {
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
    const name = `${snapshotSet ? `${snapshotSet}-` : ''}kingdom-fa-${viewport.width}x${viewport.height}.png`;
    await page.screenshot({ path: new URL(name, artifacts).pathname.slice(1) });
    await page.close();
  }
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`PASS ${kingdomOnly ? 'Kingdom' : 'Building Evolution Lab captures and Kingdom'} validation at 320x568, 375x812, 390x844, 520x920`);
} finally {
  await browser.close();
}
