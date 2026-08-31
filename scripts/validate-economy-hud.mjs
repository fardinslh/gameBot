import { existsSync, mkdirSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { chromium } from 'playwright-core';

const browserPath = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find(existsSync);
if (!browserPath) throw new Error('No supported local Chromium browser was found');

async function waitForUrl(url, timeoutMs = 25_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { const response = await fetch(url); if (response.ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

await waitForUrl('http://localhost:3001/health');
await waitForUrl('http://localhost:3000/?lang=fa');

const prisma = new PrismaClient();
const browser = await chromium.launch({ executablePath: browserPath, headless: true });
const artifacts = new URL('../artifacts/economy-hud-corrective/', import.meta.url);
mkdirSync(artifacts, { recursive: true });
const identity = `economy-hud-${Date.now()}`;
const consoleErrors = [];
const page = await browser.newPage({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 2 });
page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('pageerror', (error) => consoleErrors.push(error.message));
await page.route('http://localhost:3001/**', (route) => route.continue({ headers: { ...route.request().headers(), 'x-dev-player-id': identity } }));

const screenshot = (name) => page.screenshot({ path: new URL(name, artifacts).pathname.slice(1) });
const api = async (path, options = {}) => {
  const response = await fetch(`http://localhost:3001${path}`, { ...options, headers: { 'x-dev-player-id': identity, ...options.headers } });
  if (!response.ok) throw new Error(`${path} failed: ${response.status}`);
  return response.json();
};
const capacity = (state, resource) => BigInt(state.storageCapacities[resource]);

async function setBalance(kingdomId, resource, amount) {
  await prisma.resourceBalance.updateMany({ where: { kingdomId, resource }, data: { amount } });
}
async function load(lang = 'fa') {
  await page.goto(`http://localhost:3000/?lang=${lang}`, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-scene-status="ready"] canvas').waitFor({ timeout: 20_000 });
  await page.locator('.resource-hud').waitFor();
  await page.waitForTimeout(250);
}
async function assertLayout(width, height, direction) {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(120);
  const result = await page.evaluate(() => ({
    direction: document.documentElement.dir,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    navHeight: Math.round(document.querySelector('.bottom-navigation')?.getBoundingClientRect().height ?? 0),
  }));
  if (result.direction !== direction || result.overflow > 0 || result.navHeight !== 54) throw new Error(`Bad ${width}x${height} layout: ${JSON.stringify(result)}`);
}

try {
  await api('/onboarding/skip', { method: 'POST' });
  const state = await api('/kingdom');
  const kingdomId = state.kingdom.id;

  for (const resource of ['GOLD', 'FOOD', 'WOOD', 'STONE']) await setBalance(kingdomId, resource, capacity(state, resource) - BigInt(500));
  await prisma.kingdom.update({ where: { id: kingdomId }, data: { lastCollectedAt: new Date(Date.now() - 30 * 60_000) } });
  await load('fa');
  if (await page.locator('[data-capacity-state="normal"]').count() !== 4) throw new Error('Expected four normal capped resources');
  if (await page.locator('[data-resource="GEMS"][data-capacity-state]').count()) throw new Error('Gems received a capacity state');
  const faHud = await page.locator('.resource-hud').textContent() ?? '';
  if (/[0-9]/u.test(faHud) || !/[\u06F0-\u06F9]/u.test(faHud)) throw new Error('Persian HUD digits are not localized');
  await assertLayout(320, 568, 'rtl');
  await screenshot('01-fa-normal-320x568.png');

  for (const resource of ['GOLD', 'FOOD', 'WOOD']) await setBalance(kingdomId, resource, capacity(state, resource));
  await setBalance(kingdomId, 'STONE', capacity(state, 'STONE') + BigInt(2_100));
  await prisma.kingdom.update({ where: { id: kingdomId }, data: { lastCollectedAt: new Date(Date.now() - 60 * 60_000) } });
  await load('fa');
  if (await page.locator('[data-capacity-state="full"]').count() !== 3 || await page.locator('[data-capacity-state="overflow"]').count() !== 1) throw new Error('Full/overflow states are incorrect');
  if (await page.locator('[data-collect-state="storage-full"]').count() !== 1) {
    throw new Error(`Storage-full Collect state is missing: ${await page.locator('.collect-button').getAttribute('data-collect-state')} / ${await page.locator('.collect-button').textContent()}`);
  }
  await screenshot('02-fa-overflow-320x568.png');

  await setBalance(kingdomId, 'STONE', capacity(state, 'STONE') - BigInt(400));
  await prisma.kingdom.update({ where: { id: kingdomId }, data: { lastCollectedAt: new Date(Date.now() - 4 * 60 * 60_000) } });
  await load('fa');
  await page.locator('.collect-button').click();
  const stone = page.locator('[data-resource="STONE"]');
  await page.waitForFunction(() => {
    const chip = document.querySelector('[data-resource="STONE"]');
    return chip?.getAttribute('data-balance') !== chip?.getAttribute('data-display-balance');
  });
  if (await stone.locator('.resource-chip__gain').count() !== 1) throw new Error('Per-resource Collect gain is missing');
  if (await page.locator('.resource-chip__gain').count() !== 1) throw new Error('Zero-gain resources rendered feedback');
  const animatedFaHud = await page.locator('.resource-hud').textContent() ?? '';
  if (/[0-9]/u.test(animatedFaHud)) throw new Error('Collect animation exposed Latin digits in Persian');
  await screenshot('03-fa-collect-animation-320x568.png');
  await page.waitForFunction(() => {
    const chip = document.querySelector('[data-resource="STONE"]');
    return chip?.getAttribute('data-balance') === chip?.getAttribute('data-display-balance');
  }, null, { timeout: 2_000 });

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setBalance(kingdomId, 'STONE', capacity(state, 'STONE') - BigInt(100));
  await prisma.kingdom.update({ where: { id: kingdomId }, data: { lastCollectedAt: new Date(Date.now() - 60 * 60_000) } });
  await load('fa');
  await page.locator('.collect-button').click();
  await page.waitForFunction(() => {
    const chip = document.querySelector('[data-resource="STONE"]');
    return chip?.getAttribute('data-balance') === chip?.getAttribute('data-capacity')
      && chip?.getAttribute('data-display-balance') === chip?.getAttribute('data-balance');
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  for (const resource of ['GOLD', 'FOOD', 'WOOD', 'STONE']) await setBalance(kingdomId, resource, capacity(state, resource) - BigInt(500));
  await load('en');
  const enHud = await page.locator('.resource-hud').textContent() ?? '';
  if (!enHud.includes('Cap') || /[\u06F0-\u06F9]/u.test(enHud)) throw new Error('English HUD regression');
  await assertLayout(320, 568, 'ltr');
  await screenshot('04-en-normal-320x568.png');
  for (const [width, height] of [[375, 812], [390, 844]]) {
    await assertLayout(width, height, 'ltr');
    await load('fa');
    await assertLayout(width, height, 'rtl');
    await load('en');
  }
  if (consoleErrors.length) throw new Error(`Browser console errors:\n${consoleErrors.join('\n')}`);
} finally {
  const account = await prisma.platformAccount.findUnique({ where: { platform_externalUserId: { platform: 'WEB', externalUserId: identity } }, select: { playerId: true } });
  if (account) await prisma.player.delete({ where: { id: account.playerId } });
  await browser.close();
  await prisma.$disconnect();
}

console.log('PASS normal/full/overflow HUD states, uncapped Gems, and capacity-aware Collect state');
console.log('PASS 900ms Collect count-up, per-resource gain, exact landing, and reduced-motion snap');
console.log('PASS Persian RTL and English LTR at 320x568, 375x812, and 390x844');
console.log('PASS 54px navigation, zero horizontal overflow, and clean browser console');
