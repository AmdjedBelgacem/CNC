'use client';

import type { ProductCardProps } from '@titan/shared';
import type { BlockComponentProps } from './index';
import { ProductCard } from '@/components/store/product-card';
import { useProductRecordContext } from '@/components/store/product-record-context';
import { LayoutBox, StaggerItem } from '@/components/ui/motion';
import { layoutStyle } from '@/components/builder/layout-style';
import { cn } from '@/lib/utils';

/**
 * One product card in the live inventory.
 *
 * The card is a real builder part: it can be selected, reordered in Layers and
 * its title/tagline edited. Commerce data stays live — the catalog resolves the
 * product by id and supplies the current price, stock, image and link.
 */
export function ProductCardBlock({ props }: BlockComponentProps<ProductCardProps>) {
  const context = useProductRecordContext();
  const product = context?.productsById.get(props.productId);

  if (!product) {
    if (!context?.editing) return null;
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">{props.title || 'Product record'}</p>
        <p className="mt-1">
          This product is not in the live catalogue right now. Its card will return when the
          product is published again.
        </p>
      </div>
    );
  }

  if (context && !context.visibleIds.has(product.id)) return null;

  const merged = {
    ...product,
    title: props.title.trim() || product.title,
    tagline: props.tagline.trim() || product.tagline,
  };
  const order = context?.order.get(product.id) ?? 0;

  return (
    <div style={{ order }}>
      <StaggerItem index={order}>
        <LayoutBox>
          <div className={cn(props.className)} style={layoutStyle(props)}>
            <ProductCard product={merged} />
          </div>
        </LayoutBox>
      </StaggerItem>
    </div>
  );
}
