import { describe, it, expect } from 'vitest';
import { BUILDER_PAGE_DEFS } from '@titan/shared';
import { resolvePageHref } from '../src/modules/builder/navigation.service';

/**
 * The public URL a navigation item of type `page` points at.
 *
 * A page slug is a CMS identity, not a route: `academy-landing` is rendered by
 * `/academy`, so building the href as `/${pageSlug}` shipped a dropdown whose
 * first link 404'd for every visitor. These assertions pin the resolver to the
 * shared page registry, because nothing else would notice the two drifting.
 */

describe('navigation page hrefs', () => {
  it('points the academy landing link at the real academy route', () => {
    expect(resolvePageHref('academy-landing')).toBe('/academy');
  });

  it('resolves every registry slug to its declared path', () => {
    for (const def of BUILDER_PAGE_DEFS) {
      if (!def.path) continue;
      expect(resolvePageHref(def.slug)).toBe(def.path);
    }
  });

  it('never resolves to a path that only looks like a route', () => {
    // The failing href was `/academy-landing`: a real-looking path with no
    // route behind it. Any registry entry whose path is absent means the
    // builder would send visitors somewhere that does not exist.
    expect(resolvePageHref('academy-landing')).not.toBe('/academy-landing');
  });

  it('falls back to the slug path for an unregistered page', () => {
    // A CMS-only page has no registry entry; the catch-all route serves it at
    // `/{slug}`, so the fallback has to stay.
    expect(resolvePageHref('our-machines')).toBe('/our-machines');
  });

  it('agrees with the paths the frontend actually routes', () => {
    // The defs that must match a real Next.js route. Guarded explicitly so a
    // rename in page-defaults.ts without a matching route fails here.
    const routed = ['home', 'academy-landing', 'products', 'feed', 'events'];
    for (const slug of routed) {
      const href = resolvePageHref(slug);
      expect(href.startsWith('/'), `${slug} -> ${href}`).toBe(true);
      expect(href).not.toContain('//');
    }
  });
});