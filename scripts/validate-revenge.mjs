import { existsSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
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

async function api(path, identity, init = {}) {
  const response = await fetch(`http://localhost:3001${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', 'x-dev-player-id': identity, ...init.headers },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${path} failed: ${JSON.stringify(body)}`);
  return body;
}

await waitForUrl('http://localhost:3001/health');
await waitForUrl('http://localhost:3000/?lang=fa');
const prisma = new PrismaClient();
const browser = await chromium.launch({ executablePath: browserPath, headless: true });
const artifacts = new URL('artifacts/', new URL('../', import.meta.url));
mkdirSync(artifacts, { recursive: true });
const consoleErrors = [];
const suffix = `${Date.now()}-${randomUUID().slice(0, 6)}`;
const attackerIdentity = `phase06-attacker-${suffix}`;
const defenderIdentity = `phase06-defender-${suffix}`;

function attachIdentity(page, identity) {
  return page.route('http://localhost:3001/**', (route) => route.continue({
    headers: { ...route.request().headers(), 'x-dev-player-id': identity },
  }));
}

function watchConsole(page) {
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(error.stack ?? error.message));
}

try {
  await api('/kingdom', attackerIdentity);
  await api('/kingdom', defenderIdentity);
  const [attackerAccount, defenderAccount] = await Promise.all([
    prisma.platformAccount.findUniqueOrThrow({ where: { platform_externalUserId: { platform: 'WEB', externalUserId: attackerIdentity } } }),
    prisma.platformAccount.findUniqueOrThrow({ where: { platform_externalUserId: { platform: 'WEB', externalUserId: defenderIdentity } } }),
  ]);
  const [attacker, defender] = await Promise.all([
    prisma.player.findUniqueOrThrow({ where: { id: attackerAccount.playerId }, include: { kingdom: true } }),
    prisma.player.findUniqueOrThrow({ where: { id: defenderAccount.playerId }, include: { kingdom: true } }),
  ]);
  await prisma.playerHero.updateMany({ where: { playerId: attacker.id }, data: { level: 20 } });
  await prisma.playerHero.updateMany({ where: { playerId: defender.id }, data: { level: 1 } });
  await prisma.resourceBalance.updateMany({ where: { kingdomId: defender.kingdom.id, resource: { not: 'GEMS' } }, data: { amount: 100_000n } });
  const matchOffer = await prisma.raidMatchOffer.create({
    data: {
      attackerPlayerId: attacker.id,
      defenderPlayerId: defender.id,
      attackerPower: 1,
      defenderPower: 1,
      potentialLoot: { GOLD: '0', FOOD: '0', WOOD: '0', STONE: '0' },
      expiresAt: new Date(Date.now() + 180_000),
    },
  });
  const sourceBattle = await api('/raid/start', attackerIdentity, {
    method: 'POST', headers: { 'idempotency-key': randomUUID() }, body: JSON.stringify({ matchOfferId: matchOffer.id }),
  });
  if (sourceBattle.result !== 'ATTACKER_WIN') throw new Error(`Expected eligible source win, got ${sourceBattle.result}`);
  const revengeTarget = await prisma.revengeTarget.findUniqueOrThrow({ where: { sourceBattleId: sourceBattle.id } });

  const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
  await attachIdentity(page, defenderIdentity);
  watchConsole(page);
  await page.goto('http://localhost:3000/?lang=fa', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-scene-status="ready"]');
  await page.waitForSelector('.kingdom-inbox-button b');
  await page.screenshot({ path: new URL('phase-06-kingdom-after-fa-320.png', artifacts).pathname.slice(1) });
  const worldLayout = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    navHeight: document.querySelector('.bottom-navigation')?.getBoundingClientRect().height,
  }));
  if (worldLayout.overflow || worldLayout.navHeight !== 54) throw new Error(`Kingdom layout regression: ${JSON.stringify(worldLayout)}`);

  await page.locator('.kingdom-inbox-button').click();
  await page.waitForSelector(`[data-battle-id="${sourceBattle.id}"]`);
  await page.screenshot({ path: new URL('phase-06-battle-log-fa-320.png', artifacts).pathname.slice(1) });
  await page.locator('.battle-entry__revenge').click();
  await page.waitForSelector(`[data-revenge-preview="${revengeTarget.id}"]`);
  await page.screenshot({ path: new URL('phase-06-revenge-preview-fa-320.png', artifacts).pathname.slice(1) });

  const revengeResponse = page.waitForResponse((response) => response.url().endsWith('/raid/revenge/start') && response.request().method() === 'POST');
  await page.locator('.revenge-preview .raid-primary').click();
  const revengeBattle = await (await revengeResponse).json();
  if (revengeBattle.type !== 'REVENGE') throw new Error('Revenge did not reuse the shared Battle response');
  await page.waitForSelector('[data-raid-state="battle"]');
  await page.waitForTimeout(1_300);
  await page.screenshot({ path: new URL('phase-06-revenge-battle-fa-320.png', artifacts).pathname.slice(1) });
  await page.waitForSelector('[data-raid-state="result"]', { timeout: 30_000 });
  await page.screenshot({ path: new URL('phase-06-revenge-result-fa-320.png', artifacts).pathname.slice(1) });
  await page.locator('.raid-result .raid-primary').click();
  await page.waitForSelector(`[data-battle-id="${sourceBattle.id}"] .battle-entry__actions > span`);
  if ((await prisma.revengeTarget.findUniqueOrThrow({ where: { id: revengeTarget.id } })).status !== 'USED') throw new Error('RevengeTarget was not consumed');
  await page.close();

  for (const locale of ['en', 'fa']) {
    for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 812 }, { width: 390, height: 844 }]) {
      const layoutPage = await browser.newPage({ viewport });
      await attachIdentity(layoutPage, defenderIdentity);
      watchConsole(layoutPage);
      await layoutPage.goto(`http://localhost:3000/?lang=${locale}&section=raid`, { waitUntil: 'domcontentloaded' });
      await layoutPage.waitForSelector('.raid-content[data-player-id]');
      await layoutPage.locator('.raid-titlebar__log').click();
      await layoutPage.waitForSelector('.battle-log');
      const dimensions = await layoutPage.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        navHeight: document.querySelector('.bottom-navigation')?.getBoundingClientRect().height,
        direction: document.querySelector('.game-viewport')?.getAttribute('dir'),
      }));
      if (dimensions.overflow) throw new Error(`Horizontal overflow at ${locale} ${viewport.width}x${viewport.height}`);
      if (dimensions.navHeight !== 54) throw new Error(`Bottom navigation changed at ${locale} ${viewport.width}x${viewport.height}`);
      if (dimensions.direction !== (locale === 'fa' ? 'rtl' : 'ltr')) throw new Error(`Direction failed for ${locale}`);
      await layoutPage.close();
    }
  }

  const notifications = await prisma.notification.findMany({ where: { playerId: defender.id } });
  if (notifications.filter((row) => row.type === 'PLAYER_RAIDED').length !== 1) throw new Error('PLAYER_RAIDED notification count is invalid');
  if (notifications.filter((row) => row.type === 'REVENGE_AVAILABLE').length !== 1) throw new Error('REVENGE_AVAILABLE notification count is invalid');
  if (consoleErrors.length) throw new Error(`Browser console errors: ${consoleErrors.join(' | ')}`);
  console.log('PASS Phase 06 Kingdom badge, Battle Log, Revenge Preview, shared Battle playback, Result, and USED state');
  console.log('PASS 320x568, 375x812, 390x844 in English LTR and Persian RTL with unchanged 54px navigation');
  console.log(`DEBUG sourceBattle=${sourceBattle.id} revengeTarget=${revengeTarget.id} revengeBattle=${revengeBattle.id}`);
} finally {
  await browser.close();
  await prisma.$disconnect();
}
