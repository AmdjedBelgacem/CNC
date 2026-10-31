'use client';
import { useEffect, useState } from 'react';
import { ProductCard, type Product } from '@/components/store/product-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Reveal, Stagger, StaggerItem } from '@/components/ui/motion';
interface ProductCarouselProps {
  title?: string;
  tags?: string[];
  endpoint?: string;
}
export function ProductCarousel({ title, tags, endpoint }: ProductCarouselProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const params = new URLSearchParams();
    if (tags?.length) params.set('tags', tags.join(','));
    const url = endpoint
      ? `/api/proxy/products/${endpoint}?${params}`
      : `/api/proxy/products?limit=8&${params}`;
    fetch(url)
      .then((r) => r.json())
      .then((res) => {
        setProducts(res.data || res || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tags, endpoint]);
  if (!loading && products.length === 0) return null;
  return (
    <section className="py-16 md:py-20">
      <div className="container mx-auto px-4">
        {title && (
          <Reveal>
            <h2 className="mb-10 text-balance font-display text-3xl font-medium tracking-[-0.02em] text-foreground">
              {title}
            </h2>
          </Reveal>
        )}
        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-3 rounded-2xl border border-border/70 bg-card p-3 shadow-xs">
                <Skeleton className="aspect-square w-full rounded-xl" />
                <Skeleton className="h-4 w-2/3" /> <Skeleton className="h-4 w-1/3" />
              </div>
            ))}
          </div>
        ) : (
          <Stagger inViewOnly className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {(Array.isArray(products) ? products : []).map((product, i) => (
              <StaggerItem key={product.id || product.slug} index={i} className="h-full">
                <ProductCard product={product} />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </div>
    </section>
  );
}
