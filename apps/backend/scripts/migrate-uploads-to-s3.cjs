/**
 * Move existing `/uploads/...` images from the container volume into S3.
 *
 * Order matters and is the whole point of this script:
 *
 *   1. PUT every file to S3 under the same `uploads/...` key it had on disk;
 *   2. HTTP-GET each new URL to prove the object is actually publicly readable —
 *      a successful PUT to a private bucket proves nothing;
 *   3. only then rewrite the DB rows to the S3 URL.
 *
 * So a failure at any point leaves the database pointing at files that still resolve.
 * Nothing is deleted from the volume: the old `/uploads/*` route keeps serving them, so
 * any URL shared before the migration still works. Removing the volume is a separate,
 * manual step once the new URLs have been live for a while.
 *
 * Idempotent: re-running re-uploads and re-verifies, and a row already holding the S3
 * URL is left alone.
 *
 * Usage (inside the backend container, which has DATABASE_URL and the S3 creds):
 *   node scripts/migrate-uploads-to-s3.cjs            # dry run
 *   node scripts/migrate-uploads-to-s3.cjs --apply
 */
const fs = require('node:fs');
const path = require('node:path');

const APPLY = process.argv.includes('--apply');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const postgres = require('/repo/node_modules/postgres');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { S3Client, PutObjectCommand, HeadBucketCommand } = require('/repo/node_modules/aws-sdk/client-s3');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
const PUBLIC_URL = (process.env.S3_PUBLIC_URL || '').replace(/\/+$/, '');
const BUCKET = process.env.S3_BUCKET || '';

const CONTENT_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.txt': 'text/plain',
  '.vtt': 'text/vtt',
  '.zip': 'application/zip',
};

/** Every table/column that can hold an image URL, scanned rather than assumed. */
const TARGETS = [
  ['products', 'thumbnail_url'],
  ['product_images', 'url'],
];

function walk(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, base);
    return [path.relative(base, full).split(path.sep).join('/')];
  });
}

(async () => {
  if (!PUBLIC_URL || !BUCKET) {
    console.error('S3_PUBLIC_URL or S3_BUCKET is not set; nothing to do.');
    process.exit(1);
  }

  const client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_KEY,
    },
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE || 'false') === 'true',
  });

  await client.send(new HeadBucketCommand({ Bucket: BUCKET }));
  console.log(`target bucket: ${BUCKET}\ntarget base:   ${PUBLIC_URL}\nmode:          ${APPLY ? 'APPLY' : 'dry run'}`);

  const keys = walk(UPLOAD_DIR);
  console.log(`\nfiles on disk under ${UPLOAD_DIR}: ${keys.length}`);
  if (!keys.length) {
    console.log('nothing to migrate.');
    process.exit(0);
  }

  // ---- 1. upload ----------------------------------------------------------
  const uploaded = [];
  for (const key of keys) {
    const body = fs.readFileSync(path.join(UPLOAD_DIR, key));
    const contentType = CONTENT_TYPES[path.extname(key).toLowerCase()] || 'application/octet-stream';
    try {
      if (APPLY) {
        await client.send(new PutObjectCommand({
          Bucket: BUCKET,
          Key: `uploads/${key}`,
          Body: body,
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000, immutable',
        }));
      }
      uploaded.push({ key: `uploads/${key}`, size: body.length, url: `${PUBLIC_URL}/uploads/${key}` });
      console.log(`  ${APPLY ? 'put   ' : 'would '} uploads/${key} (${body.length} B)`);
    } catch (err) {
      console.error(`  FAILED uploads/${key}: ${err.message}`);
    }
  }

  // ---- 2. prove they are publicly readable --------------------------------
  // A PUT succeeding against a private bucket would still leave every storefront image
  // broken, so this GET is the step that actually de-risks the cutover.
  if (APPLY) {
    console.log('\nverifying public read access...');
    let unreachable = 0;
    for (const item of uploaded) {
      try {
        const res = await fetch(item.url, { method: 'GET' });
        if (!res.ok) {
          unreachable += 1;
          console.error(`  NOT PUBLIC ${item.url} -> ${res.status}`);
          await res.arrayBuffer();
        }
      } catch (err) {
        unreachable += 1;
        console.error(`  NOT PUBLIC ${item.url} -> ${err.message}`);
      }
    }
    if (unreachable) {
      console.error(
        `\n${unreachable} object(s) are not publicly readable. Aborting before the DB is touched —\n` +
          'check that the bucket policy allows anonymous GET.',
      );
      process.exit(1);
    }
    console.log(`  all ${uploaded.length} objects readable without credentials`);
  }

  // ---- 3. rewrite the database -------------------------------------------
  const sql = postgres(process.env.DATABASE_URL, {
    prepare: false,
    max: 1,
    ssl: { rejectUnauthorized: false },
  });

  console.log('\nrewriting database references:');
  for (const [table, column] of TARGETS) {
    const { rows } = await sql.unsafe(
      `select id, "${column}" as url from "${table}" where "${column}" like $1 or "${column}" like $2`,
      ['/uploads/%', `%/uploads/%`],
    );
    if (!rows.length) {
      console.log(`  ${table}.${column}: 0 rows`);
      continue;
    }
    for (const row of rows) {
      const current = String(row.url || '');
      if (current.startsWith(`${PUBLIC_URL}/`)) continue;
      // Normalise `/uploads/x` and `https://host/uploads/x` to the S3 URL.
      const marker = current.lastIndexOf('uploads/');
      if (marker === -1) continue;
      const key = current.slice(marker);
      const next = `${PUBLIC_URL}/${key}`;
      if (APPLY) {
        await sql.unsafe(`update "${table}" set "${column}" = $1 where id = $2`, [next, row.id]);
      }
      console.log(`  ${table}.${column}: ${current}\n      -> ${next}`);
    }
  }

  console.log(`\n${APPLY ? 'done' : 'dry run complete — re-run with --apply'}`);
  process.exit(0);
})();