import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { PrismaClient, Platform, TroopType } from '@prisma/client';

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
const artifacts = new URL('../artifacts/guild-chat-validation/', import.meta.url);
mkdirSync(artifacts, { recursive: true });

const identity = `chat-tester-${Date.now()}`;

console.log(`Setting up test chat & war player: ${identity}...`);
// Skip onboarding
await fetch('http://localhost:3001/onboarding/skip', {
  method: 'POST',
  headers: { 'x-dev-player-id': identity },
});

// Bootstrap kingdom
await fetch('http://localhost:3001/kingdom', {
  headers: { 'x-dev-player-id': identity },
});

const account = await prisma.platformAccount.findUnique({
  where: { platform_externalUserId: { platform: Platform.WEB, externalUserId: identity } },
  include: { player: { include: { kingdom: true } } },
});

if (!account?.player?.kingdom) {
  throw new Error('Failed to bootstrap test player kingdom');
}

const playerId = account.playerId;
const kingdomId = account.player.kingdom.id;

// Fund player
await prisma.resourceBalance.updateMany({
  where: { kingdomId, resource: 'GOLD' },
  data: { amount: 200000n },
});

// Seed troops for war attacks
await prisma.playerTroop.upsert({
  where: { playerId_troopType: { playerId, troopType: TroopType.INFANTRY } },
  create: { playerId, troopType: TroopType.INFANTRY, readyCount: 50 },
  update: { readyCount: 50 },
});

// Create Guild directly via API so player is LEADER
const guildTagSuffix = Date.now().toString().slice(-4);
const createGuildRes = await fetch('http://localhost:3001/guilds', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-dev-player-id': identity,
  },
  body: JSON.stringify({
    name: `Legion of Honor ${guildTagSuffix}`,
    description: 'United under one banner for eternal conquest!',
    emblem: 'dragon',
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

console.log('Guild established successfully. Player is LEADER.');

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

  console.log('2. Clicking bottom nav "Alliance" tab...');
  const guildNav = page.locator('button[data-nav-id="guild"]');
  await guildNav.waitFor({ state: 'visible', timeout: 10000 });
  await guildNav.click();

  console.log('3. Waiting for Guild Dashboard...');
  await page.locator('.guild-dashboard').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(500);

  console.log('4. Navigating to War tab to set up a live Clan War...');
  const warTabBtn = page.getByRole('tab', { name: 'War', exact: true });
  await warTabBtn.waitFor({ state: 'visible', timeout: 8000 });
  await warTabBtn.click();
  await page.waitForTimeout(600);

  const declareWarBtn = page.locator('.guild-war-declare-btn');
  await declareWarBtn.waitFor({ state: 'visible', timeout: 8000 });
  await declareWarBtn.click();
  await page.waitForTimeout(1000);

  // Advance to Battle Day
  const simBattleBtn = page.locator('.guild-war-sim-btn').filter({ hasText: /Battle Day/i });
  await simBattleBtn.waitFor({ state: 'visible', timeout: 8000 });
  await simBattleBtn.click();
  await page.waitForTimeout(1000);

  console.log('5. Setting a tactical strategy directive on Enemy Base #1...');
  const strategyBtn = page.locator('.guild-war-strategy-btn').first();
  await strategyBtn.waitFor({ state: 'visible', timeout: 8000 });
  await strategyBtn.click();

  // Modal opens
  await page.locator('.war-room-modal').waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForTimeout(400);

  // Select "High Priority" marker
  const priorityMarkerBtn = page.locator('.war-room-marker-btn').filter({ hasText: /High Priority/i });
  await priorityMarkerBtn.click();

  // Enter recon advice note
  const notesInput = page.locator('.war-room-modal__textarea');
  await notesInput.fill('Lure clan castle troops south; push with heavy infantry!');

  // Save directive
  const saveCalloutBtn = page.locator('.war-room-modal__save-btn');
  await saveCalloutBtn.click();
  await page.waitForTimeout(800);

  console.log('6. Capturing War Map with Tactical Directives & High Priority Marker...');
  await page.screenshot({
    path: new URL('01-war-room-tactical-directive.png', artifacts).pathname.replace(/^\/([a-zA-Z]:)/, '$1'),
    fullPage: false,
  });

  console.log('7. Switching to "War Room & Chat" tab...');
  const chatTabBtn = page.locator('.guild-tab-btn').filter({ hasText: /War Room & Chat/i });
  await chatTabBtn.waitFor({ state: 'visible', timeout: 8000 });
  await chatTabBtn.click();

  await page.locator('.guild-chat-viewport').waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForTimeout(500);

  console.log('8. Sending standard alliance chat message...');
  const chatInput = page.locator('.guild-chat-input');
  await chatInput.fill('Warriors assemble! Follow the tactical directives on Base #1!');
  const sendBtn = page.locator('.guild-chat-send-btn');
  await sendBtn.click();
  await page.waitForTimeout(800);

  console.log('9. Capturing Chat Feed with Leader Badge...');
  await page.screenshot({
    path: new URL('02-guild-chat-feed.png', artifacts).pathname.replace(/^\/([a-zA-Z]:)/, '$1'),
    fullPage: false,
  });

  console.log('10. Posting Pinned Command Announcement...');
  // Check announcement checkbox
  const announcementCheckbox = page.locator('.guild-chat-checkbox-label input[type="checkbox"]').first();
  await announcementCheckbox.check();
  await page.waitForTimeout(200);

  // Check pin checkbox
  const pinCheckbox = page.locator('.guild-chat-checkbox-label input[type="checkbox"]').nth(1);
  await pinCheckbox.check();
  await page.waitForTimeout(200);

  await chatInput.fill('COMMAND DIRECTIVE: All attacks must coordinate through the War Room map!');
  await sendBtn.click();
  await page.waitForTimeout(1000);

  console.log('11. Capturing Pinned Announcement Banner...');
  await page.locator('.guild-chat-pinned-banner').waitFor({ state: 'visible', timeout: 8000 });
  await page.screenshot({
    path: new URL('03-guild-chat-pinned-announcement.png', artifacts).pathname.replace(/^\/([a-zA-Z]:)/, '$1'),
    fullPage: false,
  });

  console.log('12. Filtering by War Room Log...');
  const systemFilterBtn = page.locator('.guild-chat-filter-btn').filter({ hasText: /War Room Log/i });
  await systemFilterBtn.click();
  await page.waitForTimeout(500);

  console.log('13. Capturing War Room Log / System Events...');
  await page.screenshot({
    path: new URL('04-guild-chat-system-log.png', artifacts).pathname.replace(/^\/([a-zA-Z]:)/, '$1'),
    fullPage: false,
  });

  console.log('14. Testing Persian RTL view...');
  await page.goto('http://localhost:3000/?lang=fa', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const guildNavFa = page.locator('button[data-nav-id="guild"]');
  await guildNavFa.waitFor({ state: 'visible', timeout: 10000 });
  await guildNavFa.click();

  await page.locator('.guild-dashboard').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(500);

  const chatTabBtnFa = page.locator('.guild-tab-btn').filter({ hasText: /اتاق جنگ و گفتگو/i });
  await chatTabBtnFa.waitFor({ state: 'visible', timeout: 10000 });
  await chatTabBtnFa.click();

  await page.locator('.guild-chat-viewport').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(600);

  console.log('15. Capturing Persian RTL Chat view...');
  await page.screenshot({
    path: new URL('05-guild-chat-fa-rtl.png', artifacts).pathname.replace(/^\/([a-zA-Z]:)/, '$1'),
    fullPage: false,
  });

  console.log('--- VALIDATION SUMMARY ---');
  console.log(`Console Errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.error('Captured Console Errors:', consoleErrors);
    throw new Error(`Validation failed with ${consoleErrors.length} console error(s)`);
  }

  console.log('All Alliance Chat & War Room Strategy Map checks PASSED perfectly with 0 console errors!');
} finally {
  await page.close();
  await browser.close();
  await prisma.$disconnect();
}
