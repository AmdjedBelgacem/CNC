'use client';

import { useLocale } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ContentLocale, QuizAttemptInput, QuizAttemptResult } from '@titan/shared';
import { api } from '@/lib/api-client';
import { coerceLocale } from '@/i18n/config';
import { toList } from '@/lib/api/normalize';
import type { CourseProgress, Enrollment, PlaybackInfo } from '@/lib/api/types';

export const learningKeys = {
  all: ['learning'] as const,
  mine: (locale: ContentLocale) => [...learningKeys.all, 'mine', locale] as const,
  progress: (courseId: string, locale: ContentLocale) => [...learningKeys.all, 'progress', locale, courseId] as const,
  playback: (courseSlug: string, lessonSlug: string, locale: ContentLocale) => [...learningKeys.all, 'playback', locale, courseSlug, lessonSlug] as const,
};

export function useMyEnrollments(enabled = true) {
  const locale = coerceLocale(useLocale());
  const query = useQuery({
    queryKey: learningKeys.mine(locale),
    queryFn: async () => toList<Enrollment>(await api.get('/courses/enrollments/mine', { locale })),
    enabled,
  });
  return { ...query, enrollments: query.data ?? [] };
}

export function useCourseProgress(courseId: string | null, enabled = true) {
  const locale = coerceLocale(useLocale());
  return useQuery({
    queryKey: learningKeys.progress(courseId ?? 'none', locale),
    queryFn: () => api.get<CourseProgress>(`/courses/${courseId}/progress`, { locale }),
    enabled: enabled && !!courseId,
    refetchInterval: 30000,
  });
}

export function useEnroll() {
  const locale = coerceLocale(useLocale());
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (courseId: string) => api.post('/courses/enroll', { courseId }, { locale }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: learningKeys.all });
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
  });
}

export function useLessonPlayback(courseSlug: string, lessonSlug: string, enabled = true, requestedLocale?: ContentLocale) {
  const locale = coerceLocale(requestedLocale ?? useLocale());
  return useQuery({
    queryKey: learningKeys.playback(courseSlug, lessonSlug, locale),
    queryFn: () => api.get<PlaybackInfo>(`/courses/${encodeURIComponent(courseSlug)}/lessons/${encodeURIComponent(lessonSlug)}/playback`, { locale }),
    enabled: enabled && !!courseSlug && !!lessonSlug,
    retry: 1,
  });
}

export function useUpdateLessonProgress() {
  const locale = coerceLocale(useLocale());
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { lessonId: string; completed?: boolean; watchTimeSeconds?: number; quizScore?: number }) => api.post('/courses/progress', body, { locale }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: learningKeys.all });
    },
  });
}

export function useSubmitQuizAttempt() {
  const locale = coerceLocale(useLocale());
  return useMutation({
    mutationFn: ({ courseSlug, lessonSlug, quizId, answers }: { courseSlug: string; lessonSlug: string; quizId: string } & QuizAttemptInput) => api.post<QuizAttemptResult>(`/courses/${encodeURIComponent(courseSlug)}/lessons/${encodeURIComponent(lessonSlug)}/quizzes/${encodeURIComponent(quizId)}/attempts`, { answers }, { locale }),
  });
}
