'use client';

import { useEffect, useState } from 'react';

/**
 * Live values for the catalog hero's stat strip inside the builder.
 *
 * The seeded layout stores `—` for SKUs, Departments and Price range, and the public site
 * fills them in on the server via `productsHeroStats`. In the editor nothing did that, so the
 * canvas showed three em dashes while the page visitors saw showed `3`, `2` and a price range —
 * the clearest remaining case of the builder not showing what the site shows.
 *
 * Only placeholders are replaced. A stat the admin has deliberately set to a real value keeps
 * it, so this never overrides an edit. Values come from the same public endpoint the site uses
 * and are formatted with the very same `formatMinorUnits` the server render uses, so the canvas
 * shows `SAR 0.01 – SAR 0.01` rather than a bare `0.01 – 0.01`.
 */

import { coerceCurrency, formatMinorUnits } from '@/lib/money';
import { useBuilderLivePreview } from '@/components/builder/live-preview-context';

export interface HeroStat {
  label: string;
  value: string;
}

const PLACEHOLDERS = new Set(['—', '-', '–', '--', '', '—']);

/** Mirrors the server's "no usable price" case rather than inventing a number. */
export function isPlaceholderValue(value: string | undefined): boolean {
  return value === undefined || PLACEHOLDERS.has(value.trim());
}

export function useCatalogStats(stats: HeroStat[] | undefined): HeroStat[] | undefined {
  const [live, setLive] = useState<HeroStat[] | null>(null);
  const preview = useBuilderLivePreview();
  const liveHero = preview?.heroStats ?? null;
  const waitingForLive = Boolean(preview?.loading) && !liveHero;

  useEffect(() => {
    if (waitingForLive || liveHero) return;
    if (!stats?.length) return;
    // Nothing to do unless the layout actually carries placeholders.
    if (!stats.some((s) => isPlaceholderValue(s.value))) return;

    let active = true;
    fetch('/api/proxy/products?limit=200')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        const items: any[] = Array.isArray(data?.data) ? data.data : [];
        if (!items.length) return;

        const departments = new Set<string>();
        let min: number | null = null;
        let max = 0;
        for (const p of items) {
          if (p?.category) departments.add(p.category);
          const price = typeof p?.price === 'number' ? p.price : null;
          if (price !== null) {
            min = min === null ? price : Math.min(min, price);
            max = Math.max(max, price);
          }
        }
        // Same formatter the server render uses, so the two agree character for character.
        const currency = coerceCurrency(items[0]?.currency);
        const money = (minor: number) => formatMinorUnits(minor, currency, 'en-US');
        const range =
          min !== null && max > 0 ? `${money(min)} – ${money(max)}` : null;

        setLive([
          { label: stats[0]?.label ?? 'SKUs', value: String(items.length) },
          { label: stats[1]?.label ?? 'Departments', value: String(departments.size) },
          {
            label: stats[2]?.label ?? 'Price range',
            value: range ?? stats[2]?.value ?? '—',
          },
        ]);
      })
      .catch(() => {
        /* keep the placeholders; nothing to show */
      });

    return () => {
      active = false;
    };
  }, [stats, waitingForLive, liveHero]);

  if (waitingForLive) return stats;
  if (liveHero) return liveHero;
  if (!stats?.length) return stats;
  if (!live) return stats;

  // Overlay live values only where the stored value is still a placeholder.
  return stats.map((s, i) => (isPlaceholderValue(s.value) && live[i] ? { ...s, value: live[i].value } : s));
}
