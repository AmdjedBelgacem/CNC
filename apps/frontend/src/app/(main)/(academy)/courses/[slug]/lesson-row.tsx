'use client';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Lock, Play, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/auth-store';
import { useMyEnrollments } from '@/hooks/use-learning';
import { formatDuration } from '@/lib/api/normalize';
import { cn } from '@/lib/utils';
import { getImageSrc } from '@/lib/images';
import type { Lesson } from '@/lib/api/types';

export interface LessonRowProps {
  lesson: Lesson;
  courseSlug: string;
  courseId: string;
  /** Position shown beside the title; falls back to nothing when unknown. */
  index?: number;
}

export function LessonRow({ lesson, courseSlug, courseId, index }: LessonRowProps) {
  const t = useTranslations('courses');
  const locale = useLocale();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { enrollments } = useMyEnrollments(isAuthenticated);

  const isEnrolled = enrollments.some((e) => (e.courseId ?? e.course?.id) === courseId);
  const unlocked = !!lesson.freePreview || isEnrolled;

  return (
    <Link
      href={`/courses/${courseSlug}/lessons/${lesson.slug}`}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      className="flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-muted/50 sm:px-5"
    >
      {/* Accurate per-lesson thumbnail, with a play/lock affordance on top. */}
      <div className="relative aspect-video w-20 shrink-0 overflow-hidden rounded-md border border-border bg-surface-sunken sm:w-24">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getImageSrc(lesson.thumbnailUrl, 'lesson')}
          alt=""
          className="size-full object-cover"
          loading="lazy"
        />
        <span className="absolute inset-0 flex items-center justify-center bg-overlay/30">
          {unlocked ? (
            <Play className="size-3.5 text-white" />
          ) : (
            <Lock className="size-3.5 text-white" />
          )}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {typeof index === 'number' && (
            <span className="me-2 tabular-nums text-muted-foreground">{index}.</span>
          )}
          {lesson.title}
        </p>
        {lesson.description && (
          <p className="truncate text-xs text-muted-foreground">{lesson.description}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {lesson.freePreview && <Badge variant="soft">{t('videoPreview')}</Badge>}
        {lesson.contentBlocks?.blocks?.some((block) => block.type === 'quiz') && <Badge variant="soft-muted"><Sparkles className="size-3" /> Quiz</Badge>}
        {!unlocked && <Badge variant="soft-muted">{t('locked')}</Badge>}
        {!!lesson.videoDuration && (
          <span className={cn('text-xs tabular-nums text-muted-foreground')}>
            {formatDuration(lesson.videoDuration)}
          </span>
        )}
      </div>
    </Link>
  );
}
