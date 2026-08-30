import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import process from 'node:process';
import { chromium } from 'playwright-core';

const root = new URL('../', import.meta.url);
const artifacts = new URL('artifacts/typography-audit/', root);
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browserPath = existsSync(edgePath) ? edgePath : existsSync(chromePath) ? chromePath : undefined;
const nextCli = new URL('node_modules/next/dist/bin/next', root).pathname.slice(1);
const playerId = `rtl-audit-${Date.now()}`;

function startClient() {
  return spawn(process.execPath, [nextCli, 'dev', '--port', '3000'], {
    cwd: new URL('apps/game-client/', root),
    env: { ...process.env, NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function waitForUrl(url, timeoutMs = 25_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function routePlayer(page) {
  await page.route('http://localhost:3001/**', (route) => route.continue({
    headers: { ...route.request().headers(), 'x-dev-player-id': playerId },
  }));
}

async function assertSemanticRoot(page, locale, direction) {
  const semantics = await page.evaluate(() => ({
    documentDirection: document.documentElement.dir,
    documentLanguage: document.documentElement.lang,
    rootDirection: document.querySelector('.game-viewport')?.getAttribute('dir'),
    rootLanguage: document.querySelector('.game-viewport')?.getAttribute('lang'),
    computedDirection: getComputedStyle(document.querySelector('.game-viewport')).direction,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }));
  if (semantics.documentDirection !== direction || semantics.rootDirection !== direction || semantics.computedDirection !== direction) {
    throw new Error(`Direction mismatch: ${JSON.stringify(semantics)}`);
  }
  if (semantics.documentLanguage !== locale || semantics.rootLanguage !== locale) throw new Error(`Language mismatch: ${JSON.stringify(semantics)}`);
  if (semantics.overflow) throw new Error('Horizontal overflow detected');
}

async function assertPersianNumerals(page, selector) {
  const audit = await page.locator(selector).evaluate((element) => {
    const text = element.textContent ?? '';
    return { ascii: text.match(/[0-9]/gu) ?? [], persian: text.match(/[۰-۹]/gu) ?? [], text };
  });
  if (audit.ascii.length) throw new Error(`ASCII digits remain in Persian UI ${selector}: ${audit.text}`);
  if (!audit.persian.length) throw new Error(`No Persian numerals found in ${selector}`);
}

async function assertTypography(page, selector, locale) {
  await page.evaluate(() => document.fonts.ready);
  const audit = await page.locator(selector).evaluate((surface, expectedLocale) => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
    };
    const textElements = [surface, ...surface.querySelectorAll('*')].filter((node) => {
      if (!(node instanceof HTMLElement) || !visible(node) || node.matches('script, style, svg, canvas, [aria-hidden="true"]')) return false;
      return [...node.childNodes].some((child) => child.nodeType === Node.TEXT_NODE && child.textContent?.trim());
    });
    const undersized = textElements.map((element) => ({
      className: element.className,
      fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
      tag: element.tagName,
      text: element.textContent?.trim().slice(0, 80),
    })).filter(({ fontSize }) => fontSize < 10);
    const clippedControls = [...surface.querySelectorAll('button, [role="button"]')]
      .filter((node) => node instanceof HTMLElement && visible(node) && (node.textContent?.trim().length ?? 0) > 0)
      .map((element) => ({
        className: element.className,
        clippedX: element.scrollWidth > element.clientWidth + 1,
        clippedY: element.scrollHeight > element.clientHeight + 1,
        text: element.textContent?.trim().slice(0, 80),
      }))
      .filter(({ clippedX, clippedY }) => clippedX || clippedY);
    const viewport = document.querySelector('.game-viewport');
    const nav = document.querySelector('.bottom-navigation');
    return {
      clippedControls,
      fontFamily: viewport ? getComputedStyle(viewport).fontFamily : '',
      fontLoaded: document.fonts.check('12px "Vazirmatn Variable"'),
      locale: expectedLocale,
      navHeight: nav ? Math.round(nav.getBoundingClientRect().height) : null,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      undersized,
      visibleText: surface.innerText,
    };
  }, locale);
  if (audit.undersized.length) throw new Error(`Text below 10px in ${selector}: ${JSON.stringify(audit.undersized.slice(0, 12))}`);
  if (audit.clippedControls.length) throw new Error(`Clipped control text in ${selector}: ${JSON.stringify(audit.clippedControls.slice(0, 12))}`);
  if (audit.overflow) throw new Error(`Horizontal overflow in ${selector}`);
  if (audit.navHeight !== null && audit.navHeight !== 54) throw new Error(`Bottom navigation changed to ${audit.navHeight}px`);
  if (locale === 'fa' && (!audit.fontLoaded || !audit.fontFamily.includes('Vazirmatn Variable'))) {
    throw new Error(`Persian font did not resolve: ${JSON.stringify(audit)}`);
  }
  if (locale === 'fa' && /\bLv\./u.test(audit.visibleText)) throw new Error(`English level abbreviation remains in Persian ${selector}`);
  if (locale === 'fa' && audit.visibleText.includes('Warden of Dawnkeep')) throw new Error(`English bootstrap title remains in Persian ${selector}`);
  if (locale === 'en' && audit.fontFamily.includes('Vazirmatn Variable')) throw new Error(`English inherited Persian UI font: ${audit.fontFamily}`);
}

async function dismissAdvisorTips(page) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const tip = page.locator('.advisor-context-tip');
    if (!await tip.count()) return;
    await tip.locator('button').click();
    await page.waitForTimeout(100);
  }
}

if (!browserPath) throw new Error('No supported Chromium browser was found.');
mkdirSync(artifacts, { recursive: true });
let client;
let browser;
const browserErrors = [];

try {
  try { await waitForUrl('http://localhost:3000/dev/rtl', 1_000); } catch { client = startClient(); await waitForUrl('http://localhost:3000/dev/rtl'); }
  await waitForUrl('http://localhost:3001/health');
  browser = await chromium.launch({ executablePath: browserPath, headless: true });

  for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 812 }, { width: 390, height: 844 }]) {
    const fixture = await browser.newPage({ viewport });
    fixture.on('console', (message) => { if (message.type() === 'error') browserErrors.push(`${viewport.width} fixture console: ${message.text()}`); });
    fixture.on('pageerror', (error) => browserErrors.push(`${viewport.width} fixture page: ${error.message}`));
    await fixture.goto('http://localhost:3000/dev/rtl', { waitUntil: 'domcontentloaded' });
    await fixture.waitForSelector('[data-rtl-audit="ready"]');
    const fixtureAudit = await fixture.evaluate(() => ({
      faDirection: getComputedStyle(document.querySelector('[data-audit-locale="fa"]')).direction,
      enDirection: getComputedStyle(document.querySelector('[data-audit-locale="en"]')).direction,
      isolatedCount: document.querySelectorAll('[data-audit-locale="fa"] bdi').length,
      numericDirections: [...document.querySelectorAll('[data-audit-locale="fa"] bdi[dir="ltr"]')].map((node) => getComputedStyle(node).direction),
      numericTexts: [...document.querySelectorAll('[data-audit-locale="fa"] bdi[dir="ltr"]')].map((node) => node.textContent ?? ''),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));
    if (fixtureAudit.faDirection !== 'rtl' || fixtureAudit.enDirection !== 'ltr' || fixtureAudit.isolatedCount < 9) throw new Error(`Semantic fixture failed: ${JSON.stringify(fixtureAudit)}`);
    if (fixtureAudit.numericDirections.some((direction) => direction !== 'ltr') || fixtureAudit.overflow) throw new Error(`Bidi fixture layout failed: ${JSON.stringify(fixtureAudit)}`);
    if (fixtureAudit.numericTexts.some((value) => /[0-9]/u.test(value)) || !fixtureAudit.numericTexts.some((value) => /[۰-۹]/u.test(value))) throw new Error(`Persian numeral fixture failed: ${JSON.stringify(fixtureAudit)}`);
    await fixture.screenshot({ path: new URL(`mixed-content-${viewport.width}x${viewport.height}.png`, artifacts).pathname.slice(1), fullPage: true });
    await fixture.close();
  }

  const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
  await routePlayer(page);
  page.on('console', (message) => { if (message.type() === 'error') browserErrors.push(`game console: ${message.text()}`); });
  page.on('pageerror', (error) => browserErrors.push(`game page: ${error.message}`));
  await page.goto('http://localhost:3000/?lang=fa', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-onboarding-step="WELCOME"]');
  await assertSemanticRoot(page, 'fa', 'rtl');
  await page.screenshot({ path: new URL('aren-fa-320x568.png', artifacts).pathname.slice(1) });
  await page.evaluate(async () => { await fetch('http://localhost:3001/onboarding/skip', { method: 'POST' }); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-scene-status="ready"]');
  await assertTypography(page, '.game-viewport', 'fa');
  await assertPersianNumerals(page, '.game-viewport');
  await page.screenshot({ path: new URL('kingdom-hud-fa-320x568.png', artifacts).pathname.slice(1) });
  await page.locator('[data-world-building-id="farm"]').evaluate((button) => button.click());
  await page.waitForSelector('[data-building-sheet="farm"]');
  await assertTypography(page, '.building-sheet', 'fa');
  await assertPersianNumerals(page, '.building-sheet');
  await page.screenshot({ path: new URL('building-detail-fa-320x568.png', artifacts).pathname.slice(1) });
  await page.locator('[data-nav-id="heroes"]').click();
  await page.waitForSelector('[data-army-status="ready"]');
  await dismissAdvisorTips(page);
  await assertTypography(page, '.heroes-scroll', 'fa');
  await assertPersianNumerals(page, '.heroes-scroll');
  await page.screenshot({ path: new URL('army-fa-320x568.png', artifacts).pathname.slice(1) });
  await page.locator('.army-commanders button').first().click();
  await page.waitForSelector('[data-hero-sheet]');
  await page.waitForTimeout(350);
  await assertTypography(page, '.hero-sheet', 'fa');
  await assertPersianNumerals(page, '.hero-sheet');
  const commanderUi = await page.evaluate(() => {
    const portrait = document.querySelector('.hero-sheet__portrait');
    const image = document.querySelector('.hero-sheet__portrait img');
    const icon = document.querySelector('.army-quantity-stepper svg');
    const stepper = document.querySelector('.army-quantity-stepper');
    if (!portrait || !image || !icon || !stepper) return null;
    const portraitRect = portrait.getBoundingClientRect();
    const iconRect = icon.getBoundingClientRect();
    const stepperRect = stepper.getBoundingClientRect();
    return { aspect: portraitRect.width / portraitRect.height, iconWidth: iconRect.width, iconHeight: iconRect.height, stepperHeight: stepperRect.height, objectPosition: getComputedStyle(image).objectPosition };
  });
  if (!commanderUi || Math.abs(commanderUi.aspect - 16 / 9) > .04 || commanderUi.iconWidth > 14 || commanderUi.iconHeight > 14 || commanderUi.stepperHeight > 35) throw new Error(`Commander UI proportions failed: ${JSON.stringify(commanderUi)}`);
  await page.screenshot({ path: new URL('hero-detail-fa-320x568.png', artifacts).pathname.slice(1) });
  await page.locator('.hero-sheet__close').click();
  await page.locator('[data-nav-id="raid"]').click();
  await page.waitForSelector('[data-raid-state="overview"]');
  await dismissAdvisorTips(page);
  await assertTypography(page, '.raid-content', 'fa');
  await page.locator('[data-guide-target="find-enemy"]').click();
  await page.waitForSelector('[data-raid-state="offer"]');
  await dismissAdvisorTips(page);
  await assertPersianNumerals(page, '.raid-content');
  await page.screenshot({ path: new URL('raid-opponent-fa-320x568.png', artifacts).pathname.slice(1) });
  await page.locator('[data-guide-target="attack"]').click();
  await page.waitForSelector('[data-raid-state="battle"]');
  await page.waitForTimeout(700);
  await page.screenshot({ path: new URL('army-battle-fa-320x568.png', artifacts).pathname.slice(1) });
  await page.waitForSelector('[data-raid-state="result"]', { timeout: 20_000 });
  await assertTypography(page, '.raid-result', 'fa');
  await assertPersianNumerals(page, '.raid-result');
  await page.screenshot({ path: new URL('army-result-fa-320x568.png', artifacts).pathname.slice(1) });
  await page.locator('.raid-result .raid-secondary').click();
  await page.locator('.raid-titlebar__log').click();
  await page.waitForSelector('[data-raid-state="inbox"]');
  await page.waitForFunction(() => !document.querySelector('.battle-log__empty > span'));
  await dismissAdvisorTips(page);
  await assertTypography(page, '.battle-log', 'fa');
  await assertPersianNumerals(page, '.battle-log');
  await page.screenshot({ path: new URL('battle-log-fa-320x568.png', artifacts).pathname.slice(1) });

  await page.goto('http://localhost:3000/?lang=fa&section=raid', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.combat-mode-tabs');
  await page.locator('.combat-mode-tabs button').nth(1).click();
  await page.waitForSelector('.campaign-map');
  await dismissAdvisorTips(page);
  await assertTypography(page, '.campaign-map', 'fa');
  await assertPersianNumerals(page, '.campaign-map');
  await page.screenshot({ path: new URL('campaign-fa-320x568.png', artifacts).pathname.slice(1) });
  await page.locator('[data-stage-key="FRONTIER_01"]').click();
  await page.waitForSelector('[data-campaign-stage-detail="FRONTIER_01"]');
  await assertTypography(page, '.campaign-stage-sheet', 'fa');
  await page.screenshot({ path: new URL('campaign-stage-detail-fa-320x568.png', artifacts).pathname.slice(1) });

  for (const viewport of [{ width: 375, height: 812 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto('http://localhost:3000/?lang=fa', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-scene-status="ready"]');
    await assertSemanticRoot(page, 'fa', 'rtl');
    await assertTypography(page, '.game-viewport', 'fa');
    await page.screenshot({ path: new URL(`kingdom-hud-fa-${viewport.width}x${viewport.height}.png`, artifacts).pathname.slice(1) });
    await page.locator('[data-nav-id="heroes"]').click();
    await page.waitForSelector('[data-army-status="ready"]');
    await dismissAdvisorTips(page);
    await assertTypography(page, '.heroes-scroll', 'fa');
    await assertPersianNumerals(page, '.heroes-scroll');
    await page.screenshot({ path: new URL(`army-fa-${viewport.width}x${viewport.height}.png`, artifacts).pathname.slice(1) });
    await page.locator('.army-commanders button').first().click();
    await page.waitForSelector('[data-hero-sheet]');
    await page.waitForTimeout(350);
    await assertTypography(page, '.hero-sheet', 'fa');
    await assertPersianNumerals(page, '.hero-sheet');
    await page.screenshot({ path: new URL(`hero-detail-fa-${viewport.width}x${viewport.height}.png`, artifacts).pathname.slice(1) });
    await page.goto('http://localhost:3000/?lang=fa&section=raid', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.combat-mode-tabs');
    await page.locator('.combat-mode-tabs button').nth(1).click();
    await page.waitForSelector('.campaign-map');
    await dismissAdvisorTips(page);
    await assertTypography(page, '.campaign-map', 'fa');
    await page.screenshot({ path: new URL(`campaign-fa-${viewport.width}x${viewport.height}.png`, artifacts).pathname.slice(1) });
  }

  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto('http://localhost:3000/?lang=en&section=heroes', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-army-status="ready"]');
    await dismissAdvisorTips(page);
    await assertSemanticRoot(page, 'en', 'ltr');
    await assertTypography(page, '.heroes-scroll', 'en');
    await page.screenshot({ path: new URL(`army-en-${viewport.width}x${viewport.height}.png`, artifacts).pathname.slice(1) });
    await page.goto('http://localhost:3000/?lang=en&section=raid', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.combat-mode-tabs');
    await page.locator('.combat-mode-tabs button').nth(1).click();
    await page.waitForSelector('.campaign-map');
    await dismissAdvisorTips(page);
    await assertTypography(page, '.campaign-map', 'en');
    await page.screenshot({ path: new URL(`campaign-en-${viewport.width}x${viewport.height}.png`, artifacts).pathname.slice(1) });
  }

  if (browserErrors.length) throw new Error(browserErrors.join('\n'));
  console.log('PASS semantic FA/RTL and EN/LTR roots, document metadata, isolated mixed tokens, and no horizontal overflow');
  console.log('PASS Vazirmatn Persian root, English font separation, 10px production text floor, unclipped controls, and 54px navigation');
  console.log('PASS screenshots: Kingdom HUD, Building Detail, Aren, Army, Commander Detail, Raid opponent, Army Battle, Army result, Battle Log, Campaign map/detail, mixed content');
  console.log('PASS Persian viewports: 320x568, 375x812, 390x844; English viewports: 320x568, 390x844');
} finally {
  await browser?.close();
  client?.kill();
}
