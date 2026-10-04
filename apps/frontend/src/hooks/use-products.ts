'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toList } from '@/lib/api/normalize';
import type { Product } from '@/lib/api/types';

export const productKeys = {
  all: ['products'] as const,
  list: () => [...productKeys.all, 'list'] as const,
  featured: () => [...productKeys.all, 'featured'] as const,
  detail: (slug: string) => [...productKeys.all, 'detail', slug] as const,
  related: (id: string) => [...productKeys.all, 'related', id] as const,
};

export function useProducts() {
  const query = useQuery({
    queryKey: productKeys.list(),
    queryFn: async () => toList<Product>(await api.get('/products')),
  });
  return { ...query, products: query.data ?? [] };
}

export function useFeaturedProducts() {
  const query = useQuery({
    queryKey: productKeys.featured(),
    queryFn: async () => toList<Product>(await api.get('/products/featured')),
  });
  return { ...query, products: query.data ?? [] };
}

export function useProduct(slug: string) {
  const query = useQuery({
    queryKey: productKeys.detail(slug),
    queryFn: () => api.get<Product>(`/products/${slug}`),
    enabled: !!slug,
  });
  return { ...query, product: query.data ?? null };
}

export function useRelatedProducts(id: string | null) {
  const query = useQuery({
    queryKey: productKeys.related(id ?? 'none'),
    queryFn: async () => toList<Product>(await api.get(`/products/related/${id}`)),
    enabled: !!id,
  });
  return { ...query, products: query.data ?? [] };
}
