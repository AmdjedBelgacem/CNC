'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
export function useProducts() {
  return useQuery({ queryKey: ['products'], queryFn: () => api.get('/products') });
}
export function useProduct(slug: string) {
  return useQuery({ queryKey: ['product', slug], queryFn: () => api.get(`/products/${slug}`) });
}
