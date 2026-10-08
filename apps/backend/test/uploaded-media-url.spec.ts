import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isUploadedMediaRef } from '../src/common/validators/uploaded-media-url';

/**
 * Reproduces "thumbnailUrl must match /^(?:tenants\/|uploads\/|\/uploads\/|\/images\/)…$/".
 *
 * The rule only matched app-relative paths. Once the uploader moved to S3 it returns an
 * absolute `https://<project>.supabase.co/storage/v1/object/public/uploads/…` URL, so a
 * course save carrying a thumbnail that had uploaded perfectly was rejected by the API —
 * the file existed in storage and the request still failed.
 *
 * Widening this must not become "any https URL is fine": `stripExternalMedia` exists so
 * lesson content cannot reference third-party or hostile origins.
 */
const PUBLIC_URL = 'https://abcdefgh.supabase.co/storage/v1/object/public/uploads';

const envKeys = ['S3_PUBLIC_URL', 'S3_ENDPOINT', 'S3_BUCKET', 'S3_MEDIA_BUCKET'] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of envKeys) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  process.env.S3_PUBLIC_URL = PUBLIC_URL;
});

afterEach(() => {
  for (const key of envKeys) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key] as string;
  }
});

describe('isUploadedMediaRef', () => {
  it('accepts the absolute S3 URLs the presigned uploader now returns', () => {
    expect(isUploadedMediaRef(`${PUBLIC_URL}/uploads/covers/thumb-1717171717-ab12.jpg`)).toBe(true);
    expect(isUploadedMediaRef(`${PUBLIC_URL}/uploads/bd53f3ad-9c11-4a6f-8b21-0f0f2c9d7e10.png`)).toBe(true);
  });

  it('still accepts the original app-relative forms', () => {
    for (const ref of ['uploads/a.jpg', 'tenants/t1/x.png', '/uploads/x.webp', '/images/y.gif', '']) {
      expect(isUploadedMediaRef(ref)).toBe(true);
    }
  });

  it('rejects third-party and hostile origins, which is the point of the guard', () => {
    for (const hostile of [
      'https://evil.example/uploads/a.jpg',
      'https://abcdefgh.supabase.co.evil.example/storage/v1/object/public/uploads/a.jpg',
      'http://169.254.169.254/latest/meta-data',
      'javascript:alert(1)',
      'data:image/png;base64,iVBORw0KGgo=',
      '//evil.example/uploads/a.jpg',
      'file:///etc/passwd',
    ]) {
      expect(isUploadedMediaRef(hostile)).toBe(false);
    }
  });

  it('rejects a bare path when it has no upload prefix', () => {
    expect(isUploadedMediaRef('etc/passwd')).toBe(false);
    expect(isUploadedMediaRef('../../secret')).toBe(false);
    expect(isUploadedMediaRef('some/random/file.txt')).toBe(false);
  });

  it('requires the storage path prefix, not just the host', () => {
    // Same host and project, but not this application's public bucket path.
    expect(isUploadedMediaRef('https://abcdefgh.supabase.co/')).toBe(false);
    expect(isUploadedMediaRef('https://abcdefgh.supabase.co/private/a.jpg')).toBe(false);
  });

  it('does not accept credentials embedded in the URL', () => {
    expect(isUploadedMediaRef(`https://user:pass@abcdefgh.supabase.co/storage/v1/object/public/uploads/a.jpg`)).toBe(false);
  });

  it('falls back to local paths when S3 is not configured at all', () => {
    delete process.env.S3_PUBLIC_URL;
    expect(isUploadedMediaRef('uploads/a.jpg')).toBe(true);
    expect(isUploadedMediaRef(`${PUBLIC_URL}/uploads/a.jpg`)).toBe(false);
  });

  it('accepts endpoint-style public URLs when only S3_ENDPOINT is set', () => {
    delete process.env.S3_PUBLIC_URL;
    process.env.S3_ENDPOINT = 'https://s3.eu-west-1.amazonaws.com';
    process.env.S3_BUCKET = 'cnc-media';
    expect(isUploadedMediaRef('https://s3.eu-west-1.amazonaws.com/cnc-media/covers/a.jpg')).toBe(true);
    expect(isUploadedMediaRef('https://s3.eu-west-1.amazonaws.com/other-bucket/covers/a.jpg')).toBe(false);
  });

  it('rejects non-strings', () => {
    for (const bad of [null, undefined, 42, {}, [], true]) {
      expect(isUploadedMediaRef(bad)).toBe(false);
    }
  });
});