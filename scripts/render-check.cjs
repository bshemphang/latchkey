/* Render check for Latchkey: load the preview, capture console errors,
   screenshot the hero, then exercise the analyse loop and screenshot again.
   Uses the persistent browser profile (~/workspace/.browser-profile).

   Two modes, detected from the header pill:
   - Demo mode (Firebase not configured): the mock loop runs end to end;
     extraction, scam verdict, on-device badges and resume bullets must show.
   - Configured mode (Firebase connected): the real Firebase AI Logic path
     runs. In this VM headless Chromium has no internet and no Gemini Nano,
     so the analyse call fails; the check verifies it fails GRACEFULLY
     (a readable error message, no crash, no console errors) rather than
     producing results. The real on-device/cloud calls are verified on a
     real Chrome with Nano (Nov 23 test matrix) and by the Node smoke test
     (scripts/smoke-real-ai.mjs). */
const { chromium } = require('playwright-core');
const os = require('node:os');
const path = require('node:path');

const PROFILE = path.join(os.homedir(), 'workspace', '.browser-profile');
const EXE = path.join(
  os.homedir(),
  '.cache/ms-playwright/chromium-1148/chrome-linux/chrome',
);

(async () => {
  const context = await chromium.launchPersistentContext(PROFILE, {
    headless: true,
    executablePath: EXE,
    args: ['--no-sandbox'],
  });
  const page = await context.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const heroText = await page.textContent('h1');
  console.log('HERO:', JSON.stringify(heroText));
  await page.screenshot({ path: '/tmp/latchkey-hero.png' });

  const headerText = await page.textContent('header');
  const configured = /Firebase connected/.test(headerText ?? '');
  console.log('MODE:', configured ? 'configured (real Firebase AI Logic)' : 'demo (mock layer)');

  // Load the clean sample and analyse.
  await page.getByText('Try sample: Clean listing').click();
  await page.getByText('Analyse posting', { exact: false }).click();

  // Wait for either results or a graceful error (real path has no internet here).
  let bodyText = '';
  let settled = false;
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(500);
    bodyText = (await page.textContent('body')) ?? '';
    if (/Must-have skills/.test(bodyText) || /Analysis failed|Couldn't reach|fetch failed|Failed to fetch|network/i.test(bodyText)) {
      settled = true;
      break;
    }
  }
  console.log('SETTLED:', settled);
  const checks = {
    // "Must-have skills" only exists in the rendered extraction card (the
    // pasted sample text also mentions Northwind, so that is not a signal).
    extractionCardShown: /Must-have skills/.test(bodyText),
    // "Looks clean" only exists in the rendered green scam verdict.
    scamVerdictShown: /Looks clean/.test(bodyText),
    // The badge is "On-device" + a latency pill ("123 ms"); the static
    // headings ("On-device · Gemini Nano") have no latency next to them.
    onDeviceBadge: /On-device.{0,80}\d[\d,]* ms/.test(bodyText),
    tailorSection: /Tailor my application/.test(bodyText),
    gracefulErrorShown: /Couldn't reach the AI service|Analysis failed|fetch failed|Failed to fetch|network|unavailable|timed out/i.test(bodyText),
  };
  console.log('CHECKS:', JSON.stringify(checks, null, 1));
  await page.screenshot({ path: '/tmp/latchkey-results.png', fullPage: true });

  if (!configured) {
    // Resume bullets (on-device) — only meaningful in demo mode, where the
    // mock loop produced an extraction to tailor from.
    await page.getByRole('button', { name: 'Resume bullets' }).click();
    await page.waitForTimeout(1500);
    const afterBullets = await page.textContent('body');
    console.log('BULLETS_SHOWN:', /Used|Applied|Completed/i.test(afterBullets));
  } else {
    console.log('BULLETS_SHOWN: skipped (configured mode, no extraction in this VM)');
  }

  // Classify console errors. Two kinds are known environmental noise in
  // this VM (headless Chromium has no internet): external resources that
  // fail to load (Google Fonts — loads fine on the hosted site), and the
  // Firebase SDK logging its own failed fetch when the AI endpoint is
  // unreachable (the app catches the rejection and shows a friendly error;
  // see the screenshot). Anything else is a real problem.
  const networkErrors = errors.filter((e) => /Failed to load resource: net::ERR_TUNNEL_CONNECTION_FAILED/.test(e));
  const sdkFetchErrors = errors.filter((e) => /TypeError: Failed to fetch/.test(e));
  const otherErrors = errors.filter(
    (e) => !/Failed to load resource: net::ERR_TUNNEL_CONNECTION_FAILED/.test(e) && !/TypeError: Failed to fetch/.test(e),
  );
  console.log('CONSOLE_ERRORS: network (fonts, VM-only):', networkErrors.length, '| SDK fetch noise (VM-only, no internet):', sdkFetchErrors.length, '| OTHER:', otherErrors.length === 0 ? 'none' : JSON.stringify(otherErrors.slice(0, 5)));
  await context.close();
})().catch((e) => {
  console.error('SCRIPT FAILED:', e.message);
  process.exit(1);
});
