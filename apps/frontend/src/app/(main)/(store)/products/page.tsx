'use client';
import { useEffect, useState } from 'react';
import { ProductCard, type Product } from '@/components/store/product-card';
import { Skeleton } from '@/components/ui/skeleton';
export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  // Category options derived from real catalog rows (no hardcoded taxonomy).
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  useEffect(() => {
    fetch(`/api/proxy/products?limit=100`, { credentials: 'include' })
      .then((r) => r.json())
      .then((res) => setAllProducts(res.data || []))
      .catch(() => {});
  }, []);
  const categories = [
    'All',
    ...Array.from(
      new Set(
        allProducts
          .map((p) => (p as { category?: string | null }).category)
          .filter((c): c is string => !!c),
      ),
    ),
  ];
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (category !== 'All') params.set('category', category);
    if (search) params.set('search', search);
    params.set('limit', '50');
    fetch(`/api/proxy/products?${params}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((res) => setProducts(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [category, search]);
  return (
    <div className="container mx-auto px-4 py-12">
      {' '}
      <h1 className="text-3xl font-bold mb-2">Tool Store</h1>{' '}
      <p className="text-muted-foreground mb-8">Everything you need for the shop.</p>{' '}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        {' '}
        <div className="flex gap-2 flex-wrap">
          {' '}
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${category === cat ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}
            >
              {' '}
              {cat}{' '}
            </button>
          ))}{' '}
        </div>{' '}
        <input
          type="search"
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto px-4 py-2 rounded-lg border bg-background text-sm w-full sm:w-64"
        />{' '}
      </div>{' '}
      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {' '}
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-3">
              {' '}
              <Skeleton className="aspect-square w-full rounded-lg" />{' '}
              <Skeleton className="h-4 w-2/3" /> <Skeleton className="h-4 w-1/3" />{' '}
            </div>
          ))}{' '}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground">
          {' '}
          No products found. Try adjusting your filters.{' '}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {' '}
          {products.map((product) => (
            <ProductCard key={product.id || product.slug} product={product} />
          ))}{' '}
        </div>
      )}{' '}
    </div>
  );
}
