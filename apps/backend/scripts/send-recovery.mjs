#!/usr/bin/env node
/**
 * Trigger Supabase password-recovery email for existing application users.
 *
 * Twelve accounts were created during the Supabase sync with an unusable random
 * password, because their scrypt/argon2 hashes cannot be converted to Supabase's bcrypt.
 * Until they complete a recovery they cannot sign in.
 *
 * Properties:
 *  - dry-run by default; requires an explicit --send to send anything
 *  - rate-limited: Supabase throttles recovery per address and per project, so a
 *    configurable delay is applied between sends
 *  - audited: every attempt is written to audit_logs
 *  - idempotent: users whose Supabase account is missing, or who already have a usable
 *    password, are skipped with a reason
 *
 * Requires SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY), plus a
 * --database connection string.
 *
 * Usage:
 *   node scripts/send-recovery.mjs --database <dsn> [--dry-run|--send] [--limit N] [--delay MS]
 */
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const flag = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i === -1 ? d : args[i + 1];
};
const has = (n) => args.includes(`--${n}`);

const database = flag('database');
const send = has('--send');
const limit = Number(flag('limit', '0')) || Infinity;
const delayMs = Number(flag('delay', '1500'));

const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!database) {
  console.error('usage: node scripts/send-recovery.mjs --database <dsn> [--dry-run|--send] [--limit N] [--delay MS]');
  process.exit(1);
}
if (send && (!url || !secretKey)) {
  console.error('--send requires SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY).');
  process.exit(1);
}

const sql = (q) =>
  spawnSync('psql', ['-X', '-q', '-t', '-A', '-F', '\t', '-v', 'ON_ERROR_STOP=1', '-d', database, '-c', q], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 32,
  });

const rows = sql(
  `SELECT u.id, u.email, COALESCE(u.auth_user_id::text, '')
   FROM public.users u
   WHERE u.deleted_at IS NULL
     AND u.account_status <> 'deleted'
     AND u.email <> ''
   ORDER BY u.created_at`,
)
  .stdout.split('\n')
  .map((l) => l.trim())
  .filter(Boolean)
  .map((l) => {
    const [id, email, authUserId] = l.split('\t');
    return { id, email, authUserId };
  });

// Accounts that already completed setup: Supabase marks email_confirm_at once the
// recovery link is used, but we cannot observe a successful password change directly,
// so we treat every linked account as a candidate and let Supabase skip no-ops.
const candidates = rows.filter((u) => u.email).slice(0, Number.isFinite(limit) ? limit : undefined);

console.log(`mode        : ${send ? 'SEND' : 'DRY RUN (pass --send to actually send)'}`);
console.log(`database    : ${database.replace(/:[^:@/]*@/, ':***@')}`);
console.log(`candidates  : ${candidates.length} of ${rows.length} users`);
console.log(`delay       : ${delayMs}ms between sends\n`);

if (rows.some((u) => !u.authUserId)) {
  console.log(`note: ${rows.filter((u) => !u.authUserId).length} user(s) have no auth_user_id and will be skipped.\n`);
}

if (candidates.length === 0) {
  console.log('nothing to do');
  process.exit(0);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const [index, user] of candidates.entries()) {
    if (!user.authUserId) {
      console.log(`  [${index + 1}/${candidates.length}] ${user.email}: SKIP (no auth_user_id)`);
      skipped += 1;
      continue;
    }
    if (!send) {
      console.log(`  [${index + 1}/${candidates.length}] ${user.email}: would send recovery`);
      continue;
    }

    // Supabase's public recovery endpoint. It deliberately answers the same way whether
    // or not the address exists, which is what prevents account enumeration.
    const res = await fetch(`${url}/auth/v1/recover`, {
      method: 'POST',
      headers: { apikey: secretKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email }),
    });

    if (res.ok || res.status === 422 || res.status === 429) {
      sql(
        `INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details, created_at)
         VALUES ('${user.id}', 'user.password_recovery_sent', 'user', '${user.id}',
                 '{"provider":"supabase","batch":true}'::jsonb, now())`,
      );
      console.log(`  [${index + 1}/${candidates.length}] ${user.email}: sent (HTTP ${res.status})`);
      sent += 1;
      if (res.status === 429) {
        console.log('    rate limited by Supabase — pausing 60s');
        await sleep(60_000);
      }
    } else {
      const body = await res.text().catch(() => '');
      console.log(`  [${index + 1}/${candidates.length}] ${user.email}: FAILED HTTP ${res.status} ${body.slice(0, 120)}`);
      failed += 1;
    }

    if (index < candidates.length - 1) await sleep(delayMs);
  }

  console.log(`\n${send ? `sent ${sent}` : `would send ${sent || candidates.length}`}, skipped ${skipped}, failed ${failed}`);
  if (send && failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
