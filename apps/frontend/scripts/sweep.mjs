#!/usr/bin/env node
/**
 * Route + API sweep.
 *
 * Walks the Next.js app directory to discover every page route, then requests each
 * one as an authenticated super_admin and records the real status. Also probes the
 * API surface the pages depend on.
 *
 * This catches the failure class that unit tests miss: a page that renders but whose
 * data fetch 4xx/5xx, or a route that throws at runtime.
 *
 * Usage: node scripts/sweep.mjs [--base http://localhost:3000] [--email ...] [--password ...]
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const flag = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i === -1 ? d : args[i + 1];
};

const BASE = flag('base', 'http://localhost:3000');
const EMAIL = flag('email', 'superadmin@titansofmanufacturing.com');
// Auth is Supabase-exclusive: this must be the Supabase password, not the
// application's own (which no longer authenticates).
const PASSWORD = flag('password', process.env.SWEEP_PASSWORD || 'SupabaseTest123!x');
const TENANT = flag('tenant', 'cnc-fundamentals');
const APP_DIR = join(process.cwd(), 'src/app');

// Route groups like (admin), (main), (auth) are not part of the URL.
const STRIP = /\/\([^)]+\)/g;

function discover(dir, prefix = '') {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = `${prefix}/${entry}`.replace(STRIP, '');
    if (statSync(full).isDirectory()) {
      if (entry.startsWith('@')) continue; // parallel routes
      if (entry === 'api') continue; // covered separately
      out.push(...discover(full, rel));
      continue;
    }
    // Only `page.*` defines a URL. loading/error/layout/template/not-found are not routes.
    if (/^page\.(tsx|jsx|ts|js)$/.test(entry) && !/\.(test|spec)\./.test(entry)) {
      const route = prefix.replace(STRIP, '') || '/';
      out.push(route === '' ? '/' : route);
    }
  }
  return [...new Set(out)].sort();
}

const routes = discover(APP_DIR);
console.log(`discovered ${routes.length} page routes\n`);

/**
 * Real values for dynamic segments. A literal "[slug]" in a URL is not a valid
 * request, so unresolved dynamic routes are sweep artifacts rather than app bugs.
 * Substituting live identifiers is what actually exercises these pages.
 */
const PARAMS = JSON.parse(flag('params', '{}'));
function resolve(route) {
  if (!route.includes('[')) return route;
  return route
    .replace(/\[slug\]/g, PARAMS.slug ?? 'x')
    .replace(/\[lessonSlug\]/g, PARAMS.lessonSlug ?? 'x')
    .replace(/\[username\]/g, PARAMS.username ?? 'x')
    .replace(/\[userId\]/g, PARAMS.userId ?? 'x')
    .replace(/\[conversationId\]/g, PARAMS.conversationId ?? 'x')
    .replace(/\[number\]/g, PARAMS.number ?? '000000')
    .replace(/\[id\]/g, PARAMS.id ?? 'x');
}

// ---------------------------------------------------------------- session
const jar = '/tmp/sweep-cookies.txt';
spawnSync('rm', ['-f', jar]);
const curl = (args) =>
  spawnSync('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', '-b', jar, '-c', jar, ...args], {
    encoding: 'utf8',
    timeout: 45000,
  }).stdout.trim();

curl([`${BASE}/api/proxy/auth/csrf`]);
const csrf = (spawnSync('bash', ['-c', `awk '/csrf/{print $7}' ${jar} | tail -1`], { encoding: 'utf8' }).stdout || '').trim();

const login = spawnSync(
  'curl',
  [
    '-s', '-b', jar, '-c', jar, '-X', 'POST', `${BASE}/api/proxy/auth/login`,
    '-H', 'content-type: application/json', '-H', `x-csrf-token: ${csrf}`,
    '-H', `x-tenant-slug: ${TENANT}`, '-w', '\\n%{http_code}',
    '-d', JSON.stringify({ email: EMAIL, password: PASSWORD }),
  ],
  { encoding: 'utf8' },
);
const loginCode = (login.stdout || '').trim().split('\n').pop();
if (loginCode !== '200') {
  console.error(`login failed (HTTP ${loginCode}). Is the backend up and seeded?`);
  process.exit(1);
}
console.log(`authenticated as ${EMAIL}\n`);

// ------------------------------------------------------------------ pages
const results = [];
for (const route of routes) {
  const target = resolve(route);
  const code = curl([
    `${BASE}${target}`,
    '-H', `x-tenant-slug: ${TENANT}`,
    '-H', 'accept: text/html',
  ]);
  results.push({ route, resolved: target, code });
  process.stdout.write(code.startsWith('2') || code.startsWith('3') ? '.' : code === '404' ? 's' : 'X');
}
process.stdout.write('\n\n');

// -------------------------------------------------------------------- api
const APIS = [
  ['GET', '/auth/me'], ['GET', '/auth/me/preferences'], ['GET', '/auth/sessions'],
  ['GET', '/auth/login-history'], ['GET', '/auth/me/data'], ['GET', '/auth/oauth/accounts'],
  ['GET', '/admin/ai'], ['GET', '/admin/ai/status'],
  ['GET', '/admin/payments/config'], ['GET', '/admin/payments/orders?limit=5'],
  ['GET', '/portfolio'], ['GET', '/courses/enrollments/mine'],
  ['GET', '/certifications/my'], ['GET', '/notifications'],
  ['GET', '/admin/users'], ['GET', '/admin/analytics/overview'],
  ['GET', '/products'], ['GET', '/courses'], ['GET', '/academies'],
  ['GET', '/events'], ['GET', '/feed'], ['GET', '/ai/config'],
];
for (const [method, path] of APIS) {
  const code = curl(['-X', method, `${BASE}/api/proxy${path}`, '-H', `x-tenant-slug: ${TENANT}`]);
  results.push({ route: `API ${method} ${path}`, code });
}

// ----------------------------------------------------------------- report
const ok = results.filter((r) => r.code.startsWith('2') || r.code.startsWith('3'));
const notFound = results.filter((r) => r.code === '404');
const broken = results.filter((r) => !r.code.startsWith('2') && !r.code.startsWith('3') && r.code !== '404');

console.log(`PASS ${ok.length}   SKIP/404 ${notFound.length}   FAIL ${broken.length}\n`);

if (notFound.length) {
  console.log('404 (expected for dynamic routes with no data, or genuinely missing):');
  notFound.forEach((r) => console.log(`  ${r.code}  ${r.route}`));
  console.log('');
}
if (broken.length) {
  console.log('FAILURES:');
  broken.forEach((r) => console.log(`  ${r.code}  ${r.route}`));
  console.log('');
}

console.log('full page results:');
results
  .filter((r) => !r.route.startsWith('API'))
  .forEach((r) => {
    const shown = r.resolved && r.resolved !== r.route ? `${r.route} -> ${r.resolved}` : r.route;
    console.log(`  ${r.code || 'ERR'}  ${shown}`);
  });

process.exit(broken.length === 0 ? 0 : 1);