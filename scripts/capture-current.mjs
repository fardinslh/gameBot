import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const browserPath = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find(existsSync);

const browser = await chromium.launch({ executablePath: browserPath, headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto('http://localhost:3000/?lang=en', { waitUntil: 'networkidle' });

try {
  const enterBtn = page.getByRole('button', { name: /Enter the Kingdom/i });
  await enterBtn.waitFor({ timeout: 3000 });
  await enterBtn.click();
  await page.waitForTimeout(500);
} catch (e) {
  console.log('No enter button or already clicked');
}

await page.waitForSelector('[data-scene-status="ready"]');
await page.waitForTimeout(1000);

await page.screenshot({ path: 'artifacts/current-kingdom-view.png' });

// Pan down (drag from top towards bottom) to show upper north of map
const canvas = page.locator('.kingdom-canvas');
const box = await canvas.boundingBox();
if (box) {
  await page.mouse.move(box.x + box.width / 2, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 600, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'artifacts/current-kingdom-panned-down.png' });

  // Pan up (drag upwards) to show southern river
  await page.mouse.move(box.x + box.width / 2, box.y + 500);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 100, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'artifacts/current-kingdom-panned-up.png' });
}

console.log('Done capturing!');
await browser.close();
