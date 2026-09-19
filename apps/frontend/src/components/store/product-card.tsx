'use client';
import Link from 'next/link';
import { Card, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, AlertTriangle } from 'lucide-react';
import { useCartStore } from '@/stores/cart-store';
export interface Product {
  id: string;
  title: string;
  slug: string;
  tagline?: string;
  description?: string;
  features?: string[];
  thumbnailUrl?: string;
  price: number;
  compareAtPrice?: number;
  currency: string;
  inventory?: number;
  allowBackorder?: boolean;
  backorderLeadDays?: number;
  isDigital?: boolean;
  isPublished?: boolean;
  category?: string;
  tags?: string[];
  featured?: boolean;
  variants?: ProductVariant[];
}
export interface ProductVariant {
  id: string;
  title: string;
  sku?: string;
  price?: number;
  inventory?: number;
  allowBackorder?: boolean;
  options?: Record<string, string>;
}
export function ProductCard({ product }: { product: Product }) {
  const addItem = useCartStore((s) => s.addItem);
  const outOfStock = (product.inventory ?? 0) <= 0 && !product.allowBackorder;
  const backorder = (product.inventory ?? 0) <= 0 && product.allowBackorder;
  const price = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: product.currency || 'USD',
  }).format((product.variants?.[0]?.price ?? product.price) / 100);
  const hasSale = product.compareAtPrice && product.compareAtPrice > product.price;
  return (
    <Link href={`/products/${product.slug}`}>
      {' '}
      <Card className="group overflow-hidden transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 h-full flex flex-col">
        {' '}
        <div className="aspect-square bg-muted overflow-hidden relative">
          {' '}
          {product.thumbnailUrl ? (
            <img
              src={product.thumbnailUrl}
              alt={product.title}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              {' '}
              <ShoppingCart className="h-12 w-12 opacity-20" />{' '}
            </div>
          )}{' '}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {' '}
            {product.isDigital && <Badge variant="secondary">Digital</Badge>}{' '}
            {backorder && (
              <Badge
                variant="outline"
                className="border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/30"
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                Backorder
              </Badge>
            )}{' '}
            {hasSale && <Badge variant="destructive">Sale</Badge>}{' '}
          </div>{' '}
          {outOfStock && (
            <div className="absolute inset-0 bg-background/60-[1px] flex items-center justify-center">
              {' '}
              <Badge variant="outline" className="text-sm px-3 py-1">
                Out of Stock
              </Badge>{' '}
            </div>
          )}{' '}
        </div>{' '}
        <CardHeader className="flex-1">
          {' '}
          <CardTitle className="text-base">{product.title}</CardTitle>{' '}
          {product.tagline && (
            <p className="text-sm text-muted-foreground line-clamp-2">{product.tagline}</p>
          )}{' '}
        </CardHeader>{' '}
        <CardFooter className="flex items-center justify-between">
          {' '}
          <div className="flex items-center gap-2">
            {' '}
            <span className="text-lg font-bold">{price}</span>{' '}
            {hasSale && (
              <span className="text-sm text-muted-foreground line-through">
                {' '}
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: product.currency || 'USD',
                }).format(product.compareAtPrice! / 100)}{' '}
              </span>
            )}{' '}
          </div>{' '}
          {!outOfStock && (
            <Button
              size="sm"
              variant={backorder ? 'outline' : 'default'}
              onClick={(e) => {
                e.preventDefault();
                addItem({
                  productId: product.slug,
                  title: product.title,
                  price: product.variants?.[0]?.price ?? product.price,
                  thumbnailUrl: product.thumbnailUrl,
                });
              }}
            >
              {' '}
              <ShoppingCart className="mr-1 h-4 w-4" /> {backorder ? 'Pre-order' : 'Add'}{' '}
            </Button>
          )}{' '}
        </CardFooter>{' '}
      </Card>{' '}
    </Link>
  );
}
