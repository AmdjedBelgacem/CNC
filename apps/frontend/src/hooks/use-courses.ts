'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
export function useCourses() {
  return useQuery({ queryKey: ['courses'], queryFn: () => api.get('/courses') });
}
export function useCourse(slug: string) {
  return useQuery({ queryKey: ['course', slug], queryFn: () => api.get(`/courses/${slug}`) });
}
export function useLesson(slug: string) {
  return useQuery({
    queryKey: ['lesson', slug],
    queryFn: () => api.get(`/courses/lessons/${slug}`),
  });
}
