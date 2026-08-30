import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { PrismaClient } from '@prisma/client';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browserPath = existsSync(edgePath) ? edgePath : existsSync(chromePath) ? chromePath : undefined;
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
await waitForUrl('http://localhost:3000/?lang=fa&section=raid');
const prisma = new PrismaClient();
const browser = await chromium.launch({ executablePath: browserPath, headless: true });
const artifacts = new URL('artifacts/', new URL('../', import.meta.url));
mkdirSync(artifacts, { recursive: true });
const consoleErrors = [];

async function scenario(kind) {
  const externalUserId = `raid-browser-${kind}-${Date.now()}`;
  await fetch('http://localhost:3001/onboarding/skip', { method: 'POST', headers: { 'x-dev-player-id': externalUserId } });
  const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
  await page.route('http://localhost:3001/**', (route) => route.continue({ headers: { ...route.request().headers(), 'x-dev-player-id': externalUserId } }));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(error.stack ?? error.message));
  await page.goto('http://localhost:3000/?lang=fa&section=raid', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.raid-content[data-player-id]');
  const attackerId = await page.locator('.raid-content').getAttribute('data-player-id');
  if (!attackerId) throw new Error('Raid overview did not expose its server Player ID');
  if (kind === 'victory') await prisma.playerHero.updateMany({ where: { playerId: attackerId }, data: { level: 20 } });
  if (kind === 'defeat') await prisma.armyFormationSlot.updateMany({ where: { armyFormation: { playerId: attackerId } }, data: { unitCount: 1 } });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.raid-content[data-player-id]');

  const searchResponsePromise = page.waitForResponse((response) => response.url().endsWith('/raid/search') && response.request().method() === 'POST');
  await page.locator('.raid-empty .raid-primary').click();
  const searchResponse = await searchResponsePromise;
  const search = await searchResponse.json();
  if (!search.newPlayerProtection?.active) throw new Error('Fresh Raid browser player is not shielded');
  if (search.offer?.opponent?.kind !== 'SYSTEM') throw new Error('Shielded Raid browser player received a real opponent');
  await page.waitForSelector('[data-raid-state="offer"]');
  if (kind === 'victory') await page.screenshot({ path: new URL('army-raid-preview-fa-320x568.png', artifacts).pathname.slice(1) });
  const defenderSlots = await prisma.armyFormationSlot.findMany({
    where: { armyFormation: { playerId: search.offer.opponent.id } },
    select: { id: true, unitCount: true },
  });
  const defenderTroops = kind === 'defeat'
    ? await prisma.playerTroop.findMany({
      where: { playerId: search.offer.opponent.id },
      select: { id: true, readyCount: true },
    })
    : [];
  const defenderHeroes = kind === 'defeat'
    ? await prisma.playerHero.findMany({
      where: { playerId: search.offer.opponent.id },
      select: { id: true, level: true },
    })
    : [];
  if (kind === 'victory') await prisma.armyFormationSlot.updateMany({ where: { armyFormation: { playerId: search.offer.opponent.id } }, data: { unitCount: 1 } });
  if (kind === 'defeat') {
    await prisma.playerTroop.updateMany({ where: { playerId: search.offer.opponent.id }, data: { readyCount: 100 } });
    await prisma.armyFormationSlot.updateMany({ where: { armyFormation: { playerId: search.offer.opponent.id } }, data: { unitCount: 100 } });
    await prisma.playerHero.updateMany({ where: { playerId: search.offer.opponent.id }, data: { level: 20 } });
  }

  const startResponsePromise = page.waitForResponse((response) => response.url().endsWith('/raid/start') && response.request().method() === 'POST');
  await page.locator('.raid-match-card .raid-primary').click();
  const startResponse = await startResponsePromise;
  const battle = await startResponse.json();
  if (kind === 'victory') {
    await prisma.$transaction(defenderSlots.map((slot) => prisma.armyFormationSlot.update({
      where: { id: slot.id },
      data: { unitCount: slot.unitCount },
    })));
  }
  if (kind === 'defeat') {
    await prisma.$transaction([
      ...defenderSlots.map((slot) => prisma.armyFormationSlot.update({ where: { id: slot.id }, data: { unitCount: slot.unitCount } })),
      ...defenderTroops.map((troop) => prisma.playerTroop.update({ where: { id: troop.id }, data: { readyCount: troop.readyCount } })),
      ...defenderHeroes.map((hero) => prisma.playerHero.update({ where: { id: hero.id }, data: { level: hero.level } })),
    ]);
  }
  await page.waitForSelector('[data-raid-state="battle"]');
  if (kind === 'victory') {
    await page.waitForTimeout(1_500);
    await page.screenshot({ path: new URL('army-battle-fa-320x568.png', artifacts).pathname.slice(1) });
  }
  try {
    await page.waitForSelector('[data-raid-state="result"]', { timeout: 30_000 });
  } catch (error) {
    const currentState = await page.locator('.raid-content').getAttribute('data-raid-state').catch(() => 'missing');
    throw new Error(`Result wait failed; state=${currentState}; console=${consoleErrors.join(' | ')}`, { cause: error });
  }
  if (battle.result !== (kind === 'victory' ? 'ATTACKER_WIN' : 'DEFENDER_WIN')) throw new Error(`Expected ${kind}, got ${battle.result}`);
  await page.screenshot({ path: new URL(`army-${kind}-fa-320x568.png`, artifacts).pathname.slice(1) });

  if (kind === 'victory') {
    const resultBalances = battle.balances;
    await page.locator('.raid-result .raid-primary').click();
    await page.waitForSelector('[data-scene-status="ready"]');
    for (const [resource, value] of Object.entries(resultBalances)) {
      const chip = page.locator(`.resource-chip--${resource.toLowerCase()}`);
      await page.waitForFunction(({ selector, expected }) => document.querySelector(selector)?.getAttribute('data-balance') === expected, { selector: `.resource-chip--${resource.toLowerCase()}`, expected: value });
      if (await chip.getAttribute('data-balance') !== value) throw new Error(`Kingdom ${resource} did not refresh after Raid`);
    }
  }
  const persisted = await prisma.battle.findUnique({ where: { id: battle.id }, include: { events: true, heroSnapshots: true, armySquadSnapshots: true } });
  if (!persisted || persisted.rulesVersion !== 2 || persisted.events.length === 0 || persisted.heroSnapshots.length !== 0 || persisted.armySquadSnapshots.length !== 6) throw new Error('Army Battle v2 persistence is incomplete');
  await page.close();
  return battle;
}

try {
  for (const locale of ['en', 'fa']) {
    for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 812 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport });
      const identity = `raid-layout-${locale}-${viewport.width}-${Date.now()}`;
      await fetch('http://localhost:3001/onboarding/skip', { method: 'POST', headers: { 'x-dev-player-id': identity } });
      await page.route('http://localhost:3001/**', (route) => route.continue({ headers: { ...route.request().headers(), 'x-dev-player-id': identity } }));
      await page.goto(`http://localhost:3000/?lang=${locale}&section=raid`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.raid-content[data-player-id]');
      const dimensions = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        navHeight: document.querySelector('.bottom-navigation')?.getBoundingClientRect().height,
        shieldHeight: document.querySelector('.raid-shield-status')?.getBoundingClientRect().height,
        direction: document.querySelector('.game-viewport')?.getAttribute('dir'),
      }));
      if (dimensions.overflow) throw new Error(`Horizontal overflow at ${locale} ${viewport.width}x${viewport.height}`);
      if (dimensions.navHeight !== 54) throw new Error(`Bottom navigation changed at ${locale} ${viewport.width}x${viewport.height}`);
      if (!dimensions.shieldHeight || dimensions.shieldHeight > 44) throw new Error(`Shield indicator is missing or too tall at ${locale} ${viewport.width}x${viewport.height}`);
      if (dimensions.direction !== (locale === 'fa' ? 'rtl' : 'ltr')) throw new Error(`Direction failed for ${locale}`);
      await page.close();
    }
  }
  const victory = await scenario('victory');
  const defeat = await scenario('defeat');
  if (consoleErrors.length) throw new Error(`Browser console errors: ${consoleErrors.join(' | ')}`);
  console.log('PASS compact New Kingdom Shield layout at 320x568, 375x812, 390x844 in English LTR and Persian RTL');
  console.log('PASS fresh players receive system-only Raid offers from authoritative shield state');
  console.log('PASS server match offer + Pixi event playback + Victory/Defeat result screenshots');
  console.log('PASS post-Raid Kingdom HUD refresh + six persisted Army snapshots/events');
  console.log(`DEBUG battle=${victory.id} seed=${victory.seed} rules=${victory.rulesVersion} result=${victory.result} duration=${victory.durationMs} events=${victory.events.length}`);
  console.log(`DEBUG defeat=${defeat.id} result=${defeat.result}`);
} finally {
  await browser.close();
  await prisma.$disconnect();
}
