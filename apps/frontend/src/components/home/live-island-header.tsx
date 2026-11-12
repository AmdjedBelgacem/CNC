import type { ReactNode } from 'react';
import { getSlotChildren, type PageLayout, type PuckNode } from '@titan/shared';
import { BuilderNode } from '@/components/builder/block-renderer';

/**
 * Builds one builder-authored slot for a live island.
 *
 * `HomeBuilder` is a client component, so it cannot receive a render function
 * from a server page (functions are not serializable across the RSC boundary).
 * The page resolves the slot itself and passes the resulting element into the
 * island component.
 *
 * Every locale renders the layout's own slot. Arabic pages used to get `undefined` here and
 * fall back to a header baked into the island component, because the layout was English-only.
 * The page layout is now served per locale (Arabic copy merged over the English structure), so
 * the builder-authored header is the right one in both languages — and skipping it made the
 * Arabic page show a different heading from the one the builder shows.
 */
export function liveIslandSlot(
  layout: PageLayout,
  variant: string,
  slot: string,
  _locale: string,
): ReactNode | undefined {
  const zones = (layout as { zones?: Record<string, PuckNode[]> }).zones ?? {};
  const node = (layout.content ?? []).find(
    (candidate) =>
      candidate.type === 'live-island' && candidate.props?.variant === variant,
  );
  if (!node) return undefined;
  const children = getSlotChildren(node, slot, zones);
  if (children.length === 0) return undefined;
  return children.map((child, index) => (
    <BuilderNode
      key={(child.props?.id as string | undefined) ?? index}
      node={child}
      zones={zones}
    />
  ));
}

/** Convenience wrapper for the live-island header slot. */
export function liveIslandHeader(
  layout: PageLayout,
  variant: string,
  locale: string,
): ReactNode | undefined {
  return liveIslandSlot(layout, variant, 'header', locale);
}

/**
 * Product ids that already have a child `product-card` block.
 *
 * The inventory catalog uses this to render a live fallback for products added
 * after the page was last seeded. Arabic pages return `undefined`: they keep the
 * translated storefront cards and ignore the English record blocks.
 */
export function liveIslandRecordIds(
  layout: PageLayout,
  variant: string,
  locale: string,
): string[] | undefined {
  if (locale !== 'en') return undefined;
  const zones = (layout as { zones?: Record<string, PuckNode[]> }).zones ?? {};
  const node = (layout.content ?? []).find(
    (candidate) =>
      candidate.type === 'live-island' && candidate.props?.variant === variant,
  );
  if (!node) return undefined;
  const ids = getSlotChildren(node, 'records', zones)
    .map((child) => (typeof child.props?.productId === 'string' ? child.props.productId : ''))
    .filter(Boolean);
  return ids.length > 0 ? ids : undefined;
}
