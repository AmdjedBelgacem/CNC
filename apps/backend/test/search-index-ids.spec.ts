import { describe, expect, it } from 'vitest';
import { SearchService } from '../src/modules/search/search.service';

/**
 * Regression cover for three bugs that made Meilisearch indexing fail *silently*.
 *
 * `reindexTenant` reported `indexed: 150` and returned `engine: 'meilisearch'` while the
 * index held **zero** documents, because Meili failed the batch asynchronously:
 *
 *   1. the index did not exist and was never created with a primary key
 *   2. the composite id used `:`, which Meili forbids
 *   3. some entity ids contain `:` themselves (`static:about`)
 *
 * `searchMeili` then fell back to Postgres, so the app looked healthy.
 */
describe('SearchService.documentId', () => {
  // The method is pure, so a prototype instance is enough — no Nest wiring needed.
  const svc = Object.create(SearchService.prototype) as SearchService;
  const docId = (tenantId: string, type: never, id: string) =>
    (svc as unknown as { documentId: (t: string, ty: never, i: string) => string }).documentId(tenantId, type, id);

  const TENANT = '3f8844e2-2b15-405d-b801-f9f668931b59';
  const MEILI_ID = /^[A-Za-z0-9_-]+$/;

  it('produces only characters Meilisearch accepts', () => {
    expect(docId(TENANT, 'course' as never, 'c3251b53-352a-45b5-a778-d323410d308a')).toMatch(MEILI_ID);
  });

  it('strips the colon separator (bug 2)', () => {
    expect(docId(TENANT, 'academy' as never, 'abc')).toBe(`${TENANT}-academy-abc`);
    expect(docId(TENANT, 'academy' as never, 'abc')).not.toContain(':');
  });

  it('sanitises entity ids that contain a colon (bug 3)', () => {
    const id = docId(TENANT, 'page-static' as never, 'static:about');
    expect(id).toMatch(MEILI_ID);
    expect(id).toBe(`${TENANT}-page-static-static_about`);
  });

  it('stays under the 511-byte Meilisearch limit', () => {
    const id = docId(TENANT, 'course' as never, 'x'.repeat(600));
    expect(Buffer.byteLength(id)).toBeLessThanOrEqual(511);
  });

  it('keeps truncated ids distinct', () => {
    const a = docId(TENANT, 'course' as never, `a${'x'.repeat(600)}`);
    const b = docId(TENANT, 'course' as never, `b${'x'.repeat(600)}`);
    expect(a).not.toBe(b);
  });

  it('is deterministic, so a delete can target the same document', () => {
    expect(docId(TENANT, 'user' as never, 'static:about')).toBe(docId(TENANT, 'user' as never, 'static:about'));
  });
});

describe('SearchService index preparation', () => {
  const src = (() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readFileSync } = require('node:fs') as typeof import('node:fs');
    return readFileSync('src/modules/search/search.service.ts', 'utf8');
  })();

  it('declares the primary key when creating the index (bug 1)', () => {
    expect(src).toMatch(/createIndex\('titan_search',\s*\{\s*primaryKey:\s*'id'\s*\}\)/);
  });

  it('ensures the index exists before writing documents', () => {
    expect(src).toMatch(/private async ensureMeiliIndex/);
    expect(src).toMatch(/await this\.ensureMeiliIndex\(index\)/);
  });
});