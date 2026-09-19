#!/usr/bin/env node
/**
 * Live verification of refresh-token rotation. Two directions, because a fix that
 * only passes one of them is worse than no fix:
 *
 *   (A) CONCURRENCY — two simultaneous refreshes with the same token. Exactly one
 *       must succeed, and the token family must be left intact. Before the atomic
 *       claim both returned 200 and one session ended up holding two live tokens.
 *
 *   (B) THEFT — a token replayed after the grace window. This must still be denied
 *       AND the whole family revoked. If (A) is "fixed" by simply never revoking,
 *       (B) fails and this script catches it.
 *
 * Usage:  node scripts/verify/refresh-rotation.mjs
 * Env:    API_BASE (default http://localhost:4000), TENANT (default cnc-fundamentals),
 *         DATABASE_URL (falls back to apps/backend/.env)
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = process.env.API_BASE || 'http://localhost:4000';
const TENANT = process.env.TENANT || 'cnc-fundamentals';
const EMAIL = process.env.VERIFY_EMAIL || 'admin@titansofmanufacturing.com';
const PASSWORD = process.env.VERIFY_PASSWORD || 'Test1234!';
const GRACE_MS = Number(process.env.REFRESH_REUSE_GRACE_MS ?? 10_000);
const PSQL = process.env.PSQL || '/opt/homebrew/opt/postgresql@18/bin/psql';

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = readFileSync(join(ROOT, 'apps/backend/.env'), 'utf8');
  const line = env.split('\n').find((l) => l.startsWith('DATABASE_URL='));
  if (!line) throw new Error('DATABASE_URL not set and not found in apps/backend/.env');
  return line.slice('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
}
const DSN = databaseUrl();

const jar = (res) => {
  const out = {};
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const pair = c.split(';')[0];
    const i = pair.indexOf('=');
    if (i !== -1) out[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
  }
  return out;
};
const cookieHeader = (o) => Object.entries(o).map(([k, v]) => `${k}=${v}`).join('; ');

function liveTokens() {
  const sql = `SELECT count(*) FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
    WHERE u.email = '${EMAIL}' AND rt.is_revoked = false AND rt.expires_at > now();`;
  return parseInt(execFileSync(PSQL, [DSN, '-tAc', sql], { encoding: 'utf8' }).trim(), 10);
}

async function newSession() {
  let res = await fetch(`${BASE}/auth/csrf-token`, { headers: { 'x-tenant-slug': TENANT } });
  const csrfJar = jar(res);
  const csrfToken = (await res.json()).csrfToken;
  res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json', 'x-tenant-slug': TENANT,
      'x-csrf-token': csrfToken, cookie: cookieHeader(csrfJar),
    },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  const body = await res.json();
  if (body.twoFactorRequired) throw new Error('this account has 2FA enabled; use a plain admin for this check');
  return { cookies: { ...csrfJar, ...jar(res) }, csrfToken };
}

const refresh = (cookies, csrfToken) =>
  fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json', 'x-tenant-slug': TENANT,
      'x-csrf-token': csrfToken, cookie: cookieHeader(cookies),
    },
    body: '{}',
  });

let failures = 0;
const check = (ok, label, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
  if (!ok) failures++;
};

console.log('=== (A) concurrency: two refreshes, one token ===');
{
  const { cookies, csrfToken } = await newSession();
  const before = liveTokens();
  const [a, b] = await Promise.all([refresh(cookies, csrfToken), refresh(cookies, csrfToken)]);
  const codes = [a.status, b.status].sort((x, y) => x - y);
  const after = liveTokens();
  console.log(`  statuses ${codes.join(' / ')}   live tokens ${before} -> ${after}`);
  check(codes.filter((c) => c === 200).length === 1, 'exactly one refresh succeeded');
  check(codes.filter((c) => c === 401).length === 1, 'exactly one refresh was denied');
  check(after === before, 'token family intact (no account-wide logout)');
}

console.log('\n=== (B) theft: replay after the grace window ===');
{
  const { cookies, csrfToken } = await newSession();
  const before = liveTokens();
  const rotated = await refresh(cookies, csrfToken);
  const afterRotate = liveTokens();
  console.log(`  rotate ${rotated.status}   live tokens ${before} -> ${afterRotate}`);
  check(rotated.status === 200, 'rotation succeeded');

  console.log(`  waiting ${(GRACE_MS + 1500) / 1000}s to leave the grace window...`);
  await new Promise((r) => setTimeout(r, GRACE_MS + 1500));

  const replay = await refresh(cookies, csrfToken);
  const afterReplay = liveTokens();
  console.log(`  replay ${replay.status}   live tokens ${afterReplay}`);
  check(replay.status === 401, 'stale replay denied');
  check(afterReplay < afterRotate, 'family revoked on theft');
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
