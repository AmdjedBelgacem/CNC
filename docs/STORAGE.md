# Storage (local dev)

## Topology

- Videos (private): MinIO bucket `titans-local`, keys
  `tenants/<tenantId>/...`. Playback is via time-limited signed GET URLs
  from `GET /courses/:course/lessons/:lesson/playback`. **Never make video
  objects public** — the paywall depends on signed URLs.
- Thumbnails/covers (durable): local disk `apps/backend/uploads/` served by
  Fastify static at `/uploads/*` (e.g. `/uploads/covers/*.png`). Lesson
  thumbnails are backfilled from the parent course cover, so they survive a
  MinIO wipe.

## Env

- `S3_ENDPOINT=http://localhost:9002`, `S3_BUCKET=titans-local`,
  `S3_ACCESS_KEY`/`S3_SECRET_KEY=minioadmin` (local only).
- `S3_PUBLIC_URL` empty locally → playback returns signed MinIO URLs.
  Thumbnails use absolute `/uploads` or MinIO URLs stored in the DB.

## Bucket bootstrap (reliable)

MinIO starts empty on a fresh volume. Recreate anytime (idempotent):

```bash
docker run --rm --network cnc_default --entrypoint sh minio/mc -c \
"mc alias set local http://minio:9000 minioadmin minioadmin && \
 mc mb local/titans-local --ignore-existing && \
 mc anonymous set public local/titans-local && mc ls local"
```

Verify: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:9002/titans-local/`
must print `200`. `scripts/doctor.sh` checks this and prints the same command
on failure.

## If videos 404 but thumbs render

1. `scripts/doctor.sh` — minio live? bucket 200?
2. `GET /courses/:course/lessons/:lesson/playback` with admin JWT:
   - `404 Video not available` → no `videoUrl` key in DB (re-upload in Studio).
   - `200 {url}` but `<video>` errors → fetch the signed `url` with
     `curl -r 0-1023` (expect `206 video/mp4`); if `NoSuchKey`, the object was
     deleted — re-upload the lesson video.
3. Thumbs are independent of MinIO video objects; a video re-upload never
   clears `thumbnailUrl`.

## Backup (local)

```bash
docker run --rm --network cnc_default --entrypoint sh \
  -v "$PWD/backups/minio:/out" minio/mc -c \
  "mc alias set local http://minio:9000 minioadmin minioadmin && \
   mc mirror local/titans-local /out/titans-local-$(date +%F)"
```

Production needs versioned buckets + cross-region replication before launch
(see `docs/LAUNCH_GATES.md`).
