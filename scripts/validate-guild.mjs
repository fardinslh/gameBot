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
const artifacts = new URL('../artifacts/guild-validation/', import.meta.url);
mkdirSync(artifacts, { recursive: true });

const identity = `guild-tester-${Date.now()}`;

console.log(`Setting up test player: ${identity}...`);
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

await prisma.resourceBalance.updateMany({
  where: { kingdomId, resource: 'GOLD' },
  data: { amount: 50000n },
});

await prisma.playerTroop.upsert({
  where: { playerId_troopType: { playerId, troopType: TroopType.INFANTRY } },
  create: { playerId, troopType: TroopType.INFANTRY, readyCount: 25 },
  update: { readyCount: 25 },
});

// Seed rival guilds for discovery & leaderboard
await prisma.guild.upsert({
  where: { tag: '#SLV999' },
  create: {
    name: 'Silver Wolves',
    tag: '#SLV999',
    description: 'The pack hunts together under the moonlit sky.',
    emblem: 'wolf',
    primaryColor: '#64748b',
    secondaryColor: '#334155',
    joinPolicy: GuildJoinPolicy.OPEN,
    minTrophies: 200,
    score: 1850,
  },
  update: {},
});

await prisma.guild.upsert({
  where: { tag: '#SOL777' },
  create: {
    name: 'Solaris Legion',
    tag: '#SOL777',
    description: 'By the sacred sun, our blades shall never dull.',
    emblem: 'sun',
    primaryColor: '#eab308',
    secondaryColor: '#78350f',
    joinPolicy: GuildJoinPolicy.OPEN,
    minTrophies: 500,
    score: 3400,
  },
  update: {},
});

console.log('Seeded rival guilds for discovery and rankings.');

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

  console.log('2. Clicking bottom nav "Alliance" (guild) tab...');
  const guildNav = page.locator('button[data-nav-id="guild"]');
  await guildNav.waitFor({ state: 'visible', timeout: 10000 });
  await guildNav.click();

  console.log('3. Verifying Unjoined Guild Landing Page...');
  await page.locator('.guild-unjoined-view').waitFor({ state: 'visible', timeout: 8000 });
  await page.locator('.guild-unjoined-hero h2').waitFor({ state: 'visible' });

  // Verify search and rival guild cards exist
  await page.locator('.guild-card').first().waitFor({ state: 'visible', timeout: 5000 });

  await page.screenshot({ path: new URL('guild-unjoined-mobile.png', artifacts).pathname.slice(1) });
  console.log('Captured: guild-unjoined-mobile.png');

  console.log('4. Opening "Establish Alliance" Modal...');
  const establishBtn = page.locator('.guild-create-trigger');
  await establishBtn.click();

  await page.locator('.guild-create-panel').waitFor({ state: 'visible', timeout: 5000 });
  await page.screenshot({ path: new URL('guild-create-modal.png', artifacts).pathname.slice(1) });
  console.log('Captured: guild-create-modal.png');

  console.log('5. Filling Alliance Creation Form...');
  await page.locator('#guild-name').fill('Iron Vanguard');
  await page.locator('#guild-desc').fill('Honor and Steel, Ever Unbroken');

  // Select 3rd emblem (e.g. dragon)
  const emblemBtns = page.locator('.guild-emblem-options button');
  if (await emblemBtns.count() >= 3) {
    await emblemBtns.nth(2).click();
  }

  // Select 2nd color swatch (Crimson Blood)
  const swatchBtns = page.locator('.guild-color-swatches button');
  if (await swatchBtns.count() >= 2) {
    await swatchBtns.nth(1).click();
  }

  // Submit Alliance Creation
  const createSubmitBtn = page.locator('.guild-create-footer button[type="submit"]');
  await createSubmitBtn.click();

  console.log('6. Waiting for Guild Dashboard...');
  await page.locator('.guild-dashboard').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(1000);

  console.log('7. Verifying Reinforcements Tab...');
  // Reinforcements is the 1st tab
  const tab1 = page.locator('.guild-tabs button').nth(0);
  await tab1.click();
  await page.locator('.guild-requests-view').waitFor({ state: 'visible', timeout: 5000 });

  // Open troop request modal
  const requestTroopBtn = page.locator('.guild-request-btn');
  await requestTroopBtn.click();
  await page.locator('.guild-picker-modal').waitFor({ state: 'visible', timeout: 5000 });

  // Select infantry
  const troopOption = page.locator('.guild-troop-btn').first();
  await troopOption.click();

  // Verify active troop request card appears in the feed
  await page.locator('.guild-request-card').waitFor({ state: 'visible', timeout: 5000 });
  await page.screenshot({ path: new URL('guild-dashboard-requests.png', artifacts).pathname.slice(1) });
  console.log('Captured: guild-dashboard-requests.png');

  console.log('8. Verifying Roster Tab...');
  const tab2 = page.locator('.guild-tabs button').nth(1);
  await tab2.click();
  await page.locator('.guild-roster-view').waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('.guild-role-tag--leader').waitFor({ state: 'visible', timeout: 5000 });

  await page.screenshot({ path: new URL('guild-dashboard-roster.png', artifacts).pathname.slice(1) });
  console.log('Captured: guild-dashboard-roster.png');

  console.log('9. Verifying Leaderboard Tab...');
  const tab3 = page.locator('.guild-tabs button').nth(2);
  await tab3.click();
  await page.locator('.guild-leaderboard-view').waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForTimeout(500);

  await page.screenshot({ path: new URL('guild-leaderboard.png', artifacts).pathname.slice(1) });
  console.log('Captured: guild-leaderboard.png');

  console.log('10. Navigating to Persian (RTL) view...');
  await page.goto('http://localhost:3000/?lang=fa', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const guildNavFa = page.locator('button[data-nav-id="guild"]');
  await guildNavFa.waitFor({ state: 'visible', timeout: 10000 });
  await guildNavFa.click();

  await page.locator('.guild-dashboard').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: new URL('guild-fa-rtl.png', artifacts).pathname.slice(1) });
  console.log('Captured: guild-fa-rtl.png');

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
