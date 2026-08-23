import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browserPath = existsSync(edgePath) ? edgePath : existsSync(chromePath) ? chromePath : undefined;

if (!browserPath) throw new Error('No supported local Chromium browser was found');

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

await waitForUrl('http://localhost:3001/health');
await waitForUrl('http://localhost:3000/?lang=en&section=heroes');

const browser = await chromium.launch({ executablePath: browserPath, headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
  const testPlayerId = `hero-browser-${Date.now()}`;
  await page.route('http://localhost:3001/**', (route) => route.continue({
    headers: { ...route.request().headers(), 'x-dev-player-id': testPlayerId },
  }));
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto('http://localhost:3000/?lang=fa&section=heroes', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-heroes-status="ready"]');
  if (await page.locator('.hero-card').count() !== 3) throw new Error('Expected three starter Hero cards');
  if (await page.locator('[data-team-slot]').count() !== 3) throw new Error('Expected three Raid Team slots');
  const portraitsReady = await page.locator('.hero-card__portrait').evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0));
  if (!portraitsReady) throw new Error('A temporary Hero portrait did not load');

  await page.locator('.hero-card__main').first().click();
  await page.waitForSelector('[data-hero-sheet="KNIGHT"]');
  await page.locator('.hero-sheet__close').click();

  await page.locator('[data-team-slot]').nth(1).click();
  await page.locator('.hero-card__assign').first().click();
  const orderBeforeSave = await page.locator('[data-team-slot]').evaluateAll((items) => items.map((item) => item.textContent));
  await page.locator('.save-team-button').click();
  await page.waitForSelector('.save-team-button--saved');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-heroes-status="ready"]');
  const orderAfterReload = await page.locator('[data-team-slot]').evaluateAll((items) => items.map((item) => item.textContent));
  if (orderBeforeSave.join('|') !== orderAfterReload.join('|')) throw new Error('Raid Team slot order did not persist');

  const knightCard = page.locator('[data-hero-key="KNIGHT"]');
  const levelBefore = Number(await knightCard.getAttribute('data-hero-level'));
  const goldBefore = BigInt(await page.locator('.resource-chip--gold').getAttribute('data-balance'));
  await knightCard.locator('.hero-card__main').click();
  await page.locator('.hero-upgrade-button').click();
  await page.waitForFunction((level) => Number(document.querySelector('[data-hero-key="KNIGHT"]')?.getAttribute('data-hero-level')) === level + 1, levelBefore);
  const goldAfter = BigInt(await page.locator('.resource-chip--gold').getAttribute('data-balance'));
  if (goldBefore - goldAfter !== 300n) throw new Error('Hero upgrade did not deduct the authoritative level-one Gold cost');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-heroes-status="ready"]');
  if (Number(await page.locator('[data-hero-key="KNIGHT"]').getAttribute('data-hero-level')) !== levelBefore + 1) throw new Error('Hero level did not persist after refresh');

  for (const locale of ['en', 'fa']) {
    for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 812 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.goto(`http://localhost:3000/?lang=${locale}&section=heroes`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-heroes-status="ready"]');
      const layout = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        navHeight: document.querySelector('.bottom-navigation')?.getBoundingClientRect().height,
        direction: document.querySelector('.game-viewport')?.getAttribute('dir'),
      }));
      if (layout.overflow) throw new Error(`Horizontal overflow at ${locale} ${viewport.width}x${viewport.height}`);
      if (layout.navHeight !== 54) throw new Error(`Compact navigation changed at ${locale} ${viewport.width}x${viewport.height}`);
      if (layout.direction !== (locale === 'fa' ? 'rtl' : 'ltr')) throw new Error(`Wrong direction for ${locale}`);
    }
  }

  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('http://localhost:3000/?lang=fa&section=heroes', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-heroes-status="ready"]');
  await page.locator('[data-nav-id="kingdom"]').click();
  await page.waitForSelector('[data-scene-status="ready"]');
  if (await page.locator('.kingdom-scene__canvas').getAttribute('data-building-count') !== '5') throw new Error('Kingdom regression: Pixi buildings missing');
  if (await page.locator('.collect-button').count() !== 1) throw new Error('Kingdom regression: Collect missing');
  if (consoleErrors.length > 0) throw new Error(`Browser console errors: ${consoleErrors.join(' | ')}`);

  console.log('PASS starter roster + local portraits + Hero detail');
  console.log('PASS Raid Team reorder/save/refresh persistence');
  console.log('PASS Hero upgrade + Gold HUD + refresh persistence');
  console.log('PASS 320/375/390 + Persian RTL + English LTR + compact nav');
  console.log('PASS Kingdom navigation + Pixi/Collect regression smoke');
} finally {
  await browser.close();
}
