import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

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

const browser = await chromium.launch({ executablePath: browserPath, headless: true });
const artifacts = new URL('../artifacts/leaderboard-validation/', import.meta.url);
mkdirSync(artifacts, { recursive: true });

const identity = `leaderboard-tester-${Date.now()}`;
await fetch('http://localhost:3001/onboarding/skip', {
  method: 'POST',
  headers: { 'x-dev-player-id': identity },
});

const consoleErrors = [];
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => consoleErrors.push(error.message));

await page.route('http://localhost:3001/**', (route) =>
  route.continue({ headers: { ...route.request().headers(), 'x-dev-player-id': identity } }),
);

console.log('1. Navigating to Kingdom page...');
await page.goto('http://localhost:3000/?lang=en', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);

console.log('2. Verifying player trophy button in HUD...');
const trophyBtn = page.locator('.player-trophy-btn');
await trophyBtn.waitFor({ state: 'visible' });

console.log('3. Clicking trophy button to open Leaderboard modal...');
await trophyBtn.click();

console.log('4. Verifying Leaderboard panel is visible...');
const panel = page.locator('.leaderboard-panel');
await panel.waitFor({ state: 'visible' });

await page.waitForFunction(() => document.querySelectorAll('.leaderboard-podium-spot').length === 3);
console.log('   Podium with 3 spots verified.');

const listRows = await page.evaluate(() => document.querySelectorAll('.leaderboard-row').length);
console.log(`   Leaderboard list rows: ${listRows}`);

const userBar = page.locator('.leaderboard-user-bar');
await userBar.waitFor({ state: 'visible' });
console.log('   User bar verified.');

// Screenshot mobile 390x844
const mobilePodiumPath = new URL('leaderboard-mobile-top50.png', artifacts).pathname.slice(1);
await page.screenshot({ path: mobilePodiumPath });
console.log(`   Captured mobile screenshot: ${mobilePodiumPath}`);

console.log('5. Switching to Leagues & Perks tab...');
await page.locator('.leaderboard-tabs button').nth(1).click();
await page.waitForFunction(() => document.querySelectorAll('.leaderboard-league-card').length === 6);
console.log('   6 Leagues verified.');

const mobileLeaguesPath = new URL('leaderboard-mobile-leagues.png', artifacts).pathname.slice(1);
await page.screenshot({ path: mobileLeaguesPath });
console.log(`   Captured mobile leagues screenshot: ${mobileLeaguesPath}`);

console.log('6. Testing Desktop Viewport (1280x800)...');
await page.setViewportSize({ width: 1280, height: 800 });
await page.waitForTimeout(300);

// Switch back to top tab
await page.locator('.leaderboard-tabs button').nth(0).click();
await page.waitForTimeout(200);
const desktopTopPath = new URL('leaderboard-desktop-top50.png', artifacts).pathname.slice(1);
await page.screenshot({ path: desktopTopPath });
console.log(`   Captured desktop top 50 screenshot: ${desktopTopPath}`);

console.log('7. Testing Persian RTL Viewport (390x844)...');
await page.setViewportSize({ width: 390, height: 844 });
await page.goto('http://localhost:3000/?lang=fa', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);

await page.locator('.player-trophy-btn').click();
await page.locator('.leaderboard-panel').waitFor({ state: 'visible' });
await page.waitForFunction(() => document.querySelectorAll('.leaderboard-podium-spot').length === 3);

const rtlTopPath = new URL('leaderboard-fa-top50.png', artifacts).pathname.slice(1);
await page.screenshot({ path: rtlTopPath });
console.log(`   Captured Persian RTL screenshot: ${rtlTopPath}`);

console.log('8. Testing Raid page Trophy button...');
await page.locator('.leaderboard-header__close').click();
await page.waitForTimeout(200);

// Navigate to raid tab
await page.locator('button[data-nav-id="raid"]').click();
await page.waitForTimeout(500);

const advisorBtn = page.locator('.advisor-context-tip button');
if (await advisorBtn.isVisible().catch(() => false)) {
  await advisorBtn.click();
  await page.waitForTimeout(200);
}

const raidTrophyBtn = page.locator('.raid-titlebar .player-trophy-btn');
await raidTrophyBtn.waitFor({ state: 'visible' });
await raidTrophyBtn.click();
await page.locator('.leaderboard-panel').waitFor({ state: 'visible' });
await page.waitForFunction(() => document.querySelectorAll('.leaderboard-podium-spot').length === 3);
console.log('   Raid page leaderboard trigger verified.');

const raidLeaderboardPath = new URL('leaderboard-from-raid.png', artifacts).pathname.slice(1);
await page.screenshot({ path: raidLeaderboardPath });

await browser.close();

console.log('=== All Leaderboard Checks Passed! ===');
console.log('Console Errors:', consoleErrors);
if (consoleErrors.length > 0) {
  throw new Error(`Encountered console errors: ${consoleErrors.join('; ')}`);
}
