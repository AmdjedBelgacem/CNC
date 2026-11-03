'use client';
import { useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toList } from '@/lib/api/normalize';
import { coerceLocale } from '@/i18n/config';
import type { ContentLocale } from '@titan/shared';
import type { Product } from '@/lib/api/types';

export const productKeys = {
  all: ['products'] as const,
  list: (locale: ContentLocale, params?: string) => [...productKeys.all, 'list', locale, params ?? ''] as const,
  featured: (locale: ContentLocale) => [...productKeys.all, 'featured', locale] as const,
  detail: (slug: string, locale: ContentLocale) => [...productKeys.all, 'detail', locale, slug] as const,
  related: (id: string, locale: ContentLocale) => [...productKeys.all, 'related', locale, id] as const,
};

export function useProducts(params?: { category?: string; featured?: boolean }, requestedLocale?: ContentLocale) {
  const locale = coerceLocale(requestedLocale ?? useLocale());
  const search = new URLSearchParams();
  if (params?.category) search.set('category', params.category);
  if (params?.featured) search.set('featured', 'true');
  const queryString = search.toString();
  const query = useQuery({
    queryKey: productKeys.list(locale, queryString),
    queryFn: async () => toList<Product>(await api.get(`/products${queryString ? `?${queryString}` : ''}`, { locale })),
  });
  return { ...query, products: query.data ?? [] };
}

export function useFeaturedProducts(requestedLocale?: ContentLocale) {
  const locale = coerceLocale(requestedLocale ?? useLocale());
  const query = useQuery({
    queryKey: productKeys.featured(locale),
    queryFn: async () => toList<Product>(await api.get('/products/featured', { locale })),
  });
  return { ...query, products: query.data ?? [] };
}

/**
 * `initialData` is what the server wrapper fetched. Seeding the cache with it means the
 * first render already has the product, so the page is never a blank shell; React Query
 * still revalidates in the background.
 */
export function useProduct(slug: string, initialData?: Product | null, requestedLocale?: ContentLocale) {
  const locale = coerceLocale(requestedLocale ?? useLocale());
  const query = useQuery({
    queryKey: productKeys.detail(slug, locale),
    queryFn: () => api.get<Product>(`/products/${encodeURIComponent(slug)}`, { locale }),
    enabled: !!slug,
    initialData: initialData ?? undefined,
  });
  return { ...query, product: query.data ?? null };
}

export function useRelatedProducts(id: string | null, requestedLocale?: ContentLocale) {
  const locale = coerceLocale(requestedLocale ?? useLocale());
  const query = useQuery({
    queryKey: productKeys.related(id ?? 'none', locale),
    queryFn: async () => toList<Product>(await api.get(`/products/related/${id}`, { locale })),
    enabled: !!id,
  });
  return { ...query, products: query.data ?? [] };
}
