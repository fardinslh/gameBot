import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { PrismaClient, Platform } from '@prisma/client';

const browserPath = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find(existsSync);
if (!browserPath) throw new Error('No supported local Chromium browser was found');

async function waitForUrl(url, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

await waitForUrl('http://localhost:3001/health');
await waitForUrl('http://localhost:3000');

const prisma = new PrismaClient();
const browser = await chromium.launch({ executablePath: browserPath, headless: true });
const artifacts = new URL('../artifacts/season-validation/', import.meta.url);
mkdirSync(artifacts, { recursive: true });

const identity = `season-tester-${Date.now()}`;

console.log(`Setting up test ranked season player: ${identity}...`);
// Skip onboarding
await fetch('http://localhost:3001/onboarding/skip', {
  method: 'POST',
  headers: { 'x-dev-player-id': identity },
});

// Bootstrap kingdom
await fetch('http://localhost:3001/kingdom', {
  headers: { 'x-dev-player-id': identity },
});

// Seed player with Champion League trophies (e.g. 2650)
const account = await prisma.platformAccount.findUnique({
  where: { platform_externalUserId: { platform: Platform.WEB, externalUserId: identity } },
  include: { player: { include: { kingdom: true } } },
});

if (!account?.player?.kingdom) {
  throw new Error('Failed to bootstrap test player kingdom');
}

const playerId = account.playerId;

await prisma.player.update({
  where: { id: playerId },
  data: { trophies: 2650, displayName: 'Warden Supreme' },
});

console.log('Player bootstrapped with Champion League trophies (2650).');

const consoleErrors = [];
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

page.on('console', (message) => {
  if (message.type() === 'error') {
    const text = message.text();
    if (!text.includes('favicon') && !text.includes('font')) {
      consoleErrors.push(text);
    }
  }
});
page.on('pageerror', (error) => consoleErrors.push(error.message));

// Intercept API calls to attach player identity
await page.route('http://localhost:3001/**', (route) =>
  route.continue({ headers: { ...route.request().headers(), 'x-dev-player-id': identity } }),
);

try {
  console.log('1. Navigating to English view...');
  await page.goto('http://localhost:3000/?lang=en', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  console.log('2. Opening Leaderboard & Season Rankings Modal via HUD trophy button...');
  const trophyBtn = page.locator('.player-trophy-btn');
  await trophyBtn.waitFor({ state: 'visible', timeout: 10000 });
  await trophyBtn.click();

  console.log('3. Waiting for Leaderboard Modal...');
  await page.locator('.leaderboard-panel').waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForTimeout(500);

  console.log('4. Switching to "Season" Tab...');
  const seasonTabBtn = page.locator('.leaderboard-tabs button').nth(2);
  await seasonTabBtn.waitFor({ state: 'visible', timeout: 5000 });
  await seasonTabBtn.click();
  await page.waitForTimeout(1000);

  console.log('5. Verifying Season Overview & Player Standing...');
  await page.locator('.season-tab-view').waitFor({ state: 'visible', timeout: 8000 });
  await page.locator('.season-hero-card').waitFor({ state: 'visible', timeout: 5000 });
  await page.screenshot({ path: new URL('01-season-overview.png', artifacts).pathname.slice(1) });
  console.log('Captured: 01-season-overview.png');

  console.log('6. Verifying Reward Tiers Ladder (Champion Current Tier)...');
  await page.locator('.season-tier-card--current').waitFor({ state: 'visible', timeout: 5000 });
  await page.screenshot({ path: new URL('02-season-reward-ladder.png', artifacts).pathname.slice(1) });
  console.log('Captured: 02-season-reward-ladder.png');

  console.log('7. Simulating End of Season...');
  const simEndBtn = page.locator('.season-sim-btn');
  await simEndBtn.waitFor({ state: 'visible', timeout: 5000 });
  await simEndBtn.click();
  await page.waitForTimeout(2000);

  console.log('8. Verifying Claimable Previous Season Loot Banner...');
  await page.locator('.season-claim-card').waitFor({ state: 'visible', timeout: 8000 });
  await page.screenshot({ path: new URL('03-season-rewards-ready.png', artifacts).pathname.slice(1) });
  console.log('Captured: 03-season-rewards-ready.png');

  console.log('9. Claiming Season Rewards...');
  const claimBtn = page.locator('.season-claim-btn');
  await claimBtn.click();
  await page.waitForTimeout(1500);

  console.log('10. Verifying Claim Success Celebration Modal...');
  await page.locator('.season-success-modal').waitFor({ state: 'visible', timeout: 8000 });
  await page.screenshot({ path: new URL('04-season-claimed-modal.png', artifacts).pathname.slice(1) });
  console.log('Captured: 04-season-claimed-modal.png');

  const closeClaimBtn = page.locator('.season-success-modal button');
  await closeClaimBtn.click();
  await page.waitForTimeout(500);

  console.log('11. Navigating to Persian (RTL) view...');
  await page.goto('http://localhost:3000/?lang=fa', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const trophyBtnFa = page.locator('.player-trophy-btn');
  await trophyBtnFa.waitFor({ state: 'visible', timeout: 10000 });
  await trophyBtnFa.click();

  await page.locator('.leaderboard-panel').waitFor({ state: 'visible', timeout: 8000 });
  const seasonTabBtnFa = page.locator('.leaderboard-tabs button').nth(2);
  await seasonTabBtnFa.click();
  await page.waitForTimeout(1000);

  await page.screenshot({ path: new URL('05-season-fa-rtl.png', artifacts).pathname.slice(1) });
  console.log('Captured: 05-season-fa-rtl.png');

  console.log('Validation complete!');
  if (consoleErrors.length > 0) {
    console.error('Browser Console Errors Encountered:', consoleErrors);
    throw new Error(`Encountered ${consoleErrors.length} browser console errors!`);
  } else {
    console.log('0 console errors detected. Validation SUCCEEDED.');
  }
} finally {
  await browser.close();
  await prisma.$disconnect();
}
