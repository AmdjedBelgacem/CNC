import { describe, expect, it } from 'vitest';

/**
 * Storage invariants for the Supabase split.
 *
 *   uploads  public  -> avatars, covers, portfolio images, course images
 *   media    private -> paid lesson video, served only via short-lived signed URLs
 *
 * The failure this guards against is real and was introduced once already: sharing one
 * bucket, or letting `resolvePlaybackUrl` hand back the public base URL, makes paid
 * course video anonymously fetchable by a raw path.
 *
 * These assertions are about *configuration and code shape*, so they run without
 * network access. `smoke-matrix.mjs` proves the same invariants against the live
 * project.
 */
const read = (rel: string) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readFileSync } = require('node:fs') as typeof import('node:fs');
  const { join } = require('node:path') as typeof import('node:path');
  return readFileSync(join(process.cwd(), rel), 'utf8');
};

const storage = () => read('src/modules/storage/storage.service.ts');
const upload = () => read('src/modules/auth/services/upload.service.ts');

describe('storage bucket separation', () => {
  it('video uses S3_MEDIA_BUCKET, not the public S3_BUCKET', () => {
    const src = storage();
    expect(src).toContain('S3_MEDIA_BUCKET');
    expect(src).toMatch(/this\.bucket\s*=\s*process\.env\.S3_MEDIA_BUCKET/);
  });

  it('uploads (avatars/covers) use the public bucket', () => {
    const src = upload();
    expect(src).toMatch(/this\.bucket\s*=\s*process\.env\.S3_BUCKET/);
  });

  it('production refuses to boot when the two buckets are the same', () => {
    const config = read('src/config/config.service.ts');
    expect(config).toContain('PROD_REQUIRED_STORAGE');
    expect(config).toMatch(/S3_MEDIA_BUCKET must not equal S3_BUCKET/);
  });

  it('production requires S3_PUBLIC_URL', () => {
    const config = read('src/config/config.service.ts');
    expect(config).toMatch(/PROD_REQUIRED_STORAGE\s*=\s*\['S3_BUCKET',\s*'S3_MEDIA_BUCKET',\s*'S3_PUBLIC_URL'\]/);
  });

  it('production requires S3_PUBLIC_URL to actually address the public bucket', () => {
    const config = read('src/config/config.service.ts');
    expect(config).toMatch(/S3_PUBLIC_URL must address S3_BUCKET/);
  });
});

describe('paid video is never served from the public base URL', () => {
  it('resolvePlaybackUrl only uses the public base when the bucket IS the public bucket', () => {
    const src = storage();
    // The guard must compare buckets, not merely check that a public URL exists.
    expect(src).toMatch(/this\.publicUrl\s*&&\s*this\.bucket\s*===\s*this\.publicBucket/);
  });

  it('tracks which bucket the public URL serves', () => {
    expect(storage()).toMatch(/this\.publicBucket\s*=\s*process\.env\.S3_BUCKET/);
  });

  it('falls back to a signed GET URL for the media bucket', () => {
    const src = storage();
    expect(src).toContain('getSignedUrl');
    // Signed with a bounded expiry, never a permanent link.
    expect(src).toMatch(/getSignedUrl\(client,\s*cmd,\s*\{\s*expiresIn\s*\}\)/);
  });

  it('never builds a permanent URL for media objects', () => {
    const src = storage();
    const mediaUrl = /publicUrl[\s\S]{0,200}?\$\{key\}/.exec(src);
    if (mediaUrl) {
      expect(mediaUrl[0]).toContain('this.bucket === this.publicBucket');
    }
    expect(src).not.toMatch(/publicUrl[^;]*\?[^;]*X-Amz-Signature=\$\{/);
  });

  it('avatar uploads return the public base URL (public assets)', () => {
    const src = upload();
    expect(src).toContain('this.publicUrl');
    expect(src).toMatch(/return `\$\{this\.publicUrl\}\/\$\{objectKey\}`/);
  });
});
