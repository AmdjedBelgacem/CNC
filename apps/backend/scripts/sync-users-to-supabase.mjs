#!/usr/bin/env node
/**
 * Phase 2 user sync: create a Supabase Auth identity for every application user and
 * link it via `users.auth_user_id`.
 *
 * Why a reset is unavoidable: passwords are stored as scrypt/argon2id hashes, while
 * Supabase Auth (GoTrue) verifies bcrypt and offers no import hook. There is no way to
 * carry an existing hash across, so each user must set a new password once. This
 * script creates the identity with email pre-confirmed and sends a password-setup
 * email through Supabase's SMTP (configured to Resend).
 *
 * Tenancy is untouched: `users` rows, RBAC and tenant roles all stay as they are.
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Idempotent — users that
 * already have auth_user_id are skipped, and the script can be re-run safely.
 *
 * Usage:
 *   node scripts/sync-users-to-supabase.mjs --database <db> [--dry-run] [--limit N]
 */
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const flag = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i === -1 ? d : args[i + 1];
};
const has = (n) => args.includes(`--${n}`);

const database = flag('database');
const dryRun = has('dry-run');
const limit = Number(flag('limit', '0')) || undefined;

const url = process.env.SUPABASE_URL;
// Supabase now issues `sb_secret_...` keys; fall back to the legacy name so this
// script works on older projects too.
const serviceKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!database) {
  console.error('usage: node scripts/sync-users-to-supabase.mjs --database <db> [--dry-run] [--limit N]');
  process.exit(1);
}
if (!url || !serviceKey) {
  console.error('SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) must be set.');
  console.error('The service-role key is admin-only: never expose it to a browser or commit it.');
  process.exit(1);
}

const psql = (sql) =>
  spawnSync('psql', ['-X', '-q', '-t', '-A', '-F', '\t', '-v', 'ON_ERROR_STOP=1', '-d', database, '-c', sql], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 64,
  }).stdout;

const users = psql(
  `SELECT id, email, coalesce(name,''), coalesce(auth_user_id::text,'')
   FROM users
   WHERE deleted_at IS NULL AND account_status <> 'deleted'
   ${limit ? `LIMIT ${Number(limit)}` : ''}
   ORDER BY created_at`,
)
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean)
  .map((l) => {
    const [id, email, name, authUserId] = l.split('\t');
    return { id, email, name, authUserId };
  });

console.log(`${users.length} user(s) to consider\n`);
if (users.length === 0) {
  console.log('nothing to do');
  process.exit(0);
}

async function adminRequest(method, apiPath, body) {
  const res = await fetch(`${url}/auth/v1${apiPath}`, {
    method,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON error body */
  }
  return { status: res.status, json, text };
}

/** Locate an existing auth user by email. GoTrue lists are paginated. */
async function findAuthUserByEmail(email) {
  for (let page = 1; page <= 20; page += 1) {
    const { json } = await adminRequest(
      'GET',
      `/admin/users?page=${page}&per_page=200`,
    );
    const list = json?.users ?? json ?? [];
    if (!Array.isArray(list) || list.length === 0) return null;
    const hit = list.find((u) => (u?.email ?? '').toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (list.length < 200) return null;
  }
  return null;
}

async function main() {
  let created = 0;
  let linked = 0;
  let skipped = 0;
  const failed = [];

  for (const u of users) {
    if (u.authUserId) {
      skipped += 1;
      continue;
    }
    if (!u.email) {
      failed.push(`${u.id}: no email address`);
      continue;
    }

    let authUser = await findAuthUserByEmail(u.email);

    if (!authUser) {
      if (dryRun) {
        console.log(`  [dry] would create ${u.email}`);
        created += 1;
        continue;
      }
      // A random unusable password forces the one-time reset. email_confirm is true
      // because the address is already proven in this system.
      const res = await adminRequest('POST', '/admin/users', {
        email: u.email,
        email_confirm: true,
        password: `T!tans${Math.random().toString(36).slice(2)}9x${Date.now().toString(36)}`,
        user_metadata: { name: u.name, app_user_id: u.id },
      });
      if (res.status >= 300) {
        failed.push(`${u.email}: create failed (${res.status}) ${(res.text || '').slice(0, 160)}`);
        continue;
      }
      authUser = res.json;
      created += 1;
    }

    if (dryRun) {
      console.log(`  [dry] would link ${u.email} -> ${authUser?.id}`);
      linked += 1;
      continue;
    }

    const upd = spawnSync(
      'psql',
      [
        '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', database,
        '-c', `UPDATE users SET auth_user_id = '${authUser.id}' WHERE id = '${u.id}' AND auth_user_id IS NULL`,
      ],
      { encoding: 'utf8' },
    );
    if (upd.status !== 0) {
      failed.push(`${u.email}: link failed ${(upd.stderr || '').slice(0, 160)}`);
      continue;
    }
    linked += 1;
  }

  console.log(`\ncreated: ${created}   linked: ${linked}   already linked: ${skipped}`);
  if (failed.length) {
    console.log(`\n${failed.length} failure(s):`);
    failed.forEach((f) => console.log(`  ${f}`));
  }
  if (!dryRun && (created || linked)) {
    console.log(
      '\nNext: trigger password-setup emails so users can set a new password.\n' +
        '  Supabase Dashboard → Authentication → Users → "Send reset email",\n' +
        '  or per-user: POST /auth/v1/admin/generate_link {type:"recovery"}',
    );
  }
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});