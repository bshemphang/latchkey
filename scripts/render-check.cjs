/* Render check for Latchkey: load the preview, capture console errors,
   screenshot the hero, then exercise the mock loop (load the clean sample,
   click Analyse, wait for results) and screenshot again. */
const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1148/chrome-linux/chrome',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
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

  // Load the clean sample and analyse.
  await page.getByText('Try sample: Clean listing').click();
  await page.getByText('Analyse posting', { exact: false }).click();
  await page.waitForTimeout(2500);
  const bodyText = await page.textContent('body');
  const checks = {
    extractionShown: /Northwind/i.test(bodyText),
    scamShown: /Looks clean|Scam check/i.test(bodyText),
    mustHaveShown: /Must-have skills/i.test(bodyText),
    onDeviceBadge: /On-device/i.test(bodyText),
    tailorSection: /Tailor my application/i.test(bodyText),
  };
  console.log('CHECKS:', JSON.stringify(checks, null, 1));
  await page.screenshot({ path: '/tmp/latchkey-results.png', fullPage: true });

  // Resume bullets (on-device).
  await page.getByRole('button', { name: 'Resume bullets' }).click();
  await page.waitForTimeout(1500);
  const afterBullets = await page.textContent('body');
  console.log('BULLETS_SHOWN:', /Used|Applied|Completed/i.test(afterBullets));

  console.log('CONSOLE_ERRORS:', errors.length === 0 ? 'none' : JSON.stringify(errors.slice(0, 5)));
  await browser.close();
})().catch((e) => {
  console.error('SCRIPT FAILED:', e.message);
  process.exit(1);
});
