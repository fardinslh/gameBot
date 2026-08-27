import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { chromium } from 'playwright-core';

const root = new URL('../', import.meta.url);
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browserPath = existsSync(edgePath) ? edgePath : existsSync(chromePath) ? chromePath : undefined;
const nextCli = new URL('node_modules/next/dist/bin/next', root).pathname.slice(1);
const manifest = JSON.parse(readFileSync(new URL('apps/game-client/public/assets/audio/candidates/AUDITION_MANIFEST.json', root), 'utf8'));
const approvedManifest = JSON.parse(readFileSync(new URL('apps/game-client/public/assets/audio/approved/APPROVED_MANIFEST.json', root), 'utf8'));
const allAssets = [...manifest.candidates, ...approvedManifest.assets];
const artifacts = new URL('artifacts/audio-audition/', root);

function startDevClient() {
  return spawn(process.execPath, [nextCli, 'dev', '--port', '3010'], {
    cwd: new URL('apps/game-client/', root), env: { ...process.env, NODE_ENV: 'development' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function waitForUrl(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

if (!browserPath) throw new Error('No supported Chromium browser was found.');
mkdirSync(artifacts, { recursive: true });
const technicalFailures = [];
for (const candidate of allAssets) {
  const file = new URL(`apps/game-client/public${candidate.filename}`, root);
  if (!existsSync(file) || statSync(file).size !== candidate.sizeBytes) throw new Error(`Missing or mismatched candidate ${candidate.filename}`);
  // Container overhead raises the reported average on sub-200 ms clips.
  if (candidate.codec !== 'mp3' || candidate.bitrate < 96_000 || candidate.bitrate > 200_000) throw new Error(`Unexpected encoding metadata for ${candidate.filename}`);
  const scan = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', fileURLToPath(file), '-af', 'volumedetect', '-f', 'null', process.platform === 'win32' ? 'NUL' : '/dev/null'], { encoding: 'utf8' });
  const peak = /max_volume:\s*(-?[\d.]+) dB/.exec(scan.stderr)?.[1];
  if (scan.status !== 0 || peak === undefined || Number(peak) >= 0) technicalFailures.push(`${candidate.filename} (${peak ?? 'unreadable'} dBFS)`);
}
if (technicalFailures.length) throw new Error(`Clipping or unreadable peaks detected: ${technicalFailures.join(', ')}`);

const existingDevUrl = 'http://localhost:3000/dev/audio';
let client;
let devUrl;
try {
  if ((await fetch(existingDevUrl)).ok) devUrl = existingDevUrl;
} catch {}
if (!devUrl) {
  client = startDevClient();
  devUrl = 'http://localhost:3010/dev/audio';
}
let browser;
const consoleErrors = [];
try {
  await waitForUrl(devUrl);
  browser = await chromium.launch({ executablePath: browserPath, headless: true });
  const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
  await page.addInitScript(() => {
    window.__audioLab = { plays: [], pauses: 0 };
    HTMLMediaElement.prototype.play = function play() { window.__audioLab.plays.push(this.src); return Promise.resolve(); };
    HTMLMediaElement.prototype.pause = function pause() { window.__audioLab.pauses += 1; };
  });
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  await page.goto(devUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-audio-lab="full-human-approval"]');
  const failedLoads = await page.evaluate(async (files) => (await Promise.all(files.map(async (file) => ({ file, ok: (await fetch(file)).ok })))).filter((item) => !item.ok), allAssets.map((candidate) => candidate.filename));
  if (failedLoads.length) throw new Error(`Candidate HTTP loads failed: ${failedLoads.map((item) => item.file).join(', ')}`);
  if (await page.locator('[data-audio-group]').count() !== 0) throw new Error('Approved groups must not remain in the audition lab');
  if (await page.locator('[data-audio-context]').count() !== 0) throw new Error('No pending context controls should remain');
  if (!(await page.locator('[data-audio-loop-test="production-scheduler"]').isVisible())) throw new Error('Production loop boundary test is missing');
  if (!(await page.locator('[data-audio-action="test-kingdom-loop"]').isVisible())) throw new Error('Test Kingdom Loop control is missing');
  if (!(await page.getByText('24 MAPPED · SELECTION COMPLETE').isVisible())) throw new Error('Completion status is missing');
  for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 812 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    if (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) throw new Error(`Horizontal overflow at ${viewport.width}x${viewport.height}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: new URL('audio-lab-mobile-390x844.png', artifacts).pathname.slice(1), fullPage: true });
  if (consoleErrors.length) throw new Error(`Browser console errors: ${consoleErrors.join(' | ')}`);
  console.log(`PASS Audio Lab shows selection complete and all ${approvedManifest.approvedGroupCount} approved assets load`);
  console.log('PASS MP3 bitrate metadata and decoded peaks stay below 0 dBFS');
  console.log('PASS no approved candidates or pending context controls remain in the lab');
  console.log('PASS production-scheduler Kingdom loop boundary control is visible');
  console.log('PASS 320x568, 375x812, and 390x844 without horizontal overflow');
  console.log('NOTE technical playback only; candidate quality was NOT AUDIBLY VERIFIED');
} finally {
  await browser?.close();
  if (client && process.platform === 'win32') spawnSync('taskkill', ['/pid', String(client.pid), '/T', '/F'], { stdio: 'ignore' });
  else client?.kill('SIGTERM');
}
