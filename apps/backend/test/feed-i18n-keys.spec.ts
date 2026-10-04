import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Translation-key coverage for the feed surface.
 *
 * This exists because the same class of bug shipped three times:
 *
 *  1. `comment-thread.tsx` asked for `feed.sort.best` / `feed.sort.old` while the
 *     catalogue kept comment sorts under `feed.commentSort`. Post sorting and
 *     comment sorting are different axes and must not share a key.
 *  2. `commentRemoved` / `deleteComment` were used in code but filed as
 *     `deletedComment`.
 *  3. The keys were built with a template (`t(\`commentSort.${option}\`)`), so the
 *     requested path existed only at runtime: nothing in the source declared it,
 *     and a stale chunk could ask for a path no catalogue entry matched.
 *
 * A missing key is a console warning, not a build failure, so nothing caught it
 * until someone opened the page. These tests resolve every key the surface
 * declares against both catalogues, and fail if a key is missing, resolves to an
 * object (which renders as the literal "[object Object]" — how the tag index
 * broke), is paired with the wrong tab, or is assembled from a variable.
 *
 * The frontend has no test runner, so this lives beside the other source
 * assertions in the backend suite (same approach as feed-invariants.spec.ts).
 */
const FRONTEND = resolve(__dirname, '../../frontend');

const SURFACE = [
  'src/components/feed/comment-thread.tsx',
  'src/components/feed/post-card.tsx',
  'src/components/feed/feed-stream.tsx',
  'src/components/feed/tag-views.tsx',
  'src/components/feed/feed-islands.tsx',
] as const;

type Catalogue = Record<string, Record<string, unknown>>;

function readCatalogue(locale: 'en' | 'ar'): Catalogue {
  return JSON.parse(readFileSync(resolve(FRONTEND, `messages/${locale}.json`), 'utf8')) as Catalogue;
}

function resolveKey(catalogue: Catalogue, namespace: string, key: string): unknown {
  let node: unknown = catalogue[namespace];
  if (typeof node !== 'object' || node === null) return undefined;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null || !(part in node)) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

function sourceOf(file: string): string {
  return readFileSync(resolve(FRONTEND, file), 'utf8');
}

/** Which namespace each `t` alias is bound to in this file. */
function namespacesIn(source: string): Map<string, string> {
  const bound = new Map<string, string>();
  for (const alias of ['t', 'ta']) {
    const match = new RegExp(`const ${alias} = useTranslations\\('([^']+)'\\)`).exec(source);
    if (match) bound.set(alias, match[1]!);
  }
  return bound;
}

const LOCALES = ['en', 'ar'] as const;

describe('feed translation keys resolve', () => {
  for (const locale of LOCALES) {
    it(`every literal t() key used by the feed surface exists in ${locale}`, () => {
      const catalogue = readCatalogue(locale);
      const problems: string[] = [];

      for (const file of SURFACE) {
        const source = sourceOf(file);
        for (const [alias, namespace] of namespacesIn(source)) {
          for (const match of source.matchAll(new RegExp(`\\b${alias}\\(\\s*'([^']+)'`, 'g'))) {
            const key = match[1]!;
            const value = resolveKey(catalogue, namespace, key);
            const where = `${file.split('/').pop()}: ${namespace}.${key}`;
            if (value === undefined) problems.push(`${where} is missing in ${locale}`);
            else if (typeof value === 'object') problems.push(`${where} is an object in ${locale}`);
          }
        }
      }

      expect(problems).toEqual([]);
    });

    it(`every declared sort label key exists in ${locale}`, () => {
      const catalogue = readCatalogue(locale);
      const problems: string[] = [];

      for (const file of SURFACE) {
        // `labelKey: 'commentSort.best'` — the literal form that replaced the
        // runtime-assembled key, and therefore the thing that must be checked.
        for (const match of sourceOf(file).matchAll(/labelKey:\s*'([^']+)'/g)) {
          const key = match[1]!;
          const namespace = key.startsWith('tags.') ? 'tags' : 'feed';
          const path = namespace === 'tags' ? key.slice('tags.'.length) : key;
          if (resolveKey(catalogue, namespace, path) === undefined) {
            problems.push(`${file.split('/').pop()}: ${namespace}.${path} is missing in ${locale}`);
          }
        }
      }

      expect(problems).toEqual([]);
    });
  }

  it('builds no translation key from a variable', () => {
    // `t(`sort.${option}`)` is how a wrong namespace reached the browser with
    // nothing in the source declaring the path it requested.
    for (const file of SURFACE) {
      const code = sourceOf(file)
        .split('\n')
        .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*') && !line.trim().startsWith('/*'))
        .join('\n');
      expect(`${file}: ${code.match(/\bt\(\s*`[^`]*\$\{/)?.[0] ?? 'none'}`).toBe(`${file}: none`);
    }
  });

  it('pairs every sort value with a matching label key', () => {
    // `{ value: 'old', labelKey: 'commentSort.old' }` — a mismatch renders the
    // right word under the wrong tab, which no key-existence test would catch.
    let pairs = 0;
    for (const file of SURFACE) {
      for (const match of sourceOf(file).matchAll(/value:\s*'([^']+)'[^}]*labelKey:\s*'([^']+)'/g)) {
        pairs += 1;
        const labelKey = match[2]!;
        const leaf = labelKey.split('.').pop();
        expect({
          file: file.split('/').pop(),
          sortValue: match[1],
          labelKey,
          labelLeaf: leaf,
        }).toEqual({
          file: file.split('/').pop(),
          sortValue: leaf,
          labelKey,
          labelLeaf: leaf,
        });
      }
    }
    // Guard against the regex silently matching nothing.
    expect(pairs).toBeGreaterThanOrEqual(6);
  });

  it('keeps post sorts and comment sorts in separate namespaces', () => {
    // The bug this file exists for: one `sort` key serving two different axes.
    for (const locale of LOCALES) {
      const feed = readCatalogue(locale)['feed'] as Record<string, unknown>;
      const commentSorts = feed['commentSort'] as Record<string, string>;

      // The comment axis is exactly best/new/old.
      expect(Object.keys(commentSorts).sort()).toEqual(['best', 'new', 'old']);
      // `new` legitimately exists in both, but under different parents.
      expect(feed['commentSort']).not.toBe(feed['sort']);
    }
  });

  it('never reads the post-sort axis with a comment sort value', () => {
    // `feed.sort` also carries `best`/`old` as a cache-tolerance shim for tabs
    // still running a build from before the rename. If any component ever reads
    // them, the two axes have merged again and the shim is load-bearing rather
    // than inert — which is the failure this test guards.
    const postSortAxes = new Set(['hot', 'new', 'top']);
    for (const file of SURFACE) {
      const source = sourceOf(file);
      for (const match of source.matchAll(/labelKey:\s*'sort\.([^']+)'/g)) {
        expect(`${file.split('/').pop()}: sort.${match[1]}`).toBe(
          `${file.split('/').pop()}: sort.${match[1]}`,
        );
        expect(postSortAxes.has(match[1]!)).toBe(true);
      }
      for (const match of source.matchAll(/value:\s*'(best|old)'[^}]*labelKey:\s*'sort\./g)) {
        throw new Error(
          `${file}: a comment sort (${match[1]}) is labelled from feed.sort instead of feed.commentSort`,
        );
      }
    }
  });

  it('points the comment thread at the comment namespace', () => {
    const source = sourceOf('src/components/feed/comment-thread.tsx');
    expect(source).toContain("t('sortComments')");
    for (const leaf of ['best', 'new', 'old']) {
      expect(source).toContain(`labelKey: 'commentSort.${leaf}'`);
    }
  });
});
