import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

// Read-only development-lab capture: no player creation or backend mutations.
const executablePath = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find(existsSync);
if (!executablePath) throw new Error('A local Chromium browser is required');
const destination = resolve('art-source/buildings/polished-v2/tiers/review');
mkdirSync(destination, { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });
const buildings = ['castle', 'farm', 'lumberMill', 'grandMarket', 'academy', 'blacksmith', 'watchtower', 'workshop'];
const selectedBuilding = process.argv.find((argument) => argument.startsWith('--building='))?.split('=')[1];
if (selectedBuilding && !buildings.includes(selectedBuilding)) throw new Error(`Unknown building: ${selectedBuilding}`);
const errors = [];
try {
  for (const buildingId of buildings.filter((id) => !selectedBuilding || id === selectedBuilding)) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 920 }, deviceScaleFactor: 1 });
    page.on('pageerror', (error) => errors.push(`${buildingId}: ${error.message}`));
    page.on('response', (response) => {
      if (response.status() >= 400 && response.url().includes('/assets/kingdom/')) errors.push(`${response.status()}: ${response.url()}`);
    });
    await page.goto('http://localhost:3000/dev/buildings', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-visual-state]');
    await page.locator('select').first().selectOption(buildingId);
    await page.getByRole('button', { name: 'All tiers', exact: true }).click();
    await page.waitForFunction((id) => {
      const previews = [...document.querySelectorAll(`[data-building-id="${id}"][data-visual-state]`)];
      return previews.length === 5 && [1, 5, 9, 13, 17].every((level) => previews.some((preview) => preview.getAttribute('data-building-level') === String(level)));
    }, buildingId);
    if (process.argv.includes('--require-distinct-assets')) {
      const assets = await page.locator('[data-evolution-stage] [data-building-asset]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-building-asset')));
      if (new Set(assets).size !== 5) throw new Error(`${buildingId}: expected five distinct loaded tier assets`);
    }
    await page.locator('[data-evolution-stage]').screenshot({ path: resolve(destination, `${buildingId}-tiers.png`) });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) errors.push(`${buildingId}: horizontal overflow`);
    console.log(`Captured ${buildingId}: levels 1, 5, 9, 13, 17`);
    await page.close();
  }
  if (errors.length) throw new Error(errors.join('\n'));
} finally {
  await browser.close();
}
