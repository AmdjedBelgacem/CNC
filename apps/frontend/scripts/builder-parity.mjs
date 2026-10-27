#!/usr/bin/env node
/**
 * Compare every builder page against its published public page.
 *
 * The builder canvas is a Puck iframe (`about:srcdoc`); repository-managed
 * sections render as nested `/preview/island/*` iframes. The public page renders
 * the same components inline. This script aggregates the canvas + island frames
 * and compares them with the public page's `<main>` content, so app-shell nav and
 * footer headings (which are not part of the page layout) are excluded.
 *
 * Usage:
 *   ADMIN_BASE=http://localhost:3301 node scripts/builder-parity.mjs
 *   ADMIN_BASE=https://barootcnc.com node scripts/builder-parity.mjs
 *
 * Env:
 *   ADMIN_EMAIL / ADMIN_PASSWORD  login (defaults to the seeded superadmin)
 *   COLOR_MODE=light|dark|system  cookie sent before login (default light)
 *   ADMIN_TENANT                  tenant cookie (default cnc-fundamentals)
 */
import { chromium } from 'playwright';

const BASE = process.env.ADMIN_BASE ?? 'http://localhost:3301';
const HOST = new URL(BASE).hostname;
const EMAIL = process.env.ADMIN_EMAIL ?? 'superadmin@titansofmanufacturing.com';
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'Test1234!';
const TENANT = process.env.ADMIN_TENANT ?? 'cnc-fundamentals';
const COLOR_MODE = process.env.COLOR_MODE ?? 'light';

const PAGES = [
  ['home', '/', '/admin/builder'],
  ['academy-landing', '/academy', '/admin/builder?page=academy-landing'],
  ['products', '/products', '/admin/builder?page=products'],
  ['feed', '/feed', '/admin/builder?page=feed'],
  ['events', '/events', '/admin/builder?page=events'],
  ['about', '/about', '/admin/builder?page=about'],
  ['privacy', '/privacy', '/admin/builder?page=privacy'],
  ['refunds', '/refunds', '/admin/builder?page=refunds'],
  ['terms', '/terms', '/admin/builder?page=terms'],
  ['edu-purchases', '/edu-purchases', '/admin/builder?page=edu-purchases'],
];

const snapshot = (target) =>
  target.evaluate(() => {
    const clean = (s) => s.replace(/\s+/g, ' ').trim();
    const root = document.querySelector('main') ?? document.body;
    return {
      cls: document.documentElement.className,
      scheme: getComputedStyle(document.documentElement).colorScheme,
      bg: getComputedStyle(document.body).backgroundColor,
      color: getComputedStyle(document.body).color,
      headings: [...root.querySelectorAll('h1,h2,h3')]
        .map((e) => clean(e.textContent))
        .filter(Boolean),
      images: [...root.querySelectorAll('img')]
        .map((e) => e.getAttribute('src'))
        .filter(Boolean)
        .map((s) => s.split('?')[0]),
    };
  });

const merge = (snaps) => {
  const base = snaps.find(Boolean);
  return {
    scheme: base?.scheme,
    bg: base?.bg,
    color: base?.color,
    headings: [...new Set(snaps.filter(Boolean).flatMap((s) => s.headings))],
    images: [...new Set(snaps.filter(Boolean).flatMap((s) => s.images))],
  };
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 }, locale: 'en' });
await ctx.addCookies([
  { name: 'x-tenant-slug', value: TENANT, domain: HOST, path: '/' },
  { name: 'NEXT_LOCALE', value: 'en', domain: HOST, path: '/' },
  { name: 'titans:color-mode', value: COLOR_MODE, domain: HOST, path: '/' },
]);
const page = await ctx.newPage();

// A pre-minted access token lets this run against a production tenant whose
// admin password is not available locally (Supabase-backed accounts). The
// cookie is `__Host-`-prefixed in production, so it must be host-only, Secure,
// and Path=/ — `url` (rather than `domain`) produces exactly that.
if (process.env.ADMIN_ACCESS_TOKEN) {
  await ctx.addCookies([
    {
      name: '__Host-access',
      value: process.env.ADMIN_ACCESS_TOKEN,
      url: BASE,
      secure: BASE.startsWith('https'),
      httpOnly: true,
      sameSite: 'Lax',
      expires: Math.floor(Date.now() / 1000) + 20 * 60,
    },
  ]);
  console.log(`using a pre-minted access token at ${BASE} (mode=${COLOR_MODE})`);
} else {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#email', { state: 'visible', timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  await page.click('button[type="submit"]');
  for (let i = 0; i < 60 && page.url().includes('/login'); i++) await page.waitForTimeout(500);
  if (page.url().includes('/login')) {
    console.error('login failed');
    process.exit(1);
  }
  console.log(`signed in as ${EMAIL} at ${BASE} (mode=${COLOR_MODE})`);
}

let failures = 0;
for (const [slug, publicPath, builderPath] of PAGES) {
  let pub;
  let b;
  try {
    await page.goto(BASE + publicPath, { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForTimeout(1500);
    pub = await snapshot(page);

    await page.goto(BASE + builderPath, { waitUntil: 'networkidle', timeout: 90000 });
    let canvas = null;
    for (let i = 0; i < 40; i++) {
      canvas = page.frames().find((f) => f.url() === 'about:srcdoc');
      if (canvas) break;
      await page.waitForTimeout(1000);
    }
    if (!canvas) throw new Error('builder canvas iframe not found');
    // Let nested live-island iframes mount and settle.
    await page.waitForTimeout(3500);
    const frames = [
      canvas,
      ...page.frames().filter((f) => f.url().includes('/preview/island/')),
    ];
    const snaps = await Promise.all(
      frames.map((f) => snapshot(f).catch(() => null)),
    );
    b = merge(snaps);

    // The homepage renderer intentionally drops seed testimonials: there is no
    // public testimonials source, so the builder shows the block with a
    // "Hidden on the homepage" notice instead. Subtract that block's output so
    // the audit still catches every real parity difference.
    if (slug === 'home') {
      const hidden = await canvas.evaluate((headingText) => {
        const clean = (s) => s.replace(/\s+/g, ' ').trim();
        const heading = [...document.querySelectorAll('h1,h2,h3')].find(
          (e) => clean(e.textContent) === headingText,
        );
        const section = heading?.closest('section') ?? heading?.parentElement;
        if (!section) return { headings: [], images: [] };
        return {
          headings: [...section.querySelectorAll('h1,h2,h3')]
            .map((e) => clean(e.textContent))
            .filter(Boolean),
          images: [...section.querySelectorAll('img')]
            .map((e) => e.getAttribute('src'))
            .filter(Boolean)
            .map((s) => s.split('?')[0]),
        };
      }, 'Trained by Industry Authorities. Endorsed by Machine Shops.');
      const hiddenHeadings = new Set(hidden.headings);
      const hiddenImages = new Set(hidden.images);
      b.headings = b.headings.filter((h) => !hiddenHeadings.has(h));
      b.images = b.images.filter((s) => !hiddenImages.has(s));
      if (hiddenHeadings.size || hiddenImages.size) {
        console.log(
          `   note: home hides ${hiddenHeadings.size} testimonial heading(s) and ${hiddenImages.size} image(s) by design`,
        );
      }
    }
  } catch (e) {
    console.log(`FAIL ${slug.padEnd(16)} ${String(e).split('\n')[0].slice(0, 120)}`);
    failures++;
    continue;
  }

  const themeOk = pub.scheme === b.scheme && pub.bg === b.bg && pub.color === b.color;
  const missing = pub.headings.filter((h) => !b.headings.includes(h));
  const extra = b.headings.filter((h) => !pub.headings.includes(h));
  const headingsOk = missing.length === 0 && extra.length === 0;
  const pubImgs = new Set(pub.images);
  const bImgs = new Set(b.images);
  const imgMissing = [...pubImgs].filter((s) => !bImgs.has(s)).length;
  const imgExtra = [...bImgs].filter((s) => !pubImgs.has(s)).length;
  const imagesOk = imgMissing === 0 && imgExtra === 0;
  const ok = themeOk && headingsOk && imagesOk;
  if (!ok) failures++;

  console.log(
    `${ok ? 'PASS' : 'FAIL'} ${slug.padEnd(16)} theme=${themeOk ? 'ok' : `${pub.scheme}/${b.scheme} ${pub.bg}/${b.bg}`}` +
      ` headings=${headingsOk ? `${pub.headings.length}` : `-${missing.length}/+${extra.length}`}` +
      ` images=${imagesOk ? `${pubImgs.size}` : `-${imgMissing}/+${imgExtra}`}`,
  );
  if (!headingsOk) {
    if (missing.length) console.log('   public only:', missing.slice(0, 6).map((s) => s.slice(0, 70)));
    if (extra.length) console.log('   builder only:', extra.slice(0, 6).map((s) => s.slice(0, 70)));
  }
  if (!themeOk) console.log('   theme:', { public: pub, builder: b });
}

await browser.close();
console.log(failures ? `\n${failures} page(s) differ` : '\nall pages match');
process.exit(failures ? 1 : 0);
