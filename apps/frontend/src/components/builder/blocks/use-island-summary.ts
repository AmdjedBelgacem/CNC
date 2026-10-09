'use client';

import { useEffect, useState } from 'react';

/**
 * Live counts for a `live-island` variant, shown in the builder canvas.
 *
 * The islands themselves are async server components — `ProductsInventory`,
 * `AcademyPathways` and friends — so the editor cannot render them, and the canvas used to
 * show a dashed placeholder that admitted as much ("this stub only appears in the builder
 * canvas"). That was accurate but useless: an admin editing a page could not tell whether the
 * section they were placing would actually have any content.
 *
 * Rather than duplicate the island markup as a second implementation that would immediately
 * drift, this reports what each variant resolves to right now, straight from the same public
 * endpoints the site reads, plus where to see the real thing. The numbers are the answer to
 * the question the stub could not answer.
 *
 * Unknown variants are reported as such rather than guessed at.
 */

export interface IslandSummary {
  /** Short label for the section, e.g. "Featured products". */
  label: string;
  /** One-line description of what the live site renders here. */
  detail: string;
  /** Live counts, when the endpoint could be read. */
  counts: string[];
  /** Where the visitor sees this rendered for real. */
  href?: string;
  loading: boolean;
  /** Set when the data could not be read, so the admin knows the number is unknown. */
  failed?: boolean;
}

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Resolve each supported variant. Kept in one table so adding a variant is a single entry
 * rather than a branch in the component.
 */
const RESOLVERS: Record<
  string,
    (tenantSlug: string) => Promise<Omit<IslandSummary, 'loading'>>
> = {
  'products-featured': async () => {
    const res = await fetch('/api/proxy/products?limit=200&featured=true');
    const data = await res.json();
    const items: unknown[] = Array.isArray(data?.data) ? data.data : [];
    return {
      label: 'Featured products',
      detail: 'Live published products flagged as featured.',
      counts: [count(items.length, 'featured product')],
      href: '/products',
    };
  },
  'products-inventory': async () => {
    const res = await fetch('/api/proxy/products?limit=200');
    const data = await res.json();
    const items: any[] = Array.isArray(data?.data) ? data.data : [];
    const categories = new Set<string>();
    for (const p of items) if (p?.category) categories.add(p.category);
    return {
      label: 'Live inventory catalog',
      detail: 'Every published product, with department and availability filters.',
      counts: [count(items.length, 'product'), count(categories.size, 'department')],
      href: '/products#inventory',
    };
  },
  'products-departments': async () => {
    const res = await fetch('/api/proxy/products?limit=200');
    const data = await res.json();
    const items: any[] = Array.isArray(data?.data) ? data.data : [];
    const categories = new Set<string>();
    for (const p of items) if (p?.category) categories.add(p.category);
    return {
      label: 'Department index',
      detail: 'Derived from the categories of published products.',
      counts: [count(categories.size, 'department')],
      href: '/products#departments',
    };
  },
  'academy-pathways': async () => {
    const res = await fetch('/api/proxy/academies');
    const data = await res.json();
    const items: unknown[] = Array.isArray(data?.data) ? data.data : [];
    return {
      label: 'Academy pathways',
      detail: 'Live published academies.',
      counts: [count(items.length, 'academy', 'academies')],
      href: '/academy',
    };
  },
};

export function useIslandSummary(variant: string | undefined, tenantSlug: string): IslandSummary {
  const [summary, setSummary] = useState<IslandSummary>(() => ({
    label: 'Live section',
    detail: 'Data is loaded per request from the catalog, feed, or events API.',
    counts: [],
    loading: true,
  }));

  const resolver = variant ? RESOLVERS[variant] : undefined;

  useEffect(() => {
    if (!resolver) {
      setSummary({
        label: 'Live section',
        detail: 'No preview is available for this variant; it renders live on the public site.',
        counts: [],
        loading: false,
      });
      return;
    }

    let active = true;
    setSummary((s) => ({ ...s, loading: true, failed: false }));

    resolver(tenantSlug)
      .then((next) => {
        if (active) setSummary({ ...next, loading: false });
      })
      .catch(() => {
        if (active) {
          setSummary({
            label: labelFromVariant(variant),
            detail: 'This section renders live on the public site.',
            counts: [],
            loading: false,
            failed: true,
          });
        }
      });

    return () => {
      active = false;
    };
    // `variant` identifies the resolver; tenant changes reload the counts.
  }, [variant, tenantSlug, resolver]);

  return summary;
}

const labelFromVariant = (variant?: string) =>
  (variant ?? 'live section')
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');