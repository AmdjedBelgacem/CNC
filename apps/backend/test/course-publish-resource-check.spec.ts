import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isUploadedMediaRef } from '@titan/shared';

/**
 * Reproduces "cannot publish a course despite uploading resources".
 *
 * `validateForPublish` inlined a second copy of the old media regex, which only matched
 * app-relative paths. Since uploads moved to S3 the uploader returns an absolute
 * `https://<project>.supabase.co/storage/v1/object/public/uploads/…` URL, so every genuinely
 * uploaded resource failed and the course could never be published.
 *
 * Confirmed live: with a thumbnail, SEO, and one real S3 resource attached, the only remaining
 * reason was "Upload every course resource before publishing".
 *
 * This asserts the behaviour directly (the shared validator) and that the preflight stops
 * carrying its own private copy of the pattern.
 */
describe('course publish resource check', () => {
  const S3 = 'https://ccnbudciixhwjogtnklk.supabase.co/storage/v1/object/public/uploads';
  const realResource = `${S3}/tenants/f2eaeb7d/covers/qa-res.png`;

  it('accepts a resource uploaded through the current uploader', () => {
    process.env.S3_PUBLIC_URL = S3;
    expect(isUploadedMediaRef(realResource)).toBe(true);
  });

  it('still accepts the app-relative forms legacy records use', () => {
    for (const ref of ['uploads/a.pdf', 'tenants/t/a.pdf', '/uploads/a.pdf', '/images/a.png']) {
      expect(isUploadedMediaRef(ref)).toBe(true);
    }
  });

  it('rejects a resource that is not an uploaded file', () => {
    for (const bad of ['https://evil.example/a.pdf', 'javascript:alert(1)', 'not a url']) {
      expect(isUploadedMediaRef(bad)).toBe(false);
    }
  });

  /**
   * Empty is accepted by the shared validator so an optional media field can be cleared.
   * A course resource with no URL is not an uploaded file, so the preflight checks emptiness
   * itself rather than weakening the rule for every caller.
   */
  it('treats an empty resource URL as not uploaded, at the preflight', () => {
    expect(isUploadedMediaRef('')).toBe(true); // shared rule: clearing is allowed
    const src = readFileSync(
      resolve(__dirname, '../src/modules/courses/courses.service.ts'),
      'utf8',
    );
    expect(src).toContain("url.trim() === ''");
  });

  it('no longer inlines a private copy of the old media pattern', () => {
    const src = readFileSync(
      resolve(__dirname, '../src/modules/courses/courses.service.ts'),
      'utf8',
    );
    // The DTO and the preflight must agree, or one accepts a save the other refuses.
    expect(src).not.toMatch(/tenants\\\\\/\|uploads\\\\\/\|\\\\\/uploads\\\\\/\|\\\\\/images\\\\\//);
    expect(src).toContain('isUploadedMediaRef');
  });
});
