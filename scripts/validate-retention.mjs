import { existsSync, mkdirSync } from 'node:fs';
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
const artifacts = new URL('../artifacts/retention-02/', import.meta.url);
mkdirSync(artifacts, { recursive: true });
const identity = `retention-browser-${Date.now()}`;
await fetch('http://localhost:3001/onboarding/skip', { method: 'POST', headers: { 'x-dev-player-id': identity } });

const consoleErrors = [];
const page = await browser.newPage({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 2 });
page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('pageerror', (error) => consoleErrors.push(error.message));
await page.route('http://localhost:3001/**', (route) => route.continue({ headers: { ...route.request().headers(), 'x-dev-player-id': identity } }));
await page.goto('http://localhost:3000/?lang=fa', { waitUntil: 'domcontentloaded' });
await page.locator('.retention-entry').waitFor({ state: 'visible' });
await page.locator('.retention-entry').click();
await page.locator('.retention-panel').waitFor({ state: 'visible' });
await page.waitForFunction(() => document.querySelectorAll('.retention-mission').length === 3);

async function assertLayout(width, height, expectedDirection = 'rtl') {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(250);
  const layout = await page.evaluate(() => ({
    direction: document.documentElement.dir,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    navigationHeight: Math.round(document.querySelector('.bottom-navigation')?.getBoundingClientRect().height ?? 0),
    missionCount: document.querySelectorAll('.retention-mission').length,
    returnDays: document.querySelectorAll('.daily-return-day').length,
    panel: document.querySelector('.retention-panel')?.getBoundingClientRect().toJSON(),
  }));
  if (layout.direction !== expectedDirection) throw new Error(`Expected ${expectedDirection.toUpperCase()} document at ${width}x${height}`);
  if (layout.overflow > 0) throw new Error(`Horizontal overflow ${layout.overflow}px at ${width}x${height}`);
  if (layout.navigationHeight !== 54) throw new Error(`Expected 54px navigation, got ${layout.navigationHeight}px`);
  if (layout.missionCount !== 3 || layout.returnDays !== 7) throw new Error(`Retention content missing at ${width}x${height}`);
  if (!layout.panel || layout.panel.width > width) throw new Error(`Retention panel exceeds ${width}px viewport`);
}

await assertLayout(320, 568);
await page.screenshot({ path: new URL('daily-return-and-missions-fa-320x568.png', artifacts).pathname.slice(1) });
await page.locator('.retention-tabs button').nth(2).click();
await page.waitForFunction(() => document.querySelectorAll('.retention-achievement').length === 9);
await page.screenshot({ path: new URL('achievements-fa-320x568.png', artifacts).pathname.slice(1) });
await page.locator('.retention-tabs button').nth(0).click();
await assertLayout(375, 812);
await assertLayout(390, 844);
await page.screenshot({ path: new URL('daily-return-and-missions-fa-390x844.png', artifacts).pathname.slice(1) });

await page.goto('http://localhost:3000/?lang=en', { waitUntil: 'domcontentloaded' });
await page.locator('.retention-entry').waitFor({ state: 'visible' });
await page.locator('.retention-entry').click();
await page.waitForFunction(() => document.querySelectorAll('.retention-mission').length === 3);
await assertLayout(320, 568, 'ltr');
await assertLayout(390, 844, 'ltr');

if (consoleErrors.length) throw new Error(`Browser console errors:\n${consoleErrors.join('\n')}`);
await browser.close();
console.log('PASS Retention 02 Persian Daily Return, Daily Missions, and Achievements at 320x568');
console.log('PASS Persian RTL and English LTR at 320x568 and 390x844');
console.log('PASS 54px navigation and zero overflow at 320x568, 375x812, and 390x844');
console.log('PASS browser console clean and 3 Daily / 7 return days / 9 Achievement families visible');
