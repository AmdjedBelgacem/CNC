'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Product } from '@/components/store/product-card';
export function CourseProductsSidebar({
  tags,
  courseCategory,
}: {
  tags?: string[];
  courseCategory?: string;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    if (tags?.length) {
      fetch(`/api/proxy/products/by-tags?tags=${tags.join(',')}&limit=3`, { credentials: 'include' })
        .then((r) => r.json())
        .then((data) => setProducts(Array.isArray(data) ? data : []))
        .catch(() => {});
    } else {
      fetch(`/api/proxy/products/featured?limit=3`, { credentials: 'include' })
        .then((r) => r.json())
        .then((data) => setProducts(data?.data || []))
        .catch(() => {});
    }
  }, [tags, courseCategory]);
  if (products.length === 0) return null;
  return (
    <div className="rounded-lg border bg-card p-5">
      {' '}
      <h3 className="font-semibold mb-3">Recommended Products</h3>{' '}
      <div className="space-y-3">
        {' '}
        {products.map((p) => (
          <Link key={p.id} href={`/products/${p.slug}`} className="flex items-center gap-3 group">
            {' '}
            <div className="aspect-square w-14 rounded-md bg-muted overflow-hidden shrink-0">
              {' '}
              {p.thumbnailUrl ? (
                <img src={p.thumbnailUrl} alt={p.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground text-xs">
                  ?
                </div>
              )}{' '}
            </div>{' '}
            <div className="flex-1 min-w-0">
              {' '}
              <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                {p.title}
              </p>{' '}
              <p className="text-xs text-muted-foreground">
                {' '}
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: p.currency || 'USD',
                }).format(p.price / 100)}{' '}
              </p>{' '}
            </div>{' '}
          </Link>
        ))}{' '}
      </div>{' '}
      <Link href="/products" className="text-xs text-primary hover:underline mt-3 inline-block">
        {' '}
        View all tools →{' '}
      </Link>{' '}
    </div>
  );
}
