'use client';
import { useEffect, useState } from 'react';
import { ProductCard, type Product } from '@/components/store/product-card';
import { Skeleton } from '@/components/ui/skeleton';
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
    <section className="py-12">
      {' '}
      <div className="container mx-auto px-4">
        {' '}
        {title && <h2 className="text-2xl font-bold mb-8">{title}</h2>}{' '}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {' '}
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  {' '}
                  <Skeleton className="aspect-square w-full rounded-lg" />{' '}
                  <Skeleton className="h-4 w-2/3" /> <Skeleton className="h-4 w-1/3" />{' '}
                </div>
              ))
            : (Array.isArray(products) ? products : []).map((product) => (
                <ProductCard key={product.id || product.slug} product={product} />
              ))}{' '}
        </div>{' '}
      </div>{' '}
    </section>
  );
}
