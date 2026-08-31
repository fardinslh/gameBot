import { existsSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
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
await waitForUrl('http://localhost:3000/?lang=fa&section=shop');

const prisma = new PrismaClient();
const browser = await chromium.launch({ executablePath: browserPath, headless: true });
const artifacts = new URL('../artifacts/retention-05-shop/', import.meta.url);
mkdirSync(artifacts, { recursive: true });
const identity = `shop-browser-${Date.now()}`;
const forgedIdentity = `shop-forged-${Date.now()}`;
const consoleErrors = [];
const page = await browser.newPage({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 2 });
page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('pageerror', (error) => consoleErrors.push(error.message));
await page.route('http://localhost:3001/**', (route) => route.continue({ headers: { ...route.request().headers(), 'x-dev-player-id': identity } }));

const screenshot = (name) => page.screenshot({ path: new URL(name, artifacts).pathname.slice(1) });
const headers = (player, idempotencyKey) => ({
  'content-type': 'application/json',
  'x-dev-player-id': player,
  ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
});
async function request(path, player, options = {}) {
  const response = await fetch(`http://localhost:3001${path}`, {
    ...options,
    headers: { ...headers(player, options.idempotencyKey), ...options.headers },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${options.method ?? 'GET'} ${path} failed (${response.status}): ${JSON.stringify(body)}`);
  return body;
}
async function assertLayout(width, height, direction) {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(180);
  const layout = await page.evaluate(() => ({
    direction: document.documentElement.dir,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    navigationHeight: Math.round(document.querySelector('.bottom-navigation')?.getBoundingClientRect().height ?? 0),
    cards: document.querySelectorAll('.shop-cosmetic-card').length,
    shopWidth: Math.round(document.querySelector('.shop-shell')?.getBoundingClientRect().width ?? 0),
  }));
  if (layout.direction !== direction) throw new Error(`Expected ${direction} at ${width}x${height}`);
  if (layout.overflow > 0) throw new Error(`Shop overflow ${layout.overflow}px at ${width}x${height}`);
  if (layout.navigationHeight !== 54) throw new Error(`Expected 54px navigation, got ${layout.navigationHeight}px`);
  if (layout.cards !== 3 || layout.shopWidth > width) throw new Error(`Incomplete Shop layout at ${width}x${height}`);
}
async function openShop(lang) {
  await page.goto(`http://localhost:3000/?lang=${lang}&section=shop`, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-shop-status="ready"]').waitFor({ timeout: 20_000 });
}

try {
  await request('/onboarding/skip', identity, { method: 'POST' });
  const kingdom = await request('/kingdom', identity);
  const farm = kingdom.buildings.find((building) => building.type === 'FARM');
  if (!farm) throw new Error('Farm was not bootstrapped');
  const upgrade = await request(`/kingdom/buildings/${farm.id}/upgrade`, identity, { method: 'POST', idempotencyKey: randomUUID() });
  const training = await request('/army/train', identity, {
    method: 'POST', idempotencyKey: randomUUID(), body: JSON.stringify({ troopType: 'INFANTRY', quantity: 1 }),
  });
  const future = new Date(Date.now() + 5 * 60_000);
  await prisma.buildingUpgrade.update({ where: { id: upgrade.building.activeUpgrade.id }, data: { completesAt: future } });
  await prisma.troopTrainingOrder.update({ where: { id: training.training.id }, data: { completesAt: future } });

  await openShop('fa');
  await assertLayout(320, 568, 'rtl');
  const persianText = await page.locator('.shop-shell').textContent() ?? '';
  if (/[0-9]/u.test(persianText) || !/[\u06F0-\u06F9]/u.test(persianText)) throw new Error('Shop Persian numerals are not localized');
  if (await page.locator('[data-shop-offer="building"]').count() !== 1 || await page.locator('[data-shop-offer="training"]').count() !== 1) {
    throw new Error('Server-derived Building and training offers are not both visible');
  }
  await screenshot('01-shop-fa-speedups-320x568.png');

  const forest = page.locator('.shop-cosmetic-card').nth(0);
  await forest.locator('button').click();
  await page.locator('.shop-confirm').waitFor();
  await screenshot('02-shop-fa-purchase-confirm-320x568.png');
  await page.locator('.shop-confirm button').nth(1).click();
  await page.waitForFunction(() => document.querySelector('.shop-cosmetic-card')?.getAttribute('data-owned') === 'true');
  const displayedBalance = (await page.locator('.shop-gem-balance strong').textContent() ?? '').replace(/[^\u06F0-\u06F9]/gu, '');
  if (displayedBalance !== '۸۰') throw new Error(`Expected displayed Gem balance ۸۰, got ${displayedBalance}`);
  await forest.locator('button').click();
  await page.waitForFunction(() => document.querySelector('.shop-cosmetic-card')?.getAttribute('data-equipped') === 'true');
  await screenshot('03-shop-fa-owned-equipped-320x568.png');

  await page.locator('[data-nav-id="kingdom"]').click();
  await page.locator('[data-profile-crest="PROFILE_CREST_FOREST"]').waitFor();
  await page.locator('[data-scene-status="ready"] canvas').waitFor({ timeout: 20_000 });
  await page.waitForTimeout(900);
  const gemChip = page.locator('[data-resource="GEMS"]');
  if (await gemChip.getAttribute('data-secondary-value') !== null || await gemChip.locator('small').count() !== 0) {
    throw new Error('Gem HUD still renders a storage-capacity secondary value');
  }
  await screenshot('04-kingdom-fa-equipped-320x568.png');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-shop-status="ready"]').waitFor({ timeout: 20_000 });
  await page.locator('[data-nav-id="kingdom"]').click();
  await page.locator('[data-profile-crest="PROFILE_CREST_FOREST"]').waitFor();
  await page.locator('[data-scene-status="ready"] canvas').waitFor({ timeout: 20_000 });
  await page.waitForTimeout(900);

  await openShop('fa');
  await assertLayout(375, 812, 'rtl');
  await assertLayout(390, 844, 'rtl');
  await screenshot('05-shop-fa-390x844.png');
  await openShop('en');
  await assertLayout(320, 568, 'ltr');
  await screenshot('06-shop-en-320x568.png');
  await assertLayout(375, 812, 'ltr');
  await assertLayout(390, 844, 'ltr');

  await request('/onboarding/skip', forgedIdentity, { method: 'POST' });
  const before = await request('/shop', forgedIdentity);
  const forged = await request('/shop/purchases', forgedIdentity, {
    method: 'POST', idempotencyKey: randomUUID(),
    body: JSON.stringify({ itemKey: 'PROFILE_CREST_FOREST', priceGems: -500, discount: 100, gemBalanceAfter: 999999 }),
  });
  if (BigInt(before.gemBalance) - BigInt(forged.gemBalance) !== 40n || forged.purchase.gemPrice !== 40) {
    throw new Error('Forged client price fields influenced the authoritative price');
  }
  if (consoleErrors.length) throw new Error(`Browser console errors:\n${consoleErrors.join('\n')}`);
} finally {
  const accounts = await prisma.platformAccount.findMany({
    where: { platform: 'WEB', externalUserId: { in: [identity, forgedIdentity] } }, select: { playerId: true },
  });
  if (accounts.length) await prisma.player.deleteMany({ where: { id: { in: accounts.map((account) => account.playerId) } } });
  await browser.close();
  await prisma.$disconnect();
}

console.log('PASS Shop cosmetics purchase, equip, persistence, and authoritative forged-price defense');
console.log('PASS live Building and troop-training finish offers from server state');
console.log('PASS Persian RTL and English LTR at 320x568, 375x812, and 390x844');
console.log('PASS 54px navigation, uncapped Gem HUD presentation, zero overflow, and clean browser console');
