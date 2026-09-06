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
const artifacts = new URL('../artifacts/guild-scrimmages-validation/', import.meta.url);
mkdirSync(artifacts, { recursive: true });

const timestamp = Date.now();
const creatorIdentity = `scrim-creator-${timestamp}`;
const attackerIdentity = `scrim-attacker-${timestamp}`;

console.log(`1. Setting up creator player: ${creatorIdentity}...`);
await fetch('http://localhost:3001/onboarding/skip', {
  method: 'POST',
  headers: { 'x-dev-player-id': creatorIdentity },
});
await fetch('http://localhost:3001/kingdom', {
  headers: { 'x-dev-player-id': creatorIdentity },
});

const creatorAccount = await prisma.platformAccount.findUnique({
  where: { platform_externalUserId: { platform: Platform.WEB, externalUserId: creatorIdentity } },
  include: { player: { include: { kingdom: true } } },
});
if (!creatorAccount?.player?.kingdom) throw new Error('Failed to bootstrap creator kingdom');

const creatorPlayerId = creatorAccount.playerId;
const creatorKingdomId = creatorAccount.player.kingdom.id;

// Fund creator & upgrade kingdom castle to level 5
await prisma.kingdom.update({
  where: { id: creatorKingdomId },
  data: { level: 5 },
});
await prisma.resourceBalance.updateMany({
  where: { kingdomId: creatorKingdomId, resource: 'GOLD' },
  data: { amount: 500000n },
});

// Create Guild via API
const guildTagSuffix = timestamp.toString().slice(-4);
const createGuildRes = await fetch('http://localhost:3001/guilds', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-dev-player-id': creatorIdentity,
  },
  body: JSON.stringify({
    name: `Valor Bastion ${guildTagSuffix}`,
    description: 'Master defense tacticians and scrim strategists',
    emblem: 'shield',
    primaryColor: '#2563eb',
    secondaryColor: '#1e3a8a',
    joinPolicy: 'OPEN',
    minTrophies: 0,
  }),
});
if (!createGuildRes.ok) throw new Error(await createGuildRes.text());
const guildOverview = await createGuildRes.json();
const guildId = guildOverview.guild.guild.id;
const guildName = guildOverview.guild.guild.name;
console.log(`Guild created: ${guildName} (${guildId})`);

console.log(`2. Setting up challenger player: ${attackerIdentity}...`);
await fetch('http://localhost:3001/onboarding/skip', {
  method: 'POST',
  headers: { 'x-dev-player-id': attackerIdentity },
});
await fetch('http://localhost:3001/kingdom', {
  headers: { 'x-dev-player-id': attackerIdentity },
});

const attackerAccount = await prisma.platformAccount.findUnique({
  where: { platform_externalUserId: { platform: Platform.WEB, externalUserId: attackerIdentity } },
  include: { player: { include: { kingdom: true } } },
});
if (!attackerAccount?.player?.kingdom) throw new Error('Failed to bootstrap attacker kingdom');

const attackerPlayerId = attackerAccount.playerId;
const attackerKingdomId = attackerAccount.player.kingdom.id;

// Fund attacker and train troops
await prisma.kingdom.update({
  where: { id: attackerKingdomId },
  data: { level: 4 },
});
await prisma.resourceBalance.updateMany({
  where: { kingdomId: attackerKingdomId, resource: 'GOLD' },
  data: { amount: 300000n },
});
await prisma.playerTroop.upsert({
  where: { playerId_troopType: { playerId: attackerPlayerId, troopType: TroopType.INFANTRY } },
  create: { playerId: attackerPlayerId, troopType: TroopType.INFANTRY, readyCount: 80 },
  update: { readyCount: 80 },
});

// Challenger joins the guild
const joinRes = await fetch(`http://localhost:3001/guilds/${guildId}/join`, {
  method: 'POST',
  headers: { 'x-dev-player-id': attackerIdentity },
});
if (!joinRes.ok) throw new Error(await joinRes.text());
console.log('Challenger joined guild successfully.');

// Seed creator troops for war attacks
await prisma.playerTroop.upsert({
  where: { playerId_troopType: { playerId: creatorPlayerId, troopType: TroopType.INFANTRY } },
  create: { playerId: creatorPlayerId, troopType: TroopType.INFANTRY, readyCount: 60 },
  update: { readyCount: 60 },
});

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

let activeIdentity = creatorIdentity;
await page.route('http://localhost:3001/**', (route) =>
  route.continue({ headers: { ...route.request().headers(), 'x-dev-player-id': activeIdentity } }),
);

try {
  console.log('3. Creator: Navigating to alliance and opening Alliance Chat...');
  await page.goto('http://localhost:3000/?lang=en', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const guildNav = page.locator('button[data-nav-id="guild"]');
  await guildNav.waitFor({ state: 'visible', timeout: 10000 });
  await guildNav.click();

  await page.locator('.guild-dashboard').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(500);

  // Navigate to Chat tab
  const chatTabBtn = page.locator('.guild-tab-btn').filter({ hasText: /War Room & Chat/i });
  await chatTabBtn.waitFor({ state: 'visible', timeout: 8000 });
  await chatTabBtn.click();

  await page.locator('.guild-chat-viewport').waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForTimeout(500);

  console.log('4. Creator: Issuing a Friendly Scrimmage challenge...');
  const issueChallengeBtn = page.locator('.guild-chat-issue-challenge-btn');
  await issueChallengeBtn.waitFor({ state: 'visible', timeout: 8000 });
  await issueChallengeBtn.click();

  // Scrimmage Modal opens
  await page.locator('.war-room-modal').waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForTimeout(300);

  const tauntInput = page.locator('.war-room-modal__textarea');
  await tauntInput.fill('Can your infantry pierce my fortified stone walls? Test with zero troop losses!');

  const publishChallengeBtn = page.locator('.war-room-modal__save-btn');
  await publishChallengeBtn.click();
  await page.waitForTimeout(1200);

  console.log('5. Capturing Scrimmage Card in Creator Chat Feed (with own layout badge)...');
  await page.screenshot({
    path: new URL('01-scrimmage-challenge-issued.png', artifacts).pathname.replace(/^\/([a-zA-Z]:)/, '$1'),
    fullPage: false,
  });

  console.log('6. Switching session to Challenger player...');
  activeIdentity = attackerIdentity;
  await page.goto('http://localhost:3000/?lang=en', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const challengerGuildNav = page.locator('button[data-nav-id="guild"]');
  await challengerGuildNav.waitFor({ state: 'visible', timeout: 10000 });
  await challengerGuildNav.click();

  await page.locator('.guild-dashboard').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(500);

  const challengerChatTabBtn = page.locator('.guild-tab-btn').filter({ hasText: /War Room & Chat/i });
  await challengerChatTabBtn.waitFor({ state: 'visible', timeout: 8000 });
  await challengerChatTabBtn.click();

  await page.locator('.guild-chat-viewport').waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForTimeout(500);

  console.log('7. Challenger: Verifying scrimmage card and practice attack button...');
  const practiceAttackBtn = page.locator('.scrimmage-action-btn--attack').first();
  await practiceAttackBtn.waitFor({ state: 'visible', timeout: 8000 });

  await page.screenshot({
    path: new URL('02-scrimmage-card-challenger-view.png', artifacts).pathname.replace(/^\/([a-zA-Z]:)/, '$1'),
    fullPage: false,
  });

  console.log('8. Challenger: Launching Practice Attack...');
  await practiceAttackBtn.click();

  // Replay Spectator Modal opens automatically with simulation results
  console.log('9. Replay Spectator Theater modal opening...');
  const replayModal = page.locator('.replay-spectator-modal');
  await replayModal.waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(1500);

  // Toggle speed to 2x
  const speed2xBtn = page.locator('.replay-speed-btn').filter({ hasText: '2x' });
  await speed2xBtn.click();
  await page.waitForTimeout(1000);

  console.log('10. Capturing Replay Spectator Theater...');
  await page.screenshot({
    path: new URL('03-replay-spectator-theater.png', artifacts).pathname.replace(/^\/([a-zA-Z]:)/, '$1'),
    fullPage: false,
  });

  // Close replay modal
  const closeReplayBtn = page.locator('.replay-close-action-btn');
  await closeReplayBtn.click();
  await page.waitForTimeout(600);

  console.log('11. Creator: Testing Clan War Log Replay...');
  activeIdentity = creatorIdentity;
  await page.goto('http://localhost:3000/?lang=en', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const warNav = page.locator('button[data-nav-id="guild"]');
  await warNav.click();
  await page.locator('.guild-dashboard').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(500);

  const warTabBtn = page.getByRole('tab', { name: 'War', exact: true });
  await warTabBtn.waitFor({ state: 'visible', timeout: 8000 });
  await warTabBtn.click();
  await page.waitForTimeout(500);

  // Declare War & simulate battle day
  const declareWarBtn = page.locator('.guild-war-declare-btn');
  await declareWarBtn.waitFor({ state: 'visible', timeout: 8000 });
  await declareWarBtn.click();
  await page.waitForTimeout(1000);

  const simBattleBtn = page.locator('.guild-war-sim-btn').filter({ hasText: /Battle Day/i });
  await simBattleBtn.waitFor({ state: 'visible', timeout: 8000 });
  await simBattleBtn.click();
  await page.waitForTimeout(1000);

  // Attack Enemy Base #1
  const attackBaseBtn = page.locator('.guild-war-attack-btn').first();
  await attackBaseBtn.waitFor({ state: 'visible', timeout: 8000 });
  await attackBaseBtn.click();
  await page.waitForTimeout(1500);

  // Dismiss attack modal
  const dismissResultBtn = page.locator('.guild-war-confirm-btn');
  await dismissResultBtn.click();
  await page.waitForTimeout(500);

  // Switch to War Log Tab
  const logSubTabBtn = page.locator('.guild-war-tab-btn').filter({ hasText: /Log/i });
  await logSubTabBtn.click();
  await page.waitForTimeout(500);

  console.log('12. Launching Replay from War Log entry...');
  const warLogReplayBtn = page.locator('.guild-war-replay-btn').first();
  await warLogReplayBtn.waitFor({ state: 'visible', timeout: 8000 });
  await warLogReplayBtn.click();

  await page.locator('.replay-spectator-modal').waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForTimeout(1000);

  console.log('13. Capturing War Log Replay Spectator Theater...');
  await page.screenshot({
    path: new URL('04-war-log-replay-theater.png', artifacts).pathname.replace(/^\/([a-zA-Z]:)/, '$1'),
    fullPage: false,
  });

  const closeWarReplayBtn = page.locator('.replay-close-action-btn');
  await closeWarReplayBtn.click();
  await page.waitForTimeout(500);

  console.log('14. Testing Persian RTL UI...');
  await page.goto('http://localhost:3000/?lang=fa', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const faGuildNav = page.locator('button[data-nav-id="guild"]');
  await faGuildNav.click();
  await page.locator('.guild-dashboard').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(500);

  // Go to Persian Chat tab
  const faChatTabBtn = page.locator('.guild-tab-btn').filter({ hasText: /گفتگو/i });
  await faChatTabBtn.waitFor({ state: 'visible', timeout: 8000 });
  await faChatTabBtn.click();
  await page.waitForTimeout(800);

  // Open replay from Persian chat
  const faWatchReplayBtn = page.locator('.scrimmage-action-btn--watch, .guild-chat-replay-btn').first();
  if (await faWatchReplayBtn.isVisible()) {
    await faWatchReplayBtn.click();
    await page.locator('.replay-spectator-modal').waitFor({ state: 'visible', timeout: 8000 });
    await page.waitForTimeout(1000);
  }

  console.log('15. Capturing Persian RTL Scrimmage & Replay UI...');
  await page.screenshot({
    path: new URL('05-scrimmage-fa-rtl.png', artifacts).pathname.replace(/^\/([a-zA-Z]:)/, '$1'),
    fullPage: false,
  });

  console.log('Checking console errors...');
  if (consoleErrors.length > 0) {
    console.error('Console errors encountered:', consoleErrors);
    throw new Error(`Encountered ${consoleErrors.length} console errors during validation.`);
  }

  console.log('All Scrimmage & Replay Theater validations passed with 0 console errors!');
} finally {
  await browser.close();
  await prisma.$disconnect();
}
