import { isNodeArray, type PageLayout, type PuckNode } from '@titan/shared';
import type { Product as CatalogProduct } from '@/components/store/product-card';

/**
 * Seeds one `product-card` child per live product in the inventory island.
 *
 * The catalog remains the source of truth for filtering, sorting, pagination
 * and commerce data. The child blocks exist so each card is a real, selectable
 * builder part; the seed is idempotent and leaves an existing `records` slot
 * alone, so reordering or editing cards is never overwritten by a reload.
 */
export function seedProductInventoryRecords(
  layout: PageLayout,
  products: CatalogProduct[] | null | undefined,
): PageLayout {
  if (!products?.length) return layout;

  let changed = false;

  const mapNode = (node: PuckNode): PuckNode => {
    let next = node;

    if (node.type === 'live-island' && node.props?.variant === 'products-inventory') {
      const existing = node.props?.records;
      if (!isNodeArray(existing) || existing.length === 0) {
        const records: PuckNode[] = products.map((product) => ({
          type: 'product-card',
          props: {
            // Stable ids keep re-seeding, Arabic merges and zone lookups on the
            // same nodes instead of accumulating a second set of cards.
            id: `product-card-${product.id}`,
            productId: product.id,
            title: product.title,
            tagline: product.tagline ?? '',
          },
        }));
        next = { ...node, props: { ...node.props, records } };
        changed = true;
      }
    }

    const props = next.props ?? {};
    for (const [key, value] of Object.entries(props)) {
      if (!isNodeArray(value)) continue;
      const mapped = value.map(mapNode);
      if (mapped.some((child, index) => child !== value[index])) {
        next = { ...next, props: { ...next.props, [key]: mapped } };
        changed = true;
      }
    }

    return next;
  };

  const content = (layout.content ?? []).map(mapNode);
  if (!changed) return layout;
  return { ...layout, content };
}
