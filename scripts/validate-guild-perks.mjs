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
const artifacts = new URL('../artifacts/guild-perks-validation/', import.meta.url);
mkdirSync(artifacts, { recursive: true });

const identity = `perks-tester-${Date.now()}`;

console.log(`Setting up test perks player: ${identity}...`);
// Skip onboarding
await fetch('http://localhost:3001/onboarding/skip', {
  method: 'POST',
  headers: { 'x-dev-player-id': identity },
});

// Bootstrap kingdom
await fetch('http://localhost:3001/kingdom', {
  headers: { 'x-dev-player-id': identity },
});

// Seed gold for the test player
const account = await prisma.platformAccount.findUnique({
  where: { platform_externalUserId: { platform: Platform.WEB, externalUserId: identity } },
  include: { player: { include: { kingdom: true } } },
});

if (!account?.player?.kingdom) {
  throw new Error('Failed to bootstrap test player kingdom');
}

const playerId = account.playerId;
const kingdomId = account.player.kingdom.id;

// Fund player with 250,000 gold
await prisma.resourceBalance.updateMany({
  where: { kingdomId, resource: 'GOLD' },
  data: { amount: 250000n },
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
    name: `Aegis of Valor ${guildTagSuffix}`,
    description: 'Forged in gold, unyielding in glory!',
    emblem: 'crown',
    primaryColor: '#d97706',
    secondaryColor: '#78350f',
    joinPolicy: 'OPEN',
    minTrophies: 0,
  }),
});

if (!createGuildRes.ok) {
  const errText = await createGuildRes.text();
  throw new Error(`Failed to create test guild: ${errText}`);
}

const memberRecord = await prisma.guildMember.findUnique({
  where: { playerId },
  include: { guild: true },
});

if (!memberRecord) throw new Error('Player membership record not found');

// Seed guild with XP (1,600 XP -> Clan Level 3) and initial treasury gold (50,000)
await prisma.guild.update({
  where: { id: memberRecord.guildId },
  data: {
    xp: 1600,
    level: 3,
    treasuryGold: 50000n,
  },
});

console.log('Guild established at Level 3 with 50,000 treasury gold.');

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

  console.log('4. Switching to "Perks & Bank" tab...');
  const perksTabBtn = page.locator('.guild-tab-btn:has-text("Perks & Bank")');
  await perksTabBtn.waitFor({ state: 'visible', timeout: 10000 });
  await perksTabBtn.click();

  console.log('5. Waiting for Guild Perks container...');
  await page.locator('.guild-perks-container').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(500);

  console.log('6. Capturing Perks Overview...');
  await page.screenshot({
    path: new URL('01-perks-overview.png', artifacts).pathname.replace(/^\/([a-zA-Z]:)/, '$1'),
    fullPage: false,
  });

  console.log('7. Testing Gold Donation to Vault (+5,000 Gold)...');
  const chip5k = page.locator('.guild-chip-btn:has-text("+5,000")');
  await chip5k.click();
  await page.waitForTimeout(200);

  const depositBtn = page.locator('.guild-treasury-deposit-btn');
  await depositBtn.click();

  console.log('8. Waiting for donation toast...');
  await page.locator('.guild-reward-toast').waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForTimeout(400);

  await page.screenshot({
    path: new URL('02-perks-donated.png', artifacts).pathname.replace(/^\/([a-zA-Z]:)/, '$1'),
    fullPage: false,
  });

  // Close toast
  const toastClose = page.locator('.guild-reward-toast button');
  await toastClose.click();
  await page.waitForTimeout(300);

  console.log('9. Upgrading Royal Mint perk...');
  // Find available upgrade button for Royal Mint
  const upgradeBtn = page.locator('.guild-perk-upgrade-btn--available').first();
  await upgradeBtn.waitFor({ state: 'visible', timeout: 8000 });
  await upgradeBtn.click();

  console.log('10. Waiting for Perk Upgrade celebration modal...');
  await page.locator('.season-celebration-modal').waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForTimeout(400);

  await page.screenshot({
    path: new URL('03-perk-upgraded-modal.png', artifacts).pathname.replace(/^\/([a-zA-Z]:)/, '$1'),
    fullPage: false,
  });

  // Close modal
  const modalClose = page.locator('.season-celebration-modal__cta');
  await modalClose.click();
  await page.waitForTimeout(500);

  console.log('11. Capturing updated perk tree state...');
  await page.screenshot({
    path: new URL('04-perk-tree-active.png', artifacts).pathname.replace(/^\/([a-zA-Z]:)/, '$1'),
    fullPage: false,
  });

  console.log('12. Navigating to Persian RTL view...');
  await page.goto('http://localhost:3000/?lang=fa', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const guildNavFa = page.locator('button[data-nav-id="guild"]');
  await guildNavFa.waitFor({ state: 'visible', timeout: 10000 });
  await guildNavFa.click();

  await page.locator('.guild-dashboard').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(400);

  const perksTabBtnFa = page.locator('.guild-tab-btn:has-text("خزانه‌داری و ارتقاها")');
  await perksTabBtnFa.waitFor({ state: 'visible', timeout: 10000 });
  await perksTabBtnFa.click();

  await page.locator('.guild-perks-container').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(600);

  console.log('13. Capturing Persian RTL view...');
  await page.screenshot({
    path: new URL('05-perks-fa-rtl.png', artifacts).pathname.replace(/^\/([a-zA-Z]:)/, '$1'),
    fullPage: false,
  });

  console.log('--- VALIDATION SUMMARY ---');
  console.log(`Console Errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.error('Captured Console Errors:', consoleErrors);
    throw new Error(`Validation failed with ${consoleErrors.length} console error(s)`);
  }

  console.log('All Guild Perks & Shared Treasury checks PASSED perfectly with 0 console errors!');
} finally {
  await page.close();
  await browser.close();
  await prisma.$disconnect();
}
