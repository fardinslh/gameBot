import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const browserPath = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find(existsSync);

const browser = await chromium.launch({ executablePath: browserPath, headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto('http://localhost:3000/?lang=fa', { waitUntil: 'networkidle' });

try {
  const enterBtn = page.getByRole('button', { name: /ورود به پادشاهی|رفتن به پادشاهی/i });
  await enterBtn.waitFor({ timeout: 3000 });
  await enterBtn.click();
  await page.waitForTimeout(500);
} catch (e) {
  console.log('No enter button or already clicked');
}

await page.waitForSelector('[data-scene-status="ready"]');
await page.waitForTimeout(1000);

await page.screenshot({ path: 'artifacts/fa-kingdom-view.png' });

// Open objectives / missions drawer if available
try {
  const objectivesBtn = page.locator('button:has-text("فرمان همایونی"), button:has-text("اهداف"), button:has-text("مأموریت")').first();
  if (await objectivesBtn.isVisible()) {
    await objectivesBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'artifacts/fa-objectives-view.png' });
    // close modal/drawer
    const closeBtn = page.locator('button:has-text("بستن")').first();
    if (await closeBtn.isVisible()) await closeBtn.click();
  }
} catch (e) {
  console.log('Objectives click skipped:', e.message);
}

// Click Raid tab
try {
  const raidNav = page.locator('.bottom-navigation button:has-text("یورش")');
  if (await raidNav.isVisible()) {
    await raidNav.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'artifacts/fa-raid-view.png' });
  }
} catch (e) {
  console.log('Raid tab click skipped:', e.message);
}

// Click Army tab
try {
  const armyNav = page.locator('.bottom-navigation button:has-text("سپاه"), .bottom-navigation button:has-text("ارتش")');
  if (await armyNav.isVisible()) {
    await armyNav.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'artifacts/fa-army-view.png' });
  }
} catch (e) {
  console.log('Army tab click skipped:', e.message);
}

// Click Guild tab
try {
  const guildNav = page.locator('.bottom-navigation button:has-text("اتحاد")');
  if (await guildNav.isVisible()) {
    await guildNav.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'artifacts/fa-guild-view.png' });
  }
} catch (e) {
  console.log('Guild tab click skipped:', e.message);
}

console.log('Done capturing Persian screenshots!');
await browser.close();
