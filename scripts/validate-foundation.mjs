import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import process from 'node:process';
import { chromium } from 'playwright-core';

const root = new URL('../', import.meta.url);
const validationEnvPath = process.env.VALIDATION_ENV ?? '.env';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browserPath = existsSync(edgePath) ? edgePath : existsSync(chromePath) ? chromePath : undefined;

function parseEnv(path) {
  const values = {};
  for (const rawLine of readFileSync(new URL(path, root), 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^(["'])(.*)\1$/, '$2');
    values[key] = value;
  }
  return values;
}

function startNode(args, cwd, env) {
  const output = [];
  const child = spawn(process.execPath, args, {
    cwd: new URL(cwd, root),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const collect = (chunk) => {
    output.push(chunk.toString());
    if (output.length > 60) output.shift();
  };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);
  child.validationOutput = output;
  return child;
}

async function runNode(args, cwd, env) {
  const child = startNode(args, cwd, env);
  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(child.validationOutput.join('').trim())));
  });
}

async function waitForHealth(url, timeoutMs = 20_000, parseJson = true) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return parseJson ? await response.json() : { status: 'ok' };
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError?.message ?? 'unavailable'}`);
}

const fileEnv = parseEnv(validationEnvPath);
const databaseUrl = fileEnv.DATABASE_URL_DIRECT ?? fileEnv.DATABASE_URL;
if (!databaseUrl) throw new Error(`${validationEnvPath} does not contain DATABASE_URL`);

const runtimeEnv = {
  ...process.env,
  ...fileEnv,
  DATABASE_URL: databaseUrl,
  REDIS_URL: process.env.REDIS_URL ?? fileEnv.REDIS_URL ?? 'redis://127.0.0.1:6379',
  CLIENT_ORIGIN: 'http://localhost:3000',
  NEXT_PUBLIC_API_URL: 'http://localhost:3001',
  PORT: '3001',
  NODE_ENV: 'production',
};

const prismaCli = new URL('node_modules/prisma/build/index.js', root).pathname.slice(1);
const nextCli = new URL('node_modules/next/dist/bin/next', root).pathname.slice(1);
const api = [];
let browser;

try {
  await runNode([prismaCli, 'migrate', 'deploy', '--schema', 'apps/game-api/prisma/schema.prisma'], '.', runtimeEnv);
  console.log('PASS Prisma migration');

  const apiProcess = startNode(['dist/main.js'], 'apps/game-api/', runtimeEnv);
  api.push(apiProcess);
  let health;
  try {
    health = await waitForHealth('http://localhost:3001/health');
  } catch (error) {
    throw new Error(`${error.message}\n${apiProcess.validationOutput.join('').trim()}`);
  }
  if (health.status !== 'ok') throw new Error('Unexpected health response');
  console.log('PASS PostgreSQL + Redis + GET /health');

  api.push(startNode([nextCli, 'start', '--port', '3000'], 'apps/game-client/', runtimeEnv));
  await waitForHealth('http://localhost:3000/?lang=en', 20_000, false);

  if (!browserPath) throw new Error('No supported local Chromium browser was found');
  browser = await chromium.launch({ executablePath: browserPath, headless: true });
  const page = await browser.newPage({ viewport: { width: 320, height: 740 } });
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto('http://localhost:3000/?lang=en', { waitUntil: 'networkidle' });
  await page.waitForSelector('.api-status--online');
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (mobileOverflow) throw new Error('Horizontal overflow detected at 320px');

  await page.goto('http://localhost:3000/?lang=fa', { waitUntil: 'networkidle' });
  await page.waitForSelector('.api-status--online');
  const direction = await page.locator('.game-viewport').getAttribute('dir');
  if (direction !== 'rtl') throw new Error('Persian layout did not switch to RTL');
  mkdirSync(new URL('artifacts/', root), { recursive: true });
  await page.screenshot({ path: new URL('artifacts/game-shell-fa.png', root).pathname.slice(1), fullPage: true });

  if (consoleErrors.length > 0) throw new Error(`Browser console errors: ${consoleErrors.join(' | ')}`);
  console.log('PASS Client API reachability, 320px layout, FA/RTL, browser console');
} finally {
  await browser?.close();
  for (const child of api.reverse()) {
    child.kill();
  }
}
