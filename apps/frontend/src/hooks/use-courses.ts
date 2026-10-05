'use client';

import { useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toList } from '@/lib/api/normalize';
import { coerceLocale } from '@/i18n/config';
import type { ContentLocale } from '@titan/shared';
import type { Course, Lesson } from '@/lib/api/types';

export const courseKeys = {
  all: ['courses'] as const,
  list: (locale: ContentLocale, params?: string) => [...courseKeys.all, 'list', locale, params ?? ''] as const,
  detail: (slug: string, locale: ContentLocale) => [...courseKeys.all, 'detail', locale, slug] as const,
  lesson: (courseSlug: string, lessonSlug: string, locale: ContentLocale) => [...courseKeys.all, 'lesson', locale, courseSlug, lessonSlug] as const,
};

export function useCourses(params?: { search?: string; level?: string; academy?: string }) {
  const locale = coerceLocale(useLocale());
  const search = new URLSearchParams();
  if (params?.search) search.set('search', params.search);
  if (params?.level) search.set('level', params.level);
  if (params?.academy) search.set('academy', params.academy);
  const queryString = search.toString();
  const query = useQuery({
    queryKey: courseKeys.list(locale, queryString),
    queryFn: async () => toList<Course>(await api.get(`/courses${queryString ? `?${queryString}` : ''}`, { locale })),
  });
  return { ...query, courses: query.data ?? [] };
}

/**
 * `initialData` seeds the cache with the server's own fetch. Without it the detail page
 * had to render a skeleton and fetch on the client, so the first HTML response carried no
 * course content. Seeding means the server render and the client cache agree on the query
 * key, so React Query does not immediately refetch and the page never flashes.
 */
export function useCourse(
  slug: string,
  requestedLocale?: ContentLocale,
  initialData?: Course | null,
) {
  const locale = coerceLocale(requestedLocale ?? useLocale());
  const query = useQuery({
    queryKey: courseKeys.detail(slug, locale),
    queryFn: () => api.get<Course>(`/courses/${encodeURIComponent(slug)}`, { locale }),
    enabled: !!slug,
    ...(initialData ? { initialData } : {}),
  });
  return { ...query, course: query.data ?? null };
}

export function useLesson(courseSlug: string, lessonSlug?: string, requestedLocale?: ContentLocale) {
  const locale = coerceLocale(requestedLocale ?? useLocale());
  const resolvedLessonSlug = lessonSlug ?? courseSlug;
  const query = useQuery({
    queryKey: courseKeys.lesson(courseSlug, resolvedLessonSlug, locale),
    queryFn: () => lessonSlug
      ? api.get<Lesson>(`/courses/${encodeURIComponent(courseSlug)}/lessons/${encodeURIComponent(resolvedLessonSlug)}`, { locale })
      : api.get<Lesson>(`/courses/lessons/${encodeURIComponent(resolvedLessonSlug)}`, { locale }),
    enabled: !!courseSlug && !!resolvedLessonSlug,
  });
  return { ...query, lesson: query.data ?? null };
}
