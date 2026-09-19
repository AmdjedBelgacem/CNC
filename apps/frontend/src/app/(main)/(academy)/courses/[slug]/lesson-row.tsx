'use client';
import Link from 'next/link';
import { Play, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/auth-store';
import { useQuery } from '@tanstack/react-query';
interface LessonRowProps {
  lesson: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    thumbnailUrl?: string | null;
    videoDuration: number | null;
    freePreview: boolean;
  };
  courseSlug: string;
  courseId: string;
}
function formatDuration(seconds: number | null): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
export function LessonRow({ lesson, courseSlug, courseId }: LessonRowProps) {
  const { isAuthenticated, hydrated } = useAuthStore();
  const { data: enrollments } = useQuery({
    queryKey: ['my-enrollments'],
    queryFn: async () => {
      const res = await fetch('/api/proxy/courses/enrollments/mine', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && hydrated,
    staleTime: 30_000,
  });
  const isEnrolled = Array.isArray(enrollments)
    ? enrollments.some((e: any) => (e.courseId || e.course?.id) === courseId)
    : false;
  const unlocked = lesson.freePreview || isEnrolled;
  return (
    <Link
      href={`/courses/${courseSlug}/lessons/${lesson.slug}`}
      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/50"
    >
      {' '}
      {lesson.thumbnailUrl ? (
        <div className="relative h-10 w-16 shrink-0 overflow-hidden rounded-md border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lesson.thumbnailUrl} alt="" className="h-full w-full object-cover" />
          <span className="absolute inset-0 flex items-center justify-center bg-black/25">
            {unlocked ? (
              <Play className="h-3.5 w-3.5 text-white" />
            ) : (
              <Lock className="h-3.5 w-3.5 text-white" />
            )}
          </span>
        </div>
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
          {' '}
          {unlocked ? (
            <Play className="h-3.5 w-3.5 text-primary" />
          ) : (
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          )}{' '}
        </div>
      )}{' '}
      <div className="flex-1 min-w-0">
        {' '}
        <p className="text-sm font-medium truncate">{lesson.title}</p>{' '}
        {lesson.description && (
          <p className="text-xs text-muted-foreground truncate">{lesson.description}</p>
        )}{' '}
      </div>{' '}
      <div className="flex items-center gap-2 shrink-0">
        {' '}
        {lesson.freePreview && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            Free
          </Badge>
        )}{' '}
        {!unlocked && !lesson.freePreview && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            Enrolled only
          </Badge>
        )}{' '}
        {lesson.videoDuration && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {' '}
            {formatDuration(lesson.videoDuration)}{' '}
          </span>
        )}{' '}
      </div>{' '}
    </Link>
  );
}
