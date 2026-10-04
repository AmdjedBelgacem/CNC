'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toList } from '@/lib/api/normalize';
import type { Academy } from '@/lib/api/types';

export const academyKeys = {
  all: ['academies'] as const,
  list: () => [...academyKeys.all, 'list'] as const,
  detail: (slug: string) => [...academyKeys.all, 'detail', slug] as const,
};

/**
 * Academies are the course categories in this product — a course belongs to an
 * academy, and the academy grid doubles as the category browser.
 */
export function useAcademies() {
  const query = useQuery({
    queryKey: academyKeys.list(),
    queryFn: async () => toList<Academy>(await api.get('/academies')),
  });
  return { ...query, academies: query.data ?? [] };
}

export function useAcademy(slug: string) {
  const query = useQuery({
    queryKey: academyKeys.detail(slug),
    queryFn: () => api.get<Academy>(`/academies/${slug}`),
    enabled: !!slug,
  });
  return { ...query, academy: query.data ?? null };
}
