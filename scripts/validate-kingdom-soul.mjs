import { existsSync, mkdirSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { chromium } from 'playwright-core';

const browserPath = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].find(existsSync);
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
const artifacts = new URL('../artifacts/kingdom-soul/', import.meta.url);
mkdirSync(artifacts, { recursive: true });
const identity = `kingdom-soul-${Date.now()}`;
const page = await browser.newPage({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 2 });
const consoleErrors = [];
page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('pageerror', (error) => consoleErrors.push(error.message));
await page.route('http://localhost:3001/**', (route) => route.continue({ headers: { ...route.request().headers(), 'x-dev-player-id': identity } }));

const api = async (path, options = {}) => {
  const response = await fetch(`http://localhost:3001${path}`, { ...options, headers: { 'x-dev-player-id': identity, 'content-type': 'application/json', ...options.headers } });
  if (!response.ok) throw new Error(`${path} failed: ${response.status} ${await response.text()}`);
  return response.json();
};
async function load(lang = 'fa') {
  await page.goto(`http://localhost:3000/?lang=${lang}`, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-scene-status="ready"] canvas').waitFor({ timeout: 20_000 });
  await page.waitForTimeout(250);
}
async function dismissAdvisorTip() {
  const button = page.locator('.advisor-context-tip button');
  if (await button.isVisible().catch(() => false)) {
    await button.click();
    await page.locator('.advisor-context-tip').waitFor({ state: 'hidden' });
  }
}
async function openCastle() {
  const canvas = page.locator('.kingdom-canvas');
  const host = page.locator('.kingdom-scene__canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Kingdom canvas has no box');
  const scale = box.width / 640;
  const castleY = 665;
  const cameraY = Number(await host.getAttribute('data-camera-y'));
  const dragY = Math.max(-520, Math.min(520, 330 - castleY * scale - cameraY));
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + dragY, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(120);
  const finalCameraY = Number(await host.getAttribute('data-camera-y'));
  await canvas.click({ position: { x: 320 * scale, y: castleY * scale + finalCameraY } });
  await page.locator('[data-building-sheet="castle"] .castle-identity').waitFor();
}
async function assertLayout(width, height, direction) {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(120);
  const audit = await page.evaluate(() => ({
    direction: document.documentElement.dir,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    navHeight: Math.round(document.querySelector('.bottom-navigation')?.getBoundingClientRect().height ?? 0),
    actorCount: Number(document.querySelector('.kingdom-scene__canvas')?.getAttribute('data-ambient-actor-count')),
  }));
  if (audit.direction !== direction || audit.overflow > 0 || audit.navHeight !== 54 || audit.actorCount < 6 || audit.actorCount > 10) throw new Error(`Bad ${width}x${height} layout: ${JSON.stringify(audit)}`);
}

try {
  await api('/onboarding/skip', { method: 'POST' });
  const initial = await api('/kingdom');
  if (initial.kingdom.name !== 'Dawnkeep' || initial.kingdom.rulerTitle !== 'LORD' || initial.kingdom.heraldry !== 'GOLDEN_LION') throw new Error('Safe identity defaults missing');
  const goals = initial.kingdomGoals;
  if (goals.transformation.current.realmState !== 'FRONTIER_HOLD' || goals.transformation.next?.unlockBuildingType !== 'WATCHTOWER' || goals.transformation.future?.unlockBuildingType !== 'ACADEMY') throw new Error('Castle transformation projection does not match unlock rules');

  await load('fa');
  await dismissAdvisorTip();
  await assertLayout(320, 568, 'rtl');
  if (await page.locator('.kingdom-scene__canvas').getAttribute('data-ambient-motion') !== 'active') throw new Error('Ambient life is not active');
  await openCastle();
  await dismissAdvisorTip();
  if (await page.locator('[data-next-transformation]').count() !== 1) throw new Error('Next Castle transformation is missing');
  await page.locator('[data-identity-action="edit"]').click();
  await page.locator('[data-identity-field="name"]').fill('Sunward Keep');
  await page.locator('[data-ruler-title="WARDEN"]').click();
  await page.locator('[data-heraldry-choice="VERDANT_STAG"]').click();
  const [, saveResponse] = await Promise.all([
    page.locator('[data-identity-action="save"]').click(),
    page.waitForResponse((response) => response.url().endsWith('/kingdom/identity') && response.request().method() === 'PUT'),
  ]);
  if (!saveResponse.ok()) throw new Error(`Identity UI save failed: ${saveResponse.status()} ${await saveResponse.text()}`);
  await page.waitForFunction(() => document.querySelector('.castle-identity h3')?.textContent === 'Sunward Keep', null, { timeout: 5_000 });
  await page.screenshot({ path: new URL('01-fa-castle-identity-320x568.png', artifacts).pathname.slice(1) });
  const persisted = await api('/kingdom');
  if (persisted.kingdom.name !== 'Sunward Keep' || persisted.kingdom.rulerTitle !== 'WARDEN' || persisted.kingdom.heraldry !== 'VERDANT_STAG') throw new Error('Identity did not persist');
  await page.locator('.building-sheet .icon-button').click();
  for (const [width, height] of [[375, 812], [390, 844]]) await assertLayout(width, height, 'rtl');
  await page.screenshot({ path: new URL('02-fa-living-kingdom-390x844.png', artifacts).pathname.slice(1) });

  await load('en');
  await assertLayout(320, 568, 'ltr');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await load('en');
  if (await page.locator('.kingdom-scene__canvas').getAttribute('data-ambient-motion') !== 'reduced') throw new Error('Reduced motion did not freeze ambient movement');
  await assertLayout(390, 844, 'ltr');
  if (consoleErrors.length) throw new Error(`Browser console errors:\n${consoleErrors.join('\n')}`);
} finally {
  const account = await prisma.platformAccount.findUnique({ where: { platform_externalUserId: { platform: 'WEB', externalUserId: identity } }, select: { playerId: true } });
  if (account) await prisma.player.delete({ where: { id: account.playerId } });
  await browser.close();
  await prisma.$disconnect();
}

console.log('PASS server-owned identity defaults, update, and persistence');
console.log('PASS Castle realm state plus next/future unlock-rule previews');
console.log('PASS deterministic actor budget and reduced motion');
console.log('PASS RTL/LTR, mobile viewports, 54px nav, no overflow, clean console');
