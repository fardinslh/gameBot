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
const identity = `phase-072-${Date.now()}`;
await fetch('http://localhost:3001/onboarding/skip', { method: 'POST', headers: { 'x-dev-player-id': identity } });
await fetch('http://localhost:3001/onboarding/advisor-tips/CASTLE_PROGRESSION', { method: 'POST', headers: { 'x-dev-player-id': identity } });
const requestedEvolutionAssets = [];
const consoleErrors = [];

async function setCastleLevel(level) {
  const account = await prisma.platformAccount.findUniqueOrThrow({
    where: { platform_externalUserId: { platform: 'WEB', externalUserId: identity } },
    include: { player: { include: { kingdom: true } } },
  });
  await prisma.building.updateMany({ where: { kingdomId: account.player.kingdom.id, type: 'CASTLE' }, data: { level } });
  return account.player.kingdom.id;
}

async function refreshKingdom(page, expectedCount, expectedStage) {
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForFunction(({ count, stage }) => {
    const dataset = document.querySelector('.kingdom-scene__canvas')?.dataset;
    return dataset?.buildingCount === String(count)
      && dataset?.expansionStage === String(stage)
      && dataset?.expansionAreaCount === String(stage - 1);
  }, { count: expectedCount, stage: expectedStage });
  await page.waitForTimeout(1_100);
  const host = page.locator('.kingdom-scene__canvas');
  const metadata = await host.evaluate((element) => ({ ...element.dataset }));
  if (metadata.buildingCount !== String(expectedCount) || metadata.activeBuildingCount !== String(expectedCount)) {
    throw new Error(`Stage ${expectedStage} building count mismatch: ${JSON.stringify(metadata)}`);
  }
  if (metadata.expansionAreaCount !== String(expectedStage - 1)) throw new Error(`Stage ${expectedStage} area count mismatch`);
  const actualButtons = await page.locator('.kingdom-scene .sr-only button').count();
  if (actualButtons !== expectedCount) throw new Error(`Expected ${expectedCount} accessible building targets, found ${actualButtons}`);
}

async function validateMobileStage(page, stage, expectedCount) {
  for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 812 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(140);
    const state = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      navHeight: document.querySelector('.bottom-navigation')?.getBoundingClientRect().height,
      world: { ...document.querySelector('.kingdom-scene__canvas')?.dataset },
    }));
    if (state.overflow) throw new Error(`Horizontal overflow at Stage ${stage}, ${viewport.width}x${viewport.height}`);
    if (state.navHeight !== 54) throw new Error(`Navigation changed at Stage ${stage}, ${viewport.width}x${viewport.height}`);
    if (state.world.buildingCount !== String(expectedCount) || state.world.expansionStage !== String(stage)) {
      throw new Error(`Stage ${stage} metadata failed at ${viewport.width}x${viewport.height}`);
    }
  }
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(140);
}

async function moveWorldTo(page, worldY, targetCanvasY = 315) {
  const host = page.locator('.kingdom-scene__canvas');
  const canvas = page.locator('.kingdom-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Kingdom canvas has no layout box');
  const scale = box.width / 640;
  const cameraY = Number(await host.getAttribute('data-camera-y'));
  const dragY = Math.max(-520, Math.min(520, targetCanvasY - worldY * scale - cameraY));
  if (Math.abs(dragY) < 2) return;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + dragY, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(170);
}

async function clickWorldPoint(page, worldX, worldY) {
  const host = page.locator('.kingdom-scene__canvas');
  const canvas = page.locator('.kingdom-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Kingdom canvas has no layout box');
  const scale = box.width / 640;
  const cameraY = Number(await host.getAttribute('data-camera-y'));
  await page.mouse.click(box.x + worldX * scale, box.y + worldY * scale + cameraY);
}

async function moveAndClick(page, worldX, worldY) {
  await moveWorldTo(page, worldY, 330);
  await clickWorldPoint(page, worldX, worldY);
}

async function closeOpenSheet(page) {
  const sheet = page.locator('.building-sheet--open');
  if (await sheet.count()) {
    await sheet.locator('.icon-button').click();
    await page.waitForSelector('.building-sheet[aria-hidden="true"]');
    await page.waitForTimeout(360);
  }
}

try {
  const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
  await page.route('http://localhost:3001/**', (route) => route.continue({ headers: { ...route.request().headers(), 'x-dev-player-id': identity } }));
  page.on('request', (request) => {
    if (request.url().includes('/assets/kingdom/evolution/')) requestedEvolutionAssets.push(request.url());
  });
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(error.stack ?? error.message));

  await page.goto('http://localhost:3000/?lang=fa', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-scene-status="ready"]');
  await refreshKingdom(page, 5, 1);
  const stageOneContract = await page.evaluate(async () => (await fetch('http://localhost:3001/kingdom')).json());
  if (stageOneContract.kingdomGoals?.nextUnlock?.key !== 'WATCHTOWER') throw new Error('Castle 1 next goal is not Watchtower');
  if (stageOneContract.unlocks.some((unlock) => unlock.key === 'ADVANCED_PVP')) throw new Error('Hidden ADVANCED_PVP metadata leaked to client');
  const stageOneMetadata = await page.locator('.kingdom-scene__canvas').evaluate((element) => ({ ...element.dataset }));
  if (stageOneMetadata.mineGround !== '145,365') throw new Error(`Mine registration is ${stageOneMetadata.mineGround ?? 'missing'}`);
  if (stageOneMetadata.expansionAreaCount !== '0') throw new Error('Locked expansion terrain affected Stage 1');
  const lockedAssetNames = ['academy', 'blacksmith', 'watchtower', 'workshop'];
  if (requestedEvolutionAssets.some((url) => lockedAssetNames.some((name) => url.includes(`/default/${name}/`)))) {
    throw new Error(`A locked evolution asset was loaded at Castle 1: ${requestedEvolutionAssets.join(', ')}`);
  }
  await clickWorldPoint(page, 410, 420);
  if (await page.locator('.building-sheet').getAttribute('aria-hidden') !== 'true') throw new Error('A locked building created a ghost click target');
  await validateMobileStage(page, 1, 5);
  await page.locator('[data-world-building-id="castle"]').evaluate((element) => element.click());
  await page.waitForSelector('[data-building-sheet="castle"] .kingdom-progress-open');
  await page.locator('.kingdom-progress-open').click();
  await page.waitForSelector('.kingdom-progress-sheet--open');
  await page.waitForTimeout(320);
  if (await page.locator('.kingdom-milestones article').count() !== 4) throw new Error('Kingdom Progress milestone count changed');
  await page.screenshot({ path: new URL('retention-01b-kingdom-progress-next-unlock-fa-320x568.png', artifacts).pathname.slice(1) });
  await page.locator('.kingdom-progress-sheet .icon-button').click();
  await page.screenshot({ path: new URL('phase-07-2-stage-1-castle-lv1-fa-320x568.png', artifacts).pathname.slice(1) });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(180);
  await page.screenshot({ path: new URL('phase-07-2-stage-1-castle-lv1-fa-390x844.png', artifacts).pathname.slice(1) });
  await moveWorldTo(page, 365, 300);
  await page.screenshot({ path: new URL('phase-07-2-mine-upper-left-close-fa-390.png', artifacts).pathname.slice(1), clip: { x: 0, y: 105, width: 390, height: 470 } });
  await page.setViewportSize({ width: 320, height: 568 });

  await setCastleLevel(2);
  await refreshKingdom(page, 6, 2);
  await validateMobileStage(page, 2, 6);
  await moveWorldTo(page, 300);
  await closeOpenSheet(page);
  await page.screenshot({ path: new URL('phase-07-2-stage-2-watchtower-expansion-fa-320.png', artifacts).pathname.slice(1) });

  await setCastleLevel(3);
  await refreshKingdom(page, 7, 3);
  await validateMobileStage(page, 3, 7);
  await moveWorldTo(page, 420);
  await closeOpenSheet(page);
  await page.screenshot({ path: new URL('phase-07-2-stage-3-academy-expansion-fa-320.png', artifacts).pathname.slice(1) });

  await setCastleLevel(4);
  await refreshKingdom(page, 8, 4);
  await validateMobileStage(page, 4, 8);
  await moveWorldTo(page, 170);
  await closeOpenSheet(page);
  await page.screenshot({ path: new URL('phase-07-2-stage-4-workshop-expansion-fa-320.png', artifacts).pathname.slice(1) });

  await setCastleLevel(5);
  await refreshKingdom(page, 9, 5);
  await refreshKingdom(page, 9, 5);
  const stageFiveContract = await page.evaluate(async () => (await fetch('http://localhost:3001/kingdom')).json());
  if (!stageFiveContract.kingdomGoals?.allDistrictsUnlocked || stageFiveContract.kingdomGoals?.nextUnlock !== null) {
    throw new Error('Castle 5 goal state did not report all current districts unlocked');
  }
  await validateMobileStage(page, 5, 9);
  const kingdomId = await setCastleLevel(5);
  await prisma.building.updateMany({
    where: { kingdomId, type: { in: ['ACADEMY', 'BLACKSMITH', 'WATCHTOWER', 'WORKSHOP'] } },
    data: { level: 2 },
  });
  await refreshKingdom(page, 9, 5);
  await moveWorldTo(page, 310);
  await closeOpenSheet(page);
  await page.screenshot({ path: new URL('phase-07-2-stage-5-full-expansion-fa-320.png', artifacts).pathname.slice(1) });

  const effectBuildings = [
    { id: 'academy', effect: 'PRODUCTION_BONUS' },
    { id: 'blacksmith', effect: 'HERO_UPGRADE_DISCOUNT' },
    { id: 'watchtower', effect: 'RAID_PROTECTION_BONUS' },
    { id: 'workshop', effect: 'BUILDING_UPGRADE_SPEED' },
  ];
  for (const building of effectBuildings) {
    await page.locator(`[data-world-building-id="${building.id}"]`).evaluate((element) => element.click());
    await page.waitForSelector(`[data-building-sheet="${building.id}"] [data-effect="${building.effect}"]`);
    await page.locator('.building-sheet .icon-button').click();
  }

  await page.locator('[data-world-building-id="castle"]').evaluate((element) => element.click());
  await page.waitForSelector('[data-building-sheet="castle"] .kingdom-progress-open');
  await page.locator('.kingdom-progress-open').click();
  await page.waitForSelector('.kingdom-progress-sheet--open');
  await page.waitForTimeout(320);
  if (await page.locator('.kingdom-effect-goals article').count() !== 4) throw new Error('Kingdom Progress effect count changed');
  await page.screenshot({ path: new URL('retention-01b-kingdom-progress-all-unlocked-fa-320x568.png', artifacts).pathname.slice(1) });
  await page.locator('.kingdom-progress-sheet .icon-button').click();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(220);
  await moveWorldTo(page, 330, 360);
  await page.screenshot({ path: new URL('phase-07-2-stage-5-full-expansion-fa-390x844.png', artifacts).pathname.slice(1) });
  const stageFiveMetadata = await page.locator('.kingdom-scene__canvas').evaluate((element) => ({ ...element.dataset }));
  if (!(Number(stageFiveMetadata.activeBoundsTop) < Number(stageOneMetadata.activeBoundsTop))) {
    throw new Error(`Expansion did not extend active camera bounds: Stage1=${stageOneMetadata.activeBoundsTop}, Stage5=${stageFiveMetadata.activeBoundsTop}`);
  }
  if (consoleErrors.length) throw new Error(`Browser console errors: ${consoleErrors.join(' | ')}`);

  console.log('PASS progressive expansion stages 1-5 with exact Pixi counts 5/6/7/8/9');
  console.log('PASS locked assets/areas/accessibility/interaction excluded from Stage 1 camera composition');
  console.log('PASS runtime reveal mount is duplicate-safe and all four effect details remain interactive');
  console.log('PASS Retention 01B goals + lazy advanced evolution at 320x568, 375x812, and 390x844');
} finally {
  await browser.close();
  await prisma.$disconnect();
}
