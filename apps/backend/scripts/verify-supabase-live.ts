/**
 * Proves the JWKS verifier against the live Supabase project: a real ES256 token must
 * verify, and tampered / downgraded / unsigned variants must be rejected.
 *
 * Run with the project's keys present in the repo-root .env.
 *   npx tsx scripts/verify-supabase-live.ts
 */
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { ConfigService } from '../src/config/config.service';
import { SupabaseTokenVerifier } from '../src/modules/auth/supabase-token.verifier';

const env: Record<string, string> = {};
for (const file of ['../../.env', '../.env']) {
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
      if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    /* optional */
  }
}

// ConfigService reads process.env directly in its constructor and takes no arguments.
for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v;

const config = new ConfigService();
const verifier = new SupabaseTokenVerifier(config);

async function main() {
  const url = env.SUPABASE_URL!;
  const publishable = env.SUPABASE_PUBLISHABLE_KEY!;

  console.log(`project: ${url}`);
  console.log(`jwks   : ${verifier['jwksUrl' as keyof typeof verifier] ?? '(derived)'}\n`);

  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: publishable, 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'jwks-probe@example.com', password: 'Pr0be-Passw0rd!x9' }),
  });
  const body = (await res.json()) as { access_token?: string };
  const token = body.access_token;
  if (!token) {
    console.error('could not obtain a token — is the probe user present?');
    process.exit(1);
  }

  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const [h, p, s] = token.split('.') as [string, string, string];

  const cases: Array<[string, string, boolean]> = [
    ['genuine ES256 token', token, true],
    ['payload tampered', `${h}.${b64({ ...JSON.parse(Buffer.from(p, 'base64url')), role: 'super_admin' })}.${s}`, false],
    ['downgraded to HS256', `${b64({ alg: 'HS256', typ: 'JWT' })}.${p}.${s}`, false],
    ['alg:none', `${b64({ alg: 'none', typ: 'JWT' })}.${p}.`, false],
    [
      'HS256 signed with a guessed secret',
      `${b64({ alg: 'HS256', typ: 'JWT' })}.${p}.${createHmac('sha256', 'secret').update(`${b64({ alg: 'HS256', typ: 'JWT' })}.${p}`).digest('base64url')}`,
      false,
    ],
    ['garbage', 'not-a-token', false],
    ['empty', '', false],
  ];

  let pass = 0;
  let fail = 0;
  for (const [label, candidate, shouldPass] of cases) {
    let ok = false;
    let detail = '';
    try {
      const claims = await verifier.verify(candidate);
      ok = true;
      detail = `sub=${claims.sub} role=${claims.role}`;
    } catch (e) {
      detail = e instanceof Error ? e.message : String(e);
    }
    const good = ok === shouldPass;
    good ? (pass += 1) : (fail += 1);
    console.log(`  ${good ? 'PASS' : 'FAIL'}  ${label.padEnd(34)} expected=${shouldPass ? 'accept' : 'reject'} got=${ok ? 'accept' : 'reject'}  ${detail}`);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
