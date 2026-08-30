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
await waitForUrl('http://localhost:3000/?lang=fa&section=raid');

const prisma = new PrismaClient();
const browser = await chromium.launch({ executablePath: browserPath, headless: true });
const artifacts = new URL('../artifacts/retention-04-campaign/', import.meta.url);
mkdirSync(artifacts, { recursive: true });
const identity = `campaign-browser-${Date.now()}`;
const consoleErrors = [];
const page = await browser.newPage({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 2 });
page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('pageerror', (error) => consoleErrors.push(error.message));
await page.route('http://localhost:3001/**', (route) => route.continue({ headers: { ...route.request().headers(), 'x-dev-player-id': identity } }));

const screenshot = (name) => page.screenshot({ path: new URL(name, artifacts).pathname.slice(1) });
async function openCampaign(lang = 'fa') {
  await page.goto(`http://localhost:3000/?lang=${lang}&section=raid`, { waitUntil: 'domcontentloaded' });
  await page.locator('.combat-mode-tabs button').nth(1).click();
  await page.locator('.campaign-map').waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelectorAll('.campaign-node').length === 9);
  const advisorDismiss = page.locator('.advisor-context-tip button');
  for (let index = 0; index < 3 && await advisorDismiss.isVisible(); index += 1) {
    await advisorDismiss.click();
    await page.waitForTimeout(350);
  }
  if (await advisorDismiss.isVisible()) throw new Error('Campaign advisor queue did not dismiss');
}
async function assertLayout(width, height, direction) {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(150);
  const layout = await page.evaluate(() => ({
    direction: document.documentElement.dir,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    navigationHeight: Math.round(document.querySelector('.bottom-navigation')?.getBoundingClientRect().height ?? 0),
    stages: document.querySelectorAll('.campaign-node').length,
    tabs: document.querySelectorAll('.combat-mode-tabs button').length,
  }));
  if (layout.direction !== direction) throw new Error(`Expected ${direction} at ${width}x${height}`);
  if (layout.overflow > 0) throw new Error(`Campaign overflow ${layout.overflow}px at ${width}x${height}`);
  if (layout.navigationHeight !== 54) throw new Error(`Expected 54px navigation, got ${layout.navigationHeight}px`);
  if (layout.stages !== 9 || layout.tabs !== 2) throw new Error('Campaign map or Raid/Campaign selector is incomplete');
}

try {
  await fetch('http://localhost:3001/onboarding/skip', { method: 'POST', headers: { 'x-dev-player-id': identity } });
  await openCampaign('fa');
  await assertLayout(320, 568, 'rtl');
  await screenshot('01-campaign-map-fa-320x568.png');

  await page.locator('[data-stage-key="FRONTIER_01"]').click();
  await page.locator('[data-campaign-stage-detail="FRONTIER_01"]').waitFor();
  await screenshot('02-stage-detail-fa-320x568.png');
  await page.locator('.campaign-stage-sheet > header > button').click();
  await page.locator('[data-stage-key="FRONTIER_04"]').click();
  await page.locator('[data-campaign-stage-detail="FRONTIER_04"]').waitFor();
  await screenshot('03-castle-locked-fa-320x568.png');
  await page.locator('.campaign-stage-sheet > header > button').click();

  await page.locator('[data-stage-key="FRONTIER_01"]').click();
  await page.locator('.campaign-stage-sheet .raid-primary').click();
  await page.locator('.battle-scene').waitFor({ state: 'visible' });
  await page.waitForTimeout(650);
  await screenshot('06-campaign-battle-fa-320x568.png');
  await page.locator('[data-campaign-result]').waitFor({ state: 'visible', timeout: 30_000 });
  await screenshot('07-campaign-victory-fa-320x568.png');
  const result = await page.locator('[data-campaign-result]').getAttribute('data-campaign-result');
  if (result !== 'victory') throw new Error(`Expected Stage 1 victory, got ${result}`);
  await page.locator('.campaign-result .raid-primary').click();
  await page.locator('.campaign-map').waitFor();
  await screenshot('04-cleared-stage-stars-fa-320x568.png');

  const account = await prisma.platformAccount.findUniqueOrThrow({
    where: { platform_externalUserId: { platform: 'WEB', externalUserId: identity } },
    include: { player: { include: { kingdom: true } } },
  });
  const now = new Date();
  for (const stageKey of ['FRONTIER_01', 'FRONTIER_02', 'FRONTIER_03']) {
    await prisma.playerCampaignStage.upsert({
      where: { playerId_stageKey: { playerId: account.playerId, stageKey } },
      create: { playerId: account.playerId, stageKey, bestStars: 3, attempts: 1, firstClearedAt: now, lastPlayedAt: now },
      update: { bestStars: 3, firstClearedAt: now, lastPlayedAt: now },
    });
  }
  await openCampaign('fa');
  await screenshot('05-claimable-nine-star-milestone-fa-320x568.png');

  await prisma.building.update({ where: { kingdomId_type: { kingdomId: account.player.kingdom.id, type: 'CASTLE' } }, data: { level: 3 } });
  for (const stageKey of ['FRONTIER_04', 'FRONTIER_05', 'FRONTIER_06', 'FRONTIER_07', 'FRONTIER_08']) {
    await prisma.playerCampaignStage.upsert({
      where: { playerId_stageKey: { playerId: account.playerId, stageKey } },
      create: { playerId: account.playerId, stageKey, bestStars: 1, attempts: 1, firstClearedAt: now, lastPlayedAt: now },
      update: { bestStars: 1, firstClearedAt: now, lastPlayedAt: now },
    });
  }
  await openCampaign('fa');
  await page.locator('[data-stage-key="FRONTIER_09"]').click();
  await page.locator('[data-campaign-stage-detail="FRONTIER_09"]').waitFor();
  await screenshot('08-boss-stage-detail-fa-320x568.png');
  await page.locator('.campaign-stage-sheet > header > button').click();
  await assertLayout(375, 812, 'rtl');
  await assertLayout(390, 844, 'rtl');
  await screenshot('09-campaign-map-fa-390x844.png');

  await openCampaign('en');
  await assertLayout(320, 568, 'ltr');
  await assertLayout(390, 844, 'ltr');
  if (consoleErrors.length) throw new Error(`Browser console errors:\n${consoleErrors.join('\n')}`);
} finally {
  const account = await prisma.platformAccount.findUnique({ where: { platform_externalUserId: { platform: 'WEB', externalUserId: identity } } });
  if (account) {
    await prisma.battle.deleteMany({ where: { attackerPlayerId: account.playerId, type: 'CAMPAIGN' } });
    await prisma.player.delete({ where: { id: account.playerId } });
  }
  await browser.close();
  await prisma.$disconnect();
}

console.log('PASS Campaign Chapter One map, detail, lock, battle, result, milestone, and boss flows');
console.log('PASS Persian RTL and English LTR at 320x568, 375x812, and 390x844');
console.log('PASS exact 9 stages, 54px navigation, zero overflow, and clean browser console');
