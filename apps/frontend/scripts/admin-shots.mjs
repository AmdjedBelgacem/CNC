#!/usr/bin/env node
/**
 * Screenshot admin screens and report any console/page errors.
 *
 * The redesign work could not be judged from a compiler alone, so this logs in
 * with a real admin session and captures each requested route. Runtime errors
 * and failed requests are surfaced alongside the image, because a screen that
 * renders a Next.js error boundary looks like a styled layout in a screenshot.
 *
 * Usage: node scripts/admin-shots.mjs [route ...]
 *   defaults to every screen in the redesign scope
 *
 * Env:
 *   ADMIN_LOCALE=ar  capture in Arabic (RTL). Filenames gain an `_ar` suffix so
 *                    both locales can be compared side by side.
 *   ADMIN_VIEWPORT   WxH, e.g. 1280x900
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

/* :3000 is the port scripts/dev-up.sh and .env.local use. */
const BASE = process.env.ADMIN_BASE ?? 'http://localhost:3000';
const TENANT = 'cnc-fundamentals';
const EMAIL = 'superadmin@titansofmanufacturing.com';
const PASSWORD = 'Test1234!';
const OUT = '/tmp/admin-shots';
/* The app reads its locale from the NEXT_LOCALE cookie; setting it on the
 * context (rather than relying on Accept-Language) makes the capture
 * deterministic and lets the RTL pass be reproduced. */
const LOCALE = process.env.ADMIN_LOCALE ?? 'en';
const [VW, VH] = (process.env.ADMIN_VIEWPORT ?? '1600x1100').split('x').map(Number);

const DEFAULT_ROUTES = [
  ['products', '/admin/products'],
  ['products-new', '/admin/products/new'],
  ['academies', '/admin/academies'],
  ['academies-new', '/admin/academies/new'],
  ['courses', '/admin/courses'],
  ['courses-new', '/admin/courses/new'],
  ['certificates', '/admin/certificates'],
  ['settings', '/admin/settings'],
  ['settings-ai', '/admin/settings/ai-assistant'],
  ['analytics', '/admin/analytics'],
  ['users', '/admin/users'],
  ['staff', '/admin/staff'],
];

const requested = process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_ROUTES.map(([, p]) => p);
// Normalise every entry to an absolute URL, whatever form it arrived in.
const routes = requested.map((r) => {
  // Keep the query string in the filename. Steps of a wizard (e.g. the Course
  // Studio's ?step=media) otherwise all collapse onto one name and overwrite
  // each other, so only the last capture survives.
  const name = r
    .replace(/\?/g, '-')
    .replace(/&/g, '-')
    .replace(/[^\w-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  return [name || 'route', r.startsWith('http') ? r : BASE + (r.startsWith('/') ? r : `/${r}`)];
});

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: VW, height: VH },
  deviceScaleFactor: 1,
  locale: LOCALE,
});
const page = await ctx.newPage();

const problems = [];
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`console: ${m.text().slice(0, 300)}`);
});
page.on('pageerror', (e) => problems.push(`pageerror: ${String(e).slice(0, 300)}`));
page.on('response', (r) => {
  if (r.status() >= 500) problems.push(`http ${r.status()}: ${r.url().replace(BASE, '')}`);
});

/* Sign in through the real login form so the app's own cookie handling applies.
 * Hand-setting the cookies fails because several are __Host- prefixed, which
 * browsers only accept over a secure origin with path=/. */
// The API client reads the tenant from a cookie; without it the login call has
// no tenant context and is rejected.
await ctx.addCookies([
  { name: 'x-tenant-slug', value: TENANT, domain: 'localhost', path: '/' },
  { name: 'NEXT_LOCALE', value: LOCALE, domain: 'localhost', path: '/' },
]);
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });
// The form is client-rendered and validated on submit, so filling before
// hydration silently produces empty values.
await page.waitForSelector('#email', { state: 'visible', timeout: 30000 });
await page.waitForFunction(() => !!document.querySelector('form'), null, { timeout: 30000 });
await page.waitForTimeout(1200);
await page.fill('#email', EMAIL, { timeout: 15000 });
await page.fill('#password', PASSWORD, { timeout: 15000 });
// Confirm the inputs actually took the values before submitting.
const filled = await page.evaluate(() => [
  (document.querySelector('#email') ?? {}).value,
  (document.querySelector('#password') ?? {}).value,
]);
if (!filled[0] || !filled[1]) {
  console.error('login form did not accept input:', filled);
  await browser.close();
  process.exit(1);
}

// The form posts through the proxy and then routes client-side, so a single
// waitForURL can resolve before hydration. Poll the URL instead.
await page.click('button[type="submit"]');
let signedIn = false;
for (let i = 0; i < 40 && !signedIn; i++) {
  await page.waitForTimeout(500);
  signedIn = !page.url().includes('/login');
}
if (!signedIn) {
  const err = ((await page.textContent('body')) ?? '').replace(/\s+/g, ' ').slice(0, 200);
  console.error('login did not leave /login:', err);
  await browser.close();
  process.exit(1);
}
console.log(`signed in as ${EMAIL}; now at ${page.url()}`);

let failures = 0;
for (const [name, url] of routes) {
  problems.length = 0;
  const before = problems.length;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  } catch (e) {
    console.log(`  ${name.padEnd(20)} NAV FAIL ${String(e).split('\n')[0].slice(0, 90)}`);
    failures++;
    continue;
  }
  // Let charts and skeletons settle.
  await page.waitForTimeout(1800);
  const file = `${OUT}/${LOCALE === 'en' ? name : `${name}_${LOCALE}`}.png`;
  await page.screenshot({ path: file, fullPage: true });

  // A visible error boundary is the failure mode a screenshot hides.
  const bodyText = (await page.textContent('body')) ?? '';
  const broken =
    /Application error|Unhandled Runtime|Cannot read properties|is not a function|Failed to load|ECONNREFUSED/i.test(
      bodyText.slice(0, 4000),
    );
  const issues = problems.slice(before);
  const status = broken ? 'BROKEN' : issues.length ? 'WARN' : 'ok';
  if (broken) failures++;
  console.log(
    `  ${name.padEnd(20)} ${status.padEnd(7)} ${file}` +
      (broken ? '  <- visible error text' : '') +
      (issues.length ? `\n      ${issues.slice(0, 3).join('\n      ')}` : ''),
  );
}

await browser.close();
console.log(failures ? `\n${failures} route(s) need attention` : '\nall routes rendered clean');
