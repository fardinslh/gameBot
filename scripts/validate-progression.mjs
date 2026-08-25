import { existsSync, mkdirSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
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

const prisma = new PrismaClient();
const browser = await chromium.launch({ executablePath: browserPath, headless: true });
const root = new URL('../', import.meta.url);
const artifacts = new URL('artifacts/', root);
mkdirSync(artifacts, { recursive: true });
const identity = `phase-071-${Date.now()}`;
const requestedBuildingAssets = [];
const consoleErrors = [];

async function setCastleLevel(level) {
  const account = await prisma.platformAccount.findUniqueOrThrow({
    where: { platform_externalUserId: { platform: 'WEB', externalUserId: identity } },
    include: { player: { include: { kingdom: true } } },
  });
  await prisma.building.updateMany({ where: { kingdomId: account.player.kingdom.id, type: 'CASTLE' }, data: { level } });
  return account.player.kingdom.id;
}

async function refreshKingdom(page, expectedCount) {
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForFunction((count) => document.querySelector('.kingdom-scene__canvas')?.getAttribute('data-building-count') === String(count), expectedCount);
  await page.waitForTimeout(500);
  const actualButtons = await page.locator('.kingdom-scene .sr-only button').count();
  if (actualButtons !== expectedCount) throw new Error(`Expected ${expectedCount} accessible building targets, found ${actualButtons}`);
}

async function moveAndClick(page, worldX, worldY) {
  const host = page.locator('.kingdom-scene__canvas');
  const canvas = page.locator('.kingdom-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Kingdom canvas has no layout box');
  const scale = box.width / 640;
  let cameraY = Number(await host.getAttribute('data-camera-y'));
  const desiredCamera = 330 - worldY * scale;
  const dragY = Math.max(-520, Math.min(520, desiredCamera - cameraY));
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + dragY, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  cameraY = Number(await host.getAttribute('data-camera-y'));
  await page.mouse.click(box.x + worldX * scale, box.y + worldY * scale + cameraY);
}

try {
  const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
  await page.route('http://localhost:3001/**', (route) => route.continue({ headers: { ...route.request().headers(), 'x-dev-player-id': identity } }));
  page.on('request', (request) => {
    if (request.url().includes('/assets/kingdom/buildings/')) requestedBuildingAssets.push(request.url());
  });
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(error.stack ?? error.message));

  await page.goto('http://localhost:3000/?lang=fa', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-scene-status="ready"]');
  await refreshKingdom(page, 5);
  const lockedAssetNames = ['academy', 'blacksmith', 'watchtower', 'workshop'];
  if (requestedBuildingAssets.some((url) => lockedAssetNames.some((name) => url.includes(`/${name}-stage-`)))) {
    throw new Error(`A locked building asset was loaded at Castle 1: ${requestedBuildingAssets.join(', ')}`);
  }
  await page.screenshot({ path: new URL('phase-07-1-castle-1-five-buildings-fa-320.png', artifacts).pathname.slice(1) });

  await setCastleLevel(2);
  await refreshKingdom(page, 6);
  await page.screenshot({ path: new URL('phase-07-1-castle-2-watchtower-fa-320.png', artifacts).pathname.slice(1) });

  await setCastleLevel(3);
  await refreshKingdom(page, 7);
  await page.screenshot({ path: new URL('phase-07-1-castle-3-academy-fa-320.png', artifacts).pathname.slice(1) });

  await setCastleLevel(4);
  await refreshKingdom(page, 8);
  await setCastleLevel(5);
  await refreshKingdom(page, 9);
  const kingdomId = await setCastleLevel(5);
  await prisma.building.updateMany({
    where: { kingdomId, type: { in: ['ACADEMY', 'BLACKSMITH', 'WATCHTOWER', 'WORKSHOP'] } },
    data: { level: 2 },
  });
  await refreshKingdom(page, 9);

  const effectBuildings = [
    { id: 'academy', effect: 'PRODUCTION_BONUS', x: 320, y: 365 },
    { id: 'blacksmith', effect: 'HERO_UPGRADE_DISCOUNT', x: 90, y: 420 },
    { id: 'watchtower', effect: 'RAID_PROTECTION_BONUS', x: 590, y: 330 },
    { id: 'workshop', effect: 'BUILDING_UPGRADE_SPEED', x: 275, y: 235 },
  ];
  for (const building of effectBuildings) {
    await moveAndClick(page, building.x, building.y);
    await page.waitForSelector(`[data-building-sheet="${building.id}"] [data-effect="${building.effect}"]`);
    await page.waitForTimeout(320);
    await page.screenshot({ path: new URL(`phase-07-1-${building.id}-detail-fa-320.png`, artifacts).pathname.slice(1) });
    await page.locator('.building-sheet .icon-button').click();
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: new URL('phase-07-1-castle-5-nine-buildings-fa-390.png', artifacts).pathname.slice(1) });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (overflow) throw new Error('Horizontal overflow at 390x844');
  if (consoleErrors.length) throw new Error(`Browser console errors: ${consoleErrors.join(' | ')}`);

  console.log('PASS server-driven Pixi mount counts 5/6/7/8/9 and zero locked asset loads at Castle 1');
  console.log('PASS Academy/Blacksmith/Watchtower/Workshop localized effect details');
  console.log('PASS Phase 07.1 screenshots at 320x568 and 390x844');
} finally {
  await browser.close();
  await prisma.$disconnect();
}
