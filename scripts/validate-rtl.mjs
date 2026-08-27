import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import process from 'node:process';
import { chromium } from 'playwright-core';

const root = new URL('../', import.meta.url);
const artifacts = new URL('artifacts/rtl-audit/', root);
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browserPath = existsSync(edgePath) ? edgePath : existsSync(chromePath) ? chromePath : undefined;
const nextCli = new URL('node_modules/next/dist/bin/next', root).pathname.slice(1);
const playerId = `rtl-audit-${Date.now()}`;

function startClient() {
  return spawn(process.execPath, [nextCli, 'dev', '--port', '3000'], {
    cwd: new URL('apps/game-client/', root),
    env: { ...process.env, NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function waitForUrl(url, timeoutMs = 25_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function routePlayer(page) {
  await page.route('http://localhost:3001/**', (route) => route.continue({
    headers: { ...route.request().headers(), 'x-dev-player-id': playerId },
  }));
}

async function assertSemanticRoot(page, locale, direction) {
  const semantics = await page.evaluate(() => ({
    documentDirection: document.documentElement.dir,
    documentLanguage: document.documentElement.lang,
    rootDirection: document.querySelector('.game-viewport')?.getAttribute('dir'),
    rootLanguage: document.querySelector('.game-viewport')?.getAttribute('lang'),
    computedDirection: getComputedStyle(document.querySelector('.game-viewport')).direction,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }));
  if (semantics.documentDirection !== direction || semantics.rootDirection !== direction || semantics.computedDirection !== direction) {
    throw new Error(`Direction mismatch: ${JSON.stringify(semantics)}`);
  }
  if (semantics.documentLanguage !== locale || semantics.rootLanguage !== locale) throw new Error(`Language mismatch: ${JSON.stringify(semantics)}`);
  if (semantics.overflow) throw new Error('Horizontal overflow detected');
}

async function dismissAdvisorTips(page) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const tip = page.locator('.advisor-context-tip');
    if (!await tip.count()) return;
    await tip.locator('button').click();
    await page.waitForTimeout(100);
  }
}

if (!browserPath) throw new Error('No supported Chromium browser was found.');
mkdirSync(artifacts, { recursive: true });
let client;
let browser;
const browserErrors = [];

try {
  try { await waitForUrl('http://localhost:3000/dev/rtl', 1_000); } catch { client = startClient(); await waitForUrl('http://localhost:3000/dev/rtl'); }
  await waitForUrl('http://localhost:3001/health');
  browser = await chromium.launch({ executablePath: browserPath, headless: true });

  for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 812 }, { width: 390, height: 844 }]) {
    const fixture = await browser.newPage({ viewport });
    fixture.on('console', (message) => { if (message.type() === 'error') browserErrors.push(`${viewport.width} fixture console: ${message.text()}`); });
    fixture.on('pageerror', (error) => browserErrors.push(`${viewport.width} fixture page: ${error.message}`));
    await fixture.goto('http://localhost:3000/dev/rtl', { waitUntil: 'domcontentloaded' });
    await fixture.waitForSelector('[data-rtl-audit="ready"]');
    const fixtureAudit = await fixture.evaluate(() => ({
      faDirection: getComputedStyle(document.querySelector('[data-audit-locale="fa"]')).direction,
      enDirection: getComputedStyle(document.querySelector('[data-audit-locale="en"]')).direction,
      isolatedCount: document.querySelectorAll('[data-audit-locale="fa"] bdi').length,
      numericDirections: [...document.querySelectorAll('[data-audit-locale="fa"] bdi[dir="ltr"]')].map((node) => getComputedStyle(node).direction),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));
    if (fixtureAudit.faDirection !== 'rtl' || fixtureAudit.enDirection !== 'ltr' || fixtureAudit.isolatedCount < 9) throw new Error(`Semantic fixture failed: ${JSON.stringify(fixtureAudit)}`);
    if (fixtureAudit.numericDirections.some((direction) => direction !== 'ltr') || fixtureAudit.overflow) throw new Error(`Bidi fixture layout failed: ${JSON.stringify(fixtureAudit)}`);
    await fixture.screenshot({ path: new URL(`mixed-content-${viewport.width}x${viewport.height}.png`, artifacts).pathname.slice(1), fullPage: true });
    await fixture.close();
  }

  const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
  await routePlayer(page);
  page.on('console', (message) => { if (message.type() === 'error') browserErrors.push(`game console: ${message.text()}`); });
  page.on('pageerror', (error) => browserErrors.push(`game page: ${error.message}`));
  await page.goto('http://localhost:3000/?lang=fa', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-onboarding-step="WELCOME"]');
  await assertSemanticRoot(page, 'fa', 'rtl');
  await page.screenshot({ path: new URL('aren-fa-320x568.png', artifacts).pathname.slice(1) });
  await page.evaluate(async () => { await fetch('http://localhost:3001/onboarding/skip', { method: 'POST' }); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-scene-status="ready"]');
  await page.screenshot({ path: new URL('kingdom-hud-fa-320x568.png', artifacts).pathname.slice(1) });
  await page.locator('[data-world-building-id="farm"]').evaluate((button) => button.click());
  await page.waitForSelector('[data-building-sheet="farm"]');
  await page.screenshot({ path: new URL('building-detail-fa-320x568.png', artifacts).pathname.slice(1) });
  await page.locator('[data-nav-id="heroes"]').click();
  await page.waitForSelector('[data-heroes-status="ready"]');
  await dismissAdvisorTips(page);
  await page.screenshot({ path: new URL('heroes-fa-320x568.png', artifacts).pathname.slice(1) });
  await page.locator('.hero-card__main').first().click();
  await page.waitForSelector('[data-hero-sheet]');
  await page.waitForTimeout(350);
  await page.screenshot({ path: new URL('hero-detail-fa-320x568.png', artifacts).pathname.slice(1) });
  await page.locator('.hero-sheet__close').click();
  await page.locator('[data-nav-id="raid"]').click();
  await page.waitForSelector('[data-raid-state="overview"]');
  await dismissAdvisorTips(page);
  await page.locator('[data-guide-target="find-enemy"]').click();
  await page.waitForSelector('[data-raid-state="offer"]');
  await dismissAdvisorTips(page);
  await page.screenshot({ path: new URL('raid-opponent-fa-320x568.png', artifacts).pathname.slice(1) });
  await page.locator('.raid-titlebar__log').click();
  await page.waitForSelector('[data-raid-state="inbox"]');
  await page.waitForFunction(() => !document.querySelector('.battle-log__empty > span'));
  await dismissAdvisorTips(page);
  await page.screenshot({ path: new URL('battle-log-fa-320x568.png', artifacts).pathname.slice(1) });

  for (const viewport of [{ width: 375, height: 812 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto('http://localhost:3000/?lang=fa', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-scene-status="ready"]');
    await assertSemanticRoot(page, 'fa', 'rtl');
    await page.screenshot({ path: new URL(`kingdom-hud-fa-${viewport.width}x${viewport.height}.png`, artifacts).pathname.slice(1) });
  }

  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('http://localhost:3000/?lang=en', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-scene-status="ready"]');
  await assertSemanticRoot(page, 'en', 'ltr');
  await page.screenshot({ path: new URL('kingdom-hud-en-320x568.png', artifacts).pathname.slice(1) });

  if (browserErrors.length) throw new Error(browserErrors.join('\n'));
  console.log('PASS semantic FA/RTL and EN/LTR roots, document metadata, isolated mixed tokens, and no horizontal overflow');
  console.log('PASS screenshots: Kingdom HUD, Building Detail, Aren, Heroes, Hero Detail, Raid opponent, Battle Log, mixed content');
  console.log('PASS viewports: 320x568, 375x812, 390x844');
} finally {
  await browser?.close();
  client?.kill();
}
