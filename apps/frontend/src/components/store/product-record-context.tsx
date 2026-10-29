'use client';

import { createContext, useContext } from 'react';
import type { Product } from '@/components/store/product-card';

/**
 * The live data the inventory catalog hands to its child `product-card` blocks.
 *
 * The catalog still owns filtering, sorting and pagination. A card block reads
 * this context to know whether its product is on the current page and where it
 * belongs, then renders the live price/stock/image around the authored copy.
 */
export interface ProductRecordContextValue {
  productsById: Map<string, Product>;
  /** Products visible on the current page, after filters, sort and pagination. */
  visibleIds: Set<string>;
  /** The card's position in the sorted page, used for CSS `order`. */
  order: Map<string, number>;
  /** True only in the builder, so a missing record can show an authoring hint. */
  editing: boolean;
}

export const ProductRecordContext = createContext<ProductRecordContextValue | null>(null);

export function useProductRecordContext(): ProductRecordContextValue | null {
  return useContext(ProductRecordContext);
}
