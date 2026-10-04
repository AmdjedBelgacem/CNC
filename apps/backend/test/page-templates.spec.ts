import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  PAGE_TEMPLATES,
  getTemplateLayout,
  validatePageLayout,
  validateSlug,
  RESERVED_SLUGS,
  BUILDER_PAGE_SLUGS,
  NAV_MAX_DEPTH,
  normalizeSlug,
  seedTemplateFor,
} from '@titan/shared';

const read = (path: string) => JSON.parse(readFileSync(resolve(__dirname, path), 'utf8'));

/**
 * A template whose blocks fail validation cannot be published, and the failure
 * only surfaces when an author clicks Publish — by which point they have written
 * a page on top of it. The first version of these templates used `headline-sm`
 * and a `secondary` button variant, neither of which exists in the block
 * registry, and both were caught only by an end-to-end publish attempt.
 */
describe('page templates', () => {
  for (const name of PAGE_TEMPLATES) {
    it(`the "${name}" template validates against the block registry`, () => {
      const layout = getTemplateLayout(name);
      const result = validatePageLayout(layout);
      if (!result.ok) {
        throw new Error(
          `Template "${name}" is not publishable:\n  ${result.issues.join('\n  ')}`,
        );
      }
      expect(result.ok).toBe(true);
    });
  }

  it('blank is genuinely empty, so the author starts from nothing', () => {
    expect(getTemplateLayout('blank').content).toEqual([]);
  });

  /**
   * Every node needs a stable, unique id.
   *
   * Puck keys its canvas by node id and falls back to the array index when one is
   * missing, so two id-less siblings in a single slot are React's duplicate-key
   * warning. An id is also the only handle the inspector, the find-in-page jump
   * and copy/duplicate have on a node. The first version of these templates only
   * checked that ids which *existed* were unique, so the gap passed.
   */
  for (const name of PAGE_TEMPLATES.filter((n) => n !== 'blank')) {
    it(`every node in "${name}" has a unique id`, () => {
      const layout = getTemplateLayout(name);
      expect(layout.content.length, `${name} should have top-level sections`).toBeGreaterThanOrEqual(3);

      const ids: string[] = [];
      const missing: string[] = [];
      const walk = (nodes: Array<{ type: string; props?: Record<string, unknown> }>, path: string) => {
        nodes.forEach((node, index) => {
          const id = node.props?.id;
          const at = `${path} > ${node.type}[${index}]`;
          if (typeof id === 'string' && id.trim()) ids.push(id);
          else missing.push(at);
          for (const [slot, value] of Object.entries(node.props ?? {})) {
            if (Array.isArray(value) && value.length && typeof value[0] === 'object') {
              walk(value as Array<{ type: string; props?: Record<string, unknown> }>, `${at} > ${slot}`);
            }
          }
        });
      };
      walk(layout.content, 'content');

      expect(missing, 'these nodes have no id, so Puck keys them by array index').toEqual([]);
      const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
      expect(dupes, 'duplicate ids collide in the canvas').toEqual([]);
    });
  }

  it('an unknown template name falls back to blank rather than throwing', () => {
    expect(getTemplateLayout('does-not-exist').content).toEqual([]);
    expect(getTemplateLayout(null).content).toEqual([]);
  });

  it('templates declare the schema version the editor writes', () => {
    for (const name of PAGE_TEMPLATES) {
      expect(getTemplateLayout(name).schemaVersion).toBe(2);
    }
  });
});

describe('slug rules', () => {
  it('normalizes human input into a usable slug', () => {
    expect(normalizeSlug('About Our Machines')).toBe('about-our-machines');
    expect(normalizeSlug('  CNC 101: Intro  ')).toBe('cnc-101-intro');
    expect(normalizeSlug("Titan's Shop")).toBe('titans-shop');
    expect(normalizeSlug('---edges---')).toBe('edges');
  });

  it('rejects slugs that already belong to a real route', () => {
    // These are route folders today. A page created at `/products` would publish
    // cleanly and then 404 every visitor, because Next.js resolves the folder
    // before a dynamic [slug].
    for (const slug of ['products', 'academy', 'feed', 'events', 'cart', 'checkout', 'admin', 'login']) {
      expect(RESERVED_SLUGS, `${slug} must stay reserved`).toContain(slug);
      expect(validateSlug(slug).ok, `${slug} must be refused`).toBe(false);
      expect(validateSlug(slug).reason).toBe('reserved');
    }
  });

  it('refuses to create a page on top of a built-in page slug', () => {
    const result = validateSlug('home', { systemSlugs: BUILDER_PAGE_SLUGS });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('system');
  });

  it('accepts a normal custom slug', () => {
    for (const slug of ['our-machines', 'cnc-101', 'a', 'machines-2026']) {
      expect(validateSlug(slug).ok, slug).toBe(true);
    }
  });

  it('refuses every built-in page slug, reporting it as built-in', () => {
    for (const slug of BUILDER_PAGE_SLUGS) {
      const result = validateSlug(slug, { systemSlugs: BUILDER_PAGE_SLUGS });
      expect(result.ok, `${slug} must be refused`).toBe(false);
      expect(result.reason, `${slug} should report the specific reason`).toBe('system');
    }
  });

  it('rejects an empty slug', () => {
    expect(validateSlug('').reason).toBe('empty');
    expect(validateSlug('   ').reason).toBe('empty');
  });

  it('normalizes rather than rejecting sloppy separator input', () => {
    // An author typing a leading hyphen or a double hyphen is mid-thought, not
    // making a mistake worth a hard error — the slug is repaired instead.
    expect(validateSlug('-leading').ok).toBe(true);
    expect(validateSlug('-leading').slug).toBe('leading');
    expect(validateSlug('double--hyphen').slug).toBe('double-hyphen');
    expect(validateSlug('has spaces').slug).toBe('has-spaces');
  });

  it('normalization is total, so only empty/system/reserved are reachable', () => {
    // `normalizeSlug` lowercases, collapses every non-alphanumeric run to a
    // single hyphen, trims the ends and truncates to 100. Whatever comes out
    // therefore always matches the pattern, which makes `format` unreachable
    // from this function. The raw-input pattern still gates the HTTP boundary
    // in UpdatePageDto/CreatePageDto; this is the second line of defence.
    const reachable = ['empty', 'system', 'reserved', undefined];
    for (const input of ['UPPER CASE', '///', '---', 'a'.repeat(400), '🤖 robot', 'a_b', ' spaced out ']) {
      const result = validateSlug(input);
      expect(
        reachable,
        `"${input}" produced an unreachable reason: ${result.reason}`,
      ).toContain(result.reason);
    }
    expect(validateSlug('a'.repeat(400)).slug).toHaveLength(100);
  });

  it('keeps the navigation depth cap at two levels', () => {
    expect(NAV_MAX_DEPTH).toBe(2);
  });
});

describe('page lifecycle metadata reaches the API contract', () => {
  it('the DTO exposes every field the editor can set', () => {
    const dto = read('./builder-lifecycle-contract.json');
    for (const field of ['slug', 'title', 'template', 'showInNav', 'seoTitle', 'seoDescription', 'copyFromSlug']) {
      expect(dto.createPage, `CreatePageDto.${field}`).toContain(field);
    }
    for (const field of ['title', 'slug', 'status', 'showInNav', 'seoTitle', 'seoDescription']) {
      expect(dto.updatePage, `UpdatePageDto.${field}`).toContain(field);
    }
    for (const value of ['draft', 'published', 'disabled']) {
      expect(dto.updatePage, 'status enum').toContain(value);
    }
    for (const field of ['label', 'labelAr', 'type', 'href', 'pageSlug', 'children', 'visible', 'openInNewTab']) {
      expect(dto.navItem, `NavItemDto.${field}`).toContain(field);
    }
  });
});

// A tiny guard so an accidental import of a non-existent helper fails loudly
// here rather than silently resolving to undefined at runtime.
describe('seed helper', () => {
  it('seedTemplateFor is exported for backfills', () => {
    expect(typeof seedTemplateFor).toBe('function');
    expect(seedTemplateFor('landing').content.length).toBeGreaterThan(0);
  });
});

/**
 * Raw SQL seeds bypass block validation.
 *
 * The demo page in migration 026 shipped with `size: "headline-sm"`, which is not
 * a member of `headingPropsSchema.size`, so the page rendered from the database
 * but could never be re-published or edited — the editor rejected the layout it
 * had itself been serving. Seeding directly into `pages` skips the same
 * validation `validatePageLayout` applies everywhere else, so it needs a guard.
 */
describe('seeded demo layout is publishable', () => {
  const migration = readFileSync(
    resolve(__dirname, '../src/database/migrations/026_demo_page_and_nav.sql'),
    'utf8',
  );

  const jsonBlocks = [...migration.matchAll(/'(\{.*?\})'::jsonb/gs)].map((m) => m[1]!);

  it('finds the seeded layout', () => {
    expect(jsonBlocks.length, 'migration 026 seeds a layout and a page version').toBeGreaterThanOrEqual(1);
  });

  for (const [index, raw] of jsonBlocks.entries()) {
    it(`seeded layout #${index + 1} validates against the block registry`, () => {
      // The version row is wrapped in a VALUES list; take the object itself.
      const start = raw.indexOf('{');
      const parsed = JSON.parse(raw.slice(start));
      const layout = Array.isArray(parsed) ? parsed[0] : parsed;
      const result = validatePageLayout(layout);
      if (!result.ok) throw new Error(`Unpublishable seed:\n  ${result.issues.join('\n  ')}`);
      expect(result.ok).toBe(true);
    });
  }
});
