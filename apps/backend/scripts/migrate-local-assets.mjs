#!/usr/bin/env node
/**
 * Migrate locally-served `/uploads/...` assets into Supabase Storage.
 *
 * Why this exists: the backend serves `UPLOAD_DIR` over `/uploads/` from the local
 * filesystem, so lesson videos and images appeared to work in development while
 * **both Supabase buckets were empty**. On any real deployment the container filesystem
 * is ephemeral, so every one of those URLs 404s. This moves the bytes and rewrites the
 * database references.
 *
 * Routing rule (matches the bucket split):
 *   lesson videos / lesson thumbnails -> private `media` bucket  (paid content)
 *   everything else                     -> public `uploads` bucket (avatars, covers)
 *
 * Dry-run by default. Requires SUPABASE_URL + SUPABASE_SECRET_KEY and a --database DSN.
 *
 * Usage:
 *   node scripts/migrate-local-assets.mjs --database <dsn> [--dir uploads] [--send] [--skip-smaller-than N]
 */
import { createHash } from 'node:crypto';
import { readFileSync, statSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, join } from 'node:path';

const args = process.argv.slice(2);
const flag = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i === -1 ? d : args[i + 1];
};
const has = (n) => args.includes(`--${n}`);

const database = flag('database');
// `has` already prepends the dashes; passing '--send' here tested for '----send'.
const send = has('send');
const dir = flag('dir', join(process.cwd(), 'uploads'));
const skipSmallerThan = Number(flag('skip-smaller-than', '1024'));

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const mediaBucket = process.env.S3_MEDIA_BUCKET ?? 'media';
const publicBucket = process.env.S3_BUCKET ?? 'uploads';

if (!database) {
  console.error('usage: node scripts/migrate-local-assets.mjs --database <dsn> [--send] [--dir uploads]');
  process.exit(1);
}
if (send && (!url || !key)) {
  console.error('--send requires SUPABASE_URL and SUPABASE_SECRET_KEY.');
  process.exit(1);
}

const run = (q) =>
  spawnSync('psql', ['-X', '-q', '-t', '-A', '-F', '\t', '-v', 'ON_ERROR_STOP=1', '-d', database, '-c', q], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 64,
  });

/** Fails loudly. A swallowed psql error previously made this script report "0 objects". */
const sql = (q) => {
  const r = run(q);
  if (r.status !== 0) {
    console.error(`psql failed: ${String(r.stderr).trim()}`);
    process.exit(1);
  }
  return r.stdout;
};

const esc = (v) => String(v).replace(/'/g, "''");

/** Depth-first search for a file by basename, used to repair path-drift references. */
function findByBasename(root, name, depth = 0) {
  if (depth > 4) return null;
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      const hit = findByBasename(full, name, depth + 1);
      if (hit) return hit;
    } else if (entry.name === name) {
      return full;
    }
  }
  return null;
}

// Every column that can hold a `/uploads/...` path. `media: true` routes to the private
// bucket because it is paid lesson content.
const REFERENCES = [
  { table: 'lessons', column: 'video_url', media: true },
  { table: 'lessons', column: 'thumbnail_url', media: true },
  { table: 'users', column: 'avatar_url', media: false },
  { table: 'users', column: 'cover_image_url', media: false },
  { table: 'courses', column: 'thumbnail_url', media: false },
  { table: 'courses', column: 'cover_image_url', media: false },
];

console.log(`mode     : ${send ? 'SEND' : 'DRY RUN (pass --send to upload and rewrite)'}`);
console.log(`database : ${database.replace(/:[^:@/]*@/, ':***@')}`);
console.log(`source   : ${dir}`);
console.log(`buckets  : media(media=${mediaBucket}, private) / public(${publicBucket})\n`);

const plan = [];
const skipped = [];

for (const ref of REFERENCES) {
  // Does the table/column exist? Not every deployment has every optional table.
  const exists = spawnSync(
    'psql',
    ['-X', '-q', '-t', '-A', '-d', database, '-c', `SELECT 1 FROM information_schema.columns WHERE table_name='${ref.table}' AND column_name='${ref.column}'`],
    { encoding: 'utf8' },
  ).stdout.trim();
  if (!exists) continue;

  // `deleted_at` is not present on every table; adding it unconditionally made the whole
  // query error out and silently skip real work.
  const hasDeletedAt = run(
    `SELECT 1 FROM information_schema.columns WHERE table_name='${ref.table}' AND column_name='deleted_at'`,
  ).stdout.trim();
  const live = hasDeletedAt ? ' AND deleted_at IS NULL' : '';
  const rows = sql(
    `SELECT id, ${ref.column}, tenant_id FROM public.${ref.table} WHERE ${ref.column} LIKE '/uploads/%'${live}`,
  )
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [id, value, tenantId] = l.split('\t');
      // `media` MUST be carried through: dropping it sent paid lesson video to the
      // public bucket, which is precisely the leak this migration exists to prevent.
      return { table: ref.table, column: ref.column, id, value, tenantId, media: ref.media };
    });

  for (const row of rows) {
    const relative = row.value.replace(/^\/uploads\//, '');
    let file = join(dir, relative);
    // Some rows point at a folder the file never lived in (a lesson thumbnail recorded
    // under /uploads/lessons/ while the asset is in /uploads/covers/). Fall back to a
    // basename search so a path-drift reference is repaired instead of skipped.
    let drifted = false;
    if (!existsSync(file)) {
      const found = findByBasename(dir, basename(relative));
      if (found) {
        file = found;
        drifted = true;
      }
    }
    if (!existsSync(file)) {
      skipped.push({ ...row, reason: 'file missing on disk' });
      continue;
    }
    const size = statSync(file).size;
    if (size < skipSmallerThan) {
      skipped.push({ ...row, reason: `only ${size} bytes (placeholder)` });
      continue;
    }
    const bucket = row.media ? mediaBucket : publicBucket;
    // `tenants/<id>/...` is the app's internal storage-key convention. Anything else is
    // treated as a literal URL by StorageService.isKey() and never gets signed, so paid
    // video must be stored under this prefix or it is served unauthenticated.
    const folder = row.media ? 'media/lessons' : 'assets';
    const objectKey = `tenants/${row.tenantId}/${folder}/${basename(row.value)}`;
    plan.push({ ...row, file, bucket, objectKey, size, drifted });
  }
}

for (const item of plan) {
  console.log(
    `  ${send ? 'would upload' : 'plan'}  ${item.bucket}/${item.objectKey}  ${(item.size / 1024 / 1024).toFixed(1)}MB  <- ${item.table}.${item.column} ${item.id}`,
  );
  if (item.drifted) console.log(`      note: DB path was wrong; found the asset at ${item.file.replace(`${dir}/`, '')}`);
}
for (const item of skipped) {
  console.log(`  SKIP ${item.table}.${item.column} ${item.id}: ${item.reason} (${item.value})`);
}
console.log(`\n${plan.length} object(s) to migrate, ${skipped.length} skipped`);

if (!send || plan.length === 0) {
  if (plan.length === 0) process.exit(0);
  process.exit(0);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let uploaded = 0;
let rewritten = 0;

for (const [i, item] of plan.entries()) {
  const body = readFileSync(item.file);
  const sha = createHash('sha256').update(body).digest('base64');
  const res = await fetch(`${url}/storage/v1/object/${item.bucket}/${item.objectKey}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/octet-stream', 'x-upsert': 'true' },
    body,
  });
  const ok = res.ok;
  console.log(`  [${i + 1}/${plan.length}] ${ok ? 'uploaded' : `FAILED HTTP ${res.status}`} ${item.bucket}/${item.objectKey}`);
  if (!ok) {
    console.log(`      ${(await res.text().catch(() => '')).slice(0, 200)}`);
    continue;
  }
  uploaded += 1;

  // Only rewrite once the bytes are confirmed present, so a failure can never leave a
  // database row pointing at an object that does not exist.
  const check = await fetch(`${url}/storage/v1/object/${item.bucket}/${item.objectKey}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!check.ok) {
    console.log(`      verify failed HTTP ${check.status}; leaving ${item.column} unchanged`);
    continue;
  }

  const stored = Buffer.from(await check.arrayBuffer());
  if (createHash('sha256').update(stored).digest('hex') !== createHash('sha256').update(body).digest('hex')) {
    console.log('      checksum mismatch after upload; leaving column unchanged');
    continue;
  }
  void sha;

  // Store the internal key itself. The app resolves it to a signed (media) or public
  // (uploads) URL at read time via StorageService.resolvePlaybackUrl.
  const newPath = item.objectKey;
  // RETURNING is required: a bare UPDATE prints nothing under -t -A, so counting rows
  // from stdout silently reported 0 and left the column pointing at the local file.
  const upd = sql(
    `UPDATE public.${item.table} SET ${item.column} = '${esc(newPath)}'
     WHERE id = '${esc(item.id)}' AND ${item.column} = '${esc(item.value)}'
     RETURNING id`,
  );
  const affected = upd.split('\n').map((l) => l.trim()).filter(Boolean).length;
  if (affected === 1) {
    rewritten += 1;
    console.log(`      rewrote ${item.table}.${item.column} -> ${newPath}`);
  } else {
    console.log(`      WARNING: ${item.table}.${item.column} update matched ${affected} rows; left as-is`);
  }
  await sleep(150);
}

console.log(`\nuploaded ${uploaded}, rewrote ${rewritten}, skipped ${skipped.length}`);
if (uploaded !== plan.length) process.exit(1);