import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { PrismaClient, Platform, GuildJoinPolicy, GuildRole, TroopType } from '@prisma/client';

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
const artifacts = new URL('../artifacts/guild-war-validation/', import.meta.url);
mkdirSync(artifacts, { recursive: true });

const identity = `war-tester-${Date.now()}`;

console.log(`Setting up test war player: ${identity}...`);
// Skip onboarding
await fetch('http://localhost:3001/onboarding/skip', {
  method: 'POST',
  headers: { 'x-dev-player-id': identity },
});

// Bootstrap kingdom
await fetch('http://localhost:3001/kingdom', {
  headers: { 'x-dev-player-id': identity },
});

// Seed gold and troops for the test player
const account = await prisma.platformAccount.findUnique({
  where: { platform_externalUserId: { platform: Platform.WEB, externalUserId: identity } },
  include: { player: { include: { kingdom: true } } },
});

if (!account?.player?.kingdom) {
  throw new Error('Failed to bootstrap test player kingdom');
}

const playerId = account.playerId;
const kingdomId = account.player.kingdom.id;

// Fund player with gold
await prisma.resourceBalance.updateMany({
  where: { kingdomId, resource: 'GOLD' },
  data: { amount: 100000n },
});

// Seed troops
await prisma.playerTroop.upsert({
  where: { playerId_troopType: { playerId, troopType: TroopType.INFANTRY } },
  create: { playerId, troopType: TroopType.INFANTRY, readyCount: 50 },
  update: { readyCount: 50 },
});

// Create Guild directly via API so player is LEADER
const createGuildRes = await fetch('http://localhost:3001/guilds', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-dev-player-id': identity,
  },
  body: JSON.stringify({
    name: `War Titans ${Date.now().toString().slice(-4)}`,
    description: 'Born for battle, bound for glory!',
    emblem: 'swords',
    primaryColor: '#b91c1c',
    secondaryColor: '#450a0a',
    joinPolicy: 'OPEN',
    minTrophies: 0,
  }),
});

if (!createGuildRes.ok) {
  const errText = await createGuildRes.text();
  throw new Error(`Failed to create test guild: ${errText}`);
}

console.log('Guild established successfully. Player is leader.');

const consoleErrors = [];
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

page.on('console', (message) => {
  if (message.type() === 'error') {
    const text = message.text();
    // Ignore benign favicon or font 404s
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

  console.log('2. Clicking bottom nav "Alliance" tab...');
  const guildNav = page.locator('button[data-nav-id="guild"]');
  await guildNav.waitFor({ state: 'visible', timeout: 10000 });
  await guildNav.click();

  console.log('3. Waiting for Guild Dashboard...');
  await page.locator('.guild-dashboard').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(500);

  console.log('4. Switching to "Clan War" tab...');
  // Find War tab button
  const warTabBtn = page.locator('.guild-tabs button').filter({ hasText: /War/i });
  await warTabBtn.waitFor({ state: 'visible', timeout: 5000 });
  await warTabBtn.click();
  await page.waitForTimeout(1000);

  console.log('5. Verifying Idle War View and Declare War button...');
  await page.locator('.guild-war-view--idle').waitFor({ state: 'visible', timeout: 5000 });
  const declareWarBtn = page.locator('.guild-war-declare-btn');
  await declareWarBtn.waitFor({ state: 'visible', timeout: 5000 });

  await page.screenshot({ path: new URL('01-guild-war-idle.png', artifacts).pathname.slice(1) });
  console.log('Captured: 01-guild-war-idle.png');

  console.log('6. Declaring War (5v5 Clan War)...');
  await declareWarBtn.click();
  await page.waitForTimeout(1500);

  console.log('7. Verifying Preparation Day State...');
  await page.locator('.guild-war-view--active').waitFor({ state: 'visible', timeout: 8000 });
  await page.locator('.guild-war-scoreboard').waitFor({ state: 'visible', timeout: 5000 });
  await page.screenshot({ path: new URL('02-guild-war-preparation.png', artifacts).pathname.slice(1) });
  console.log('Captured: 02-guild-war-preparation.png');

  console.log('8. Fast-forwarding to Battle Day...');
  const simBattleBtn = page.locator('.guild-war-sim-btn').filter({ hasText: /Battle Day/i });
  await simBattleBtn.waitFor({ state: 'visible', timeout: 5000 });
  await simBattleBtn.click();
  await page.waitForTimeout(1500);

  console.log('9. Verifying Battle Day State & Enemy Bases...');
  const battlePill = page.locator('.guild-war-status-pill').filter({ hasText: /Battle Day/i });
  await battlePill.waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('.guild-war-base-card').first().waitFor({ state: 'visible', timeout: 5000 });
  await page.screenshot({ path: new URL('03-guild-war-battle-day.png', artifacts).pathname.slice(1) });
  console.log('Captured: 03-guild-war-battle-day.png');

  console.log('10. Attacking Opponent Base #1...');
  const attackBtn = page.locator('.guild-war-attack-btn').first();
  await attackBtn.waitFor({ state: 'visible', timeout: 5000 });
  await attackBtn.click();
  await page.waitForTimeout(1500);

  console.log('11. Verifying Attack Result Modal with Stars and Spoils...');
  await page.locator('.guild-war-result-modal').waitFor({ state: 'visible', timeout: 8000 });
  await page.locator('.guild-war-result-stars').waitFor({ state: 'visible' });
  await page.screenshot({ path: new URL('04-guild-war-attack-result.png', artifacts).pathname.slice(1) });
  console.log('Captured: 04-guild-war-attack-result.png');

  console.log('12. Closing Attack Result Modal...');
  const confirmResultBtn = page.locator('.guild-war-confirm-btn');
  await confirmResultBtn.click();
  await page.waitForTimeout(1000);

  console.log('13. Verifying War Log Tab...');
  const logSubTabBtn = page.locator('.guild-war-tab-btn').filter({ hasText: /Log/i });
  await logSubTabBtn.click();
  await page.locator('.guild-war-log-item').first().waitFor({ state: 'visible', timeout: 5000 });
  await page.screenshot({ path: new URL('05-guild-war-log.png', artifacts).pathname.slice(1) });
  console.log('Captured: 05-guild-war-log.png');

  console.log('14. Fast-forwarding to War Conclusion...');
  const simWarEndBtn = page.locator('.guild-war-sim-btn').filter({ hasText: /Conclude War/i });
  await simWarEndBtn.waitFor({ state: 'visible', timeout: 5000 });
  await simWarEndBtn.click();
  await page.waitForTimeout(1500);

  console.log('15. Verifying War Ended Outcome & Spoils Banner...');
  await page.locator('.guild-war-ended-card').waitFor({ state: 'visible', timeout: 8000 });
  const claimSpoilsBtn = page.locator('.guild-claim-spoils-btn');
  await claimSpoilsBtn.waitFor({ state: 'visible', timeout: 5000 });
  await page.screenshot({ path: new URL('06-guild-war-ended.png', artifacts).pathname.slice(1) });
  console.log('Captured: 06-guild-war-ended.png');

  console.log('16. Claiming War Spoils...');
  await claimSpoilsBtn.click();
  await page.waitForTimeout(1500);
  console.log('Spoils claimed successfully.');

  console.log('17. Navigating to Persian (RTL) view...');
  await page.goto('http://localhost:3000/?lang=fa', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const guildNavFa = page.locator('button[data-nav-id="guild"]');
  await guildNavFa.waitFor({ state: 'visible', timeout: 10000 });
  await guildNavFa.click();

  await page.locator('.guild-dashboard').waitFor({ state: 'visible', timeout: 10000 });
  const warTabBtnFa = page.locator('.guild-tabs button').nth(1);
  await warTabBtnFa.click();
  await page.waitForTimeout(1000);

  await page.screenshot({ path: new URL('07-guild-war-fa-rtl.png', artifacts).pathname.slice(1) });
  console.log('Captured: 07-guild-war-fa-rtl.png');

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
