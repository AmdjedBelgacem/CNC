# Images now live in S3

Every image is written to the Supabase Storage `uploads` bucket. Nothing new lands in the
container's Docker volume.

## What changed

`UploadService.uploadGeneric` backs product covers, course images and lesson files. It
decoded the base64 body to a `Buffer` and called `writeFile(UPLOAD_DIR/...)`, ignoring S3
entirely — even though the same class already stored avatars there. Images therefore lived
in the `titan_uploads` **named volume**, which is not a backup: `docker compose down -v` or
a volume prune destroys every one.

It now writes to the public bucket and returns the URL on the public S3 host. Disk remains
the fallback when S3 is unconfigured, so a developer machine with no credentials still
accepts uploads.

Base64 was never storage — it is the transport format from `FileReader` into the JSON body,
decoded to binary before anything is written. The database has only ever held URL strings.

`deleteFile` unlinked from `UPLOAD_DIR` only, so images already in S3 were unremovable: the
row went away and the object stayed publicly readable by URL. It now issues a
`DeleteObject` for URLs on the public host, and refuses any key outside `uploads/` so a
caller cannot delete something else on the bucket.

## Why the `uploads/` prefix in the object key

`ProductsService` refuses to delete any key outside `uploads/` or `tenants/`. A bare
`covers/<file>.png` key would make every gallery image undeletable and silently orphan the
object. So keys mirror the old on-disk layout and only the host changes:

```
before  /uploads/covers/00861648-….png                              (container volume)
after   https://<project>.supabase.co/storage/v1/object/public/uploads/uploads/covers/00861648-….png
```

The doubled `uploads/uploads` in that URL is the bucket name *and* the key prefix. It reads
oddly, but it is what keeps the delete guard working; shortening it means widening a
security-sensitive guard, which is a worse trade than a verbose URL.

## Migration

`apps/backend/scripts/migrate-uploads-to-s3.cjs`, run inside the backend container.
Idempotent; takes `--apply` (otherwise dry run).

The ordering is the point: PUT every file, then **HTTP-GET every new URL** to prove the
bucket is genuinely public-read, and only then rewrite the database. A successful PUT
against a private bucket proves nothing and would leave every storefront image broken, so
the GET is what actually de-risks the cutover. A failure at any stage leaves rows pointing
at files that still resolve.

It deletes nothing from the volume. The old `/uploads/*` route keeps serving it, so any URL
shared before the migration still resolves. Removing the volume is a separate manual step
once the new URLs have been live for a while.

## Verified on production

| Check | Result |
|---|---|
| Files on disk migrated | 22 (incl. 1 unreferenced 1×1 placeholder PNG) |
| Objects publicly readable after upload | 22/22, confirmed by anonymous HTTP GET |
| DB rows rewritten | `products.thumbnail_url` 3, `product_images.url` 4 |
| References still on the old `/uploads/...` path | **0** |
| Every referenced image fetches | 200, correct `Content-Type`, full byte length |
| New upload writes to S3 | returns an S3 URL; nothing appears on local disk |
| `deleteFile` on an S3 URL | object returns `NoSuchKey` afterwards |
| `deleteFile` guard | refuses keys outside `uploads/`, does not throw |
| Tests | backend 827 passed / 5 skipped |

## Known behaviour, not a bug

A deleted image can still be served from CDN cache. Uploads are written with
`Cache-Control: public, max-age=31536000, immutable`, so a public URL stays in browsers and
Supabase's edge for up to a year after deletion. That is the deliberate trade for immutable
asset hosting — filenames carry a UUID, so replacing an image produces a new URL rather
than mutating bytes behind a cached one. To confirm a delete took effect, request the URL
with a cache-busting query parameter.

## Follow-ups not done

* The `titan_uploads` volume still holds the 22 original files. Remove it once the S3 URLs
  have been live long enough that nobody holds an old link.
* `products.islands.tsx` still passes a literal `'en-US'` to `formatMinorUnits` for
  server-rendered islands (unrelated, still open from the i18n pass).
* `saveImage` (avatars/covers/portfolio) writes without the `uploads/` key prefix, so those
  URLs read `…/public/uploads/avatars/<uuid>.jpg`. Left as-is: it predates this change,
  works correctly, and re-keying it would churn live avatar URLs for cosmetics.

## Incident: one object readable via S3 but not publicly

`uploads/covers/00861648-….png` returned 1472315 bytes from `HeadObject` and
`NoSuchKey` from the public route, so the 3-Axis product's thumbnail and its
single gallery image failed for shoppers while the object plainly existed.

Supabase's S3 gateway and its REST public route disagreed about an object. The
migration's own verification had passed, so this appeared afterwards rather than
during the cutover. Nothing in this code causes or prevents it.

Worked around by writing the object under a fresh key and repointing both
`products.thumbnail_url` and `product_images.url` at it, then re-verifying
through the public URL. The stale object was left in place rather than deleted:
if the same URL is referenced by something not in these two tables, deleting it
would turn a recoverable 404 into permanent breakage.

When an image 404s publicly but lists fine in the bucket, re-upload under a new
key and repoint. Do not assume the object is gone.
