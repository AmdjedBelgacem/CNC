'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { Product } from '@/components/store/product-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getImageSrc } from '@/lib/images';

export function CourseProductsSidebar({
  tags,
  courseId,
  academyId,
}: {
  tags?: string[];
  courseId?: string;
  academyId?: string;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    let url: string;
    if (courseId) {
      url = `/api/proxy/products?courseId=${courseId}&limit=3`;
    } else if (academyId) {
      url = `/api/proxy/products?academyId=${academyId}&limit=3`;
    } else if (tags?.length) {
      url = `/api/proxy/products/by-tags?tags=${tags.join(',')}&limit=3`;
    } else {
      url = `/api/proxy/products/featured?limit=3`;
    }
    fetch(url, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        setProducts(Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []);
      })
      .catch(() => {});
  }, [tags, courseId, academyId]);
  if (products.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          Store
        </p>
        <CardTitle className="font-display text-base">Recommended Products</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {products.map((p) => (
            <Link
              key={p.id}
              href={`/products/${p.slug}`}
              className="group flex items-center gap-3"
            >
              <div className="aspect-square w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getImageSrc(p.thumbnailUrl, 'product')} alt={p.title} className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                  {p.title}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: p.currency || 'USD',
                  }).format(p.price / 100)}
                </p>
              </div>
            </Link>
          ))}
        </div>
        <Link
          href="/products"
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          View all tools
          <ArrowRight className="size-3.5 rtl:rotate-180" />
        </Link>
      </CardContent>
    </Card>
  );
}
