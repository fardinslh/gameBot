import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import process from 'node:process';
import { chromium } from 'playwright-core';
import { PrismaClient } from '@prisma/client';

const root = new URL('../', import.meta.url);
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browserPath = existsSync(edgePath) ? edgePath : existsSync(chromePath) ? chromePath : undefined;
const nextCli = new URL('node_modules/next/dist/bin/next', root).pathname.slice(1);
const artifacts = new URL('artifacts/player-experience/', root);
const prisma = new PrismaClient();
const playerIds = [`experience-fa-${Date.now()}`, `experience-en-${Date.now()}`];

function startClient() {
  return spawn(process.execPath, [nextCli, 'start', '--port', '3000'], {
    cwd: new URL('apps/game-client/', root), env: { ...process.env, NODE_ENV: 'production' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function waitForUrl(url, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function routePlayer(page, externalUserId) {
  await page.route('http://localhost:3001/**', (route) => route.continue({
    headers: { ...route.request().headers(), 'x-dev-player-id': externalUserId },
  }));
}

async function clickWorldBuilding(page, worldX, worldY, targetCanvasY = 330) {
  const canvas = page.locator('.kingdom-canvas');
  const host = page.locator('.kingdom-scene__canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Kingdom canvas has no box');
  let cameraY = Number(await host.getAttribute('data-camera-y'));
  const scale = box.width / 640;
  const dragY = Math.max(-520, Math.min(520, targetCanvasY - worldY * scale - cameraY));
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + dragY, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(120);
  cameraY = Number(await host.getAttribute('data-camera-y'));
  await canvas.click({ position: { x: worldX * scale, y: worldY * scale + cameraY } });
}

async function assertViewport(page, width, height, direction) {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(120);
  if (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) throw new Error(`Horizontal overflow at ${width}x${height}`);
  if (await page.locator('.game-viewport').getAttribute('dir') !== direction) throw new Error(`Direction mismatch at ${width}x${height}`);
  const nav = await page.locator('.bottom-navigation').boundingBox();
  if (!nav || nav.height < 50 || nav.height > 70) throw new Error(`Navigation height ${nav?.height ?? 0} is invalid at ${width}x${height}`);
}

async function assertCoachClear(page, targetSelector) {
  const coach = await page.locator('.advisor-coach').boundingBox();
  const target = await page.locator(targetSelector).boundingBox();
  if (!coach || !target) throw new Error(`Missing advisor or target ${targetSelector}`);
  const gap = 12;
  const overlap = coach.x < target.x + target.width + gap && coach.x + coach.width > target.x - gap
    && coach.y < target.y + target.height + gap && coach.y + coach.height > target.y - gap;
  if (overlap) throw new Error(`Advisor overlaps expanded target ${targetSelector}`);
  await page.locator(targetSelector).click({ trial: true });
}

async function cleanupPlayers(externalUserIds) {
  const accounts = await prisma.platformAccount.findMany({
    where: { platform: 'WEB', externalUserId: externalUserIds ? { in: externalUserIds } : { startsWith: 'experience-' } },
    select: { playerId: true },
  });
  if (!accounts.length) return;
  const ids = accounts.map((item) => item.playerId);
  const battles = await prisma.battle.findMany({
    where: { OR: [{ attackerPlayerId: { in: ids } }, { defenderPlayerId: { in: ids } }] },
    select: { id: true },
  });
  const battleIds = battles.map((item) => item.id);
  if (battleIds.length) {
    await prisma.revengeTarget.deleteMany({ where: { sourceBattleId: { in: battleIds } } });
    await prisma.battle.deleteMany({ where: { id: { in: battleIds } } });
  }
  await prisma.player.deleteMany({ where: { id: { in: ids } } });
}

if (!browserPath) throw new Error('No supported Chromium browser was found.');
mkdirSync(artifacts, { recursive: true });
let client;
let browser;
const consoleErrors = [];
const musicRequests = [];
try {
  await cleanupPlayers();
  await waitForUrl('http://localhost:3001/health');
  try { await waitForUrl('http://localhost:3000/?lang=fa', 1_000); } catch { client = startClient(); await waitForUrl('http://localhost:3000/?lang=fa'); }
  browser = await chromium.launch({ executablePath: browserPath, headless: true });
  const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
  await page.addInitScript(() => {
    window.__crownAudioCalls = [];
    HTMLMediaElement.prototype.play = function play() {
      window.__crownAudioCalls.push(this.currentSrc || this.src);
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function pause() {};
  });
  await routePlayer(page, playerIds[0]);
  page.on('request', (request) => { if (request.url().includes('/approved/music/loop-ready/')) musicRequests.push(request.url()); });
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto('http://localhost:3000/?lang=fa', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-onboarding-step="WELCOME"]');
  await page.screenshot({ path: new URL('01-welcome-fa-320x568.png', artifacts).pathname.slice(1) });
  await page.locator('.experience-primary').click();
  await page.waitForSelector('.advisor-coach');
  await assertCoachClear(page, '[data-guide-target="collect"]');
  await page.screenshot({ path: new URL('02-collect-fa-320x568.png', artifacts).pathname.slice(1) });

  await page.locator('.collect-button').click();
  await page.waitForFunction(() => document.querySelector('.advisor-coach'));
  await clickWorldBuilding(page, 88, 958);
  await page.waitForSelector('[data-building-sheet="farm"]');
  await assertCoachClear(page, '[data-guide-target="upgrade"]');
  await page.screenshot({ path: new URL('03-upgrade-fa-320x568.png', artifacts).pathname.slice(1) });
  await page.locator('.upgrade-button').click();
  await page.waitForSelector('[data-guide-target="raid-tab"][data-guide-active="true"]');
  await assertCoachClear(page, '[data-guide-target="raid-tab"]');
  await page.screenshot({ path: new URL('04-raid-target-fa-320x568.png', artifacts).pathname.slice(1) });
  await page.locator('[data-guide-target="raid-tab"]').click();
  await page.waitForSelector('[data-raid-state="overview"]');
  await assertCoachClear(page, '[data-guide-target="find-enemy"]');
  await page.screenshot({ path: new URL('05-find-enemy-fa-320x568.png', artifacts).pathname.slice(1) });
  await page.locator('[data-guide-target="find-enemy"]').click();
  await page.waitForSelector('[data-raid-state="offer"]');
  const opponentKind = await page.evaluate(async () => {
    const response = await fetch('http://localhost:3001/raid/search', { method: 'POST' });
    return response.ok ? (await response.json()).offer.opponent.kind : 'FAILED';
  });
  if (opponentKind !== 'SYSTEM') throw new Error(`Fresh onboarding player received ${opponentKind} opponent`);
  await assertCoachClear(page, '[data-guide-target="attack"]');
  await page.locator('[data-guide-target="attack"]').click();
  await page.waitForSelector('[data-raid-state="battle"]');
  await page.waitForSelector('[data-raid-state="result"]', { timeout: 25_000 });
  await assertCoachClear(page, '[data-guide-target="result-return"]');
  await page.locator('[data-guide-target="result-return"]').click();
  await page.waitForSelector('[data-onboarding-step="COMPLETE"]');
  await page.locator('.experience-complete-button').click();
  await page.waitForSelector('[data-scene-status="ready"]');

  const status = await page.evaluate(async () => (await (await fetch('http://localhost:3001/onboarding')).json()));
  if (status.status !== 'COMPLETED' || status.currentStep !== 'COMPLETE') throw new Error('Onboarding did not complete authoritatively');
  const audioCalls = await page.evaluate(() => window.__crownAudioCalls);
  for (const required of ['collect.mp3', 'upgrade-start.mp3', 'find-enemy.mp3', 'attack-start.mp3']) {
    if (!audioCalls.some((source) => source.includes(required))) throw new Error(`SFX route was not technically triggered: ${required}`);
  }
  for (const required of ['kingdom-loop.mp3', 'battle-loop.mp3']) if (!musicRequests.some((source) => source.includes(required))) throw new Error(`Buffered music was not requested: ${required}`);

  await page.locator('[data-nav-id="heroes"]').click();
  await page.waitForSelector('[data-heroes-status="ready"]');
  await page.waitForSelector('.advisor-context-tip');
  await page.screenshot({ path: new URL('06-heroes-advisor-fa-320x568.png', artifacts).pathname.slice(1) });
  await page.locator('.advisor-context-tip button').click();
  await page.locator('[data-nav-id="kingdom"]').click();

  await page.locator('.experience-controls button').first().click();
  await page.waitForSelector('[data-experience-panel="guide"]');
  if (await page.locator('.guide-sections article').count() !== 8) throw new Error('Game Guide must contain eight sections');
  await page.screenshot({ path: new URL('07-guide-fa-320x568.png', artifacts).pathname.slice(1) });
  await page.locator('.experience-panel > header > button').click();
  await page.locator('.experience-controls button').nth(1).click();
  await page.waitForSelector('[data-experience-panel="audio"]');
  if (await page.locator('.audio-setting-row').count() !== 3) throw new Error('Audio settings must contain Master, Music, and SFX rows');
  await page.screenshot({ path: new URL('08-audio-fa-320x568.png', artifacts).pathname.slice(1) });
  const toggles = page.locator('.audio-setting-row input[type="checkbox"]');
  await toggles.nth(0).click(); await toggles.nth(1).click(); await toggles.nth(2).click();
  const saved = await page.evaluate(() => localStorage.getItem('crown-coin-audio-v1'));
  if (!saved?.includes('masterEnabled')) throw new Error('Audio settings were not persisted');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-scene-status="ready"]');
  if (await page.evaluate(() => localStorage.getItem('crown-coin-audio-v1')) !== saved) throw new Error('Audio settings did not persist after refresh');

  for (const viewport of [{ width: 375, height: 812 }, { width: 390, height: 844 }]) {
    await assertViewport(page, viewport.width, viewport.height, 'rtl');
    await page.screenshot({ path: new URL(`kingdom-fa-${viewport.width}x${viewport.height}.png`, artifacts).pathname.slice(1) });
  }

  const english = await browser.newPage({ viewport: { width: 320, height: 568 } });
  await routePlayer(english, playerIds[1]);
  english.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  english.on('pageerror', (error) => consoleErrors.push(error.message));
  await english.goto('http://localhost:3000/?lang=en', { waitUntil: 'domcontentloaded' });
  await english.waitForSelector('[data-onboarding-step="WELCOME"]');
  await english.locator('.experience-actions button').first().click();
  await english.locator('.experience-actions button').first().click();
  await english.waitForSelector('[data-scene-status="ready"]');
  await assertViewport(english, 320, 568, 'ltr');
  const skipped = await english.evaluate(async () => (await (await fetch('http://localhost:3001/onboarding')).json()).status);
  if (skipped !== 'SKIPPED') throw new Error('Onboarding skip did not persist');
  await english.reload({ waitUntil: 'domcontentloaded' });
  await english.waitForSelector('[data-scene-status="ready"]');
  if (await english.locator('[data-onboarding-step="WELCOME"]').count()) throw new Error('Skipped onboarding returned after refresh');
  await english.close();

  const assetRoot = new URL('apps/game-client/public/assets/audio/', root);
  const requiredAssets = ['approved/music/loop-ready/kingdom-loop.mp3', 'approved/music/loop-ready/battle-loop.mp3'];
  for (const asset of requiredAssets) {
    const size = statSync(new URL(asset, assetRoot));
    if (size.size < 10_000 || size.size > 3_000_000) throw new Error(`Audio asset budget failed for ${asset}: ${size.size}`);
  }
  if (consoleErrors.length) throw new Error(`Browser console errors: ${consoleErrors.join(' | ')}`);
  console.log('PASS authoritative Collect -> Upgrade -> protected SYSTEM Raid -> Battle -> Result -> Kingdom onboarding');
  console.log('PASS refresh recovery, durable skip, permanent 8-section Guide, and FA/RTL + EN/LTR');
  console.log('PASS 320x568, 375x812, 390x844 layout with no horizontal overflow');
  console.log('PASS technical music/SFX routing and persisted Master/Music/SFX settings');
  console.log('NOTE audio calls were technically observed; audio was NOT AUDIBLY VERIFIED');
} finally {
  await browser?.close();
  client?.kill();
  await cleanupPlayers(playerIds);
  await prisma.$disconnect();
}
