'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Download,
  ExternalLink,
  Loader2,
  Lock,
  PlayCircle,
} from 'lucide-react';
import type { ContentLocale, QuizAttemptResult } from '@titan/shared';
import { useAuthStore } from '@/stores/auth-store';
import { useCourse, useLesson } from '@/hooks/use-courses';
import { useLessonPlayback, useUpdateLessonProgress } from '@/hooks/use-learning';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { LessonAssistantButton } from '@/components/ai/lesson-assistant-button';
import { LessonBlockRenderer } from '@/components/learning/lesson-block-renderer';
import { ScrollProgress } from '@/components/ui/motion';
import { CinematicVideoPlayer } from '@/components/media/cinematic-player';
import { LanguageAvailability } from '@/components/academy/language-availability';
import { toast } from '@/components/ui/toast';
import { formatDuration } from '@/lib/api/normalize';
import { cn } from '@/lib/utils';
import { getImageSrc } from '@/lib/images';
import { coerceLocale } from '@/i18n/config';
import type { Lesson } from '@/lib/api/types';

export interface LessonPlayerProps {
  lessonSlug: string;
  courseSlug: string;
}

function useSiblingLessons(courseSlug: string, locale: ContentLocale) {
  const { course } = useCourse(courseSlug, locale);
  const lessons = useMemo<Lesson[]>(
    () => (course?.series ?? []).flatMap((series) => series.lessons ?? []),
    [course],
  );
  return { course, lessons };
}

export function LessonPlayer({ lessonSlug, courseSlug }: LessonPlayerProps) {
  const t = useTranslations('lesson');
  const tc = useTranslations('courses');
  const locale = coerceLocale(useLocale());
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [completed, setCompleted] = useState(false);
  const [passedQuizIds, setPassedQuizIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setCompleted(false);
    setPassedQuizIds(new Set());
  }, [lessonSlug]);

  const { course, lessons } = useSiblingLessons(courseSlug, locale);
  const {
    lesson: dedicatedLesson,
    isLoading: lessonLoading,
    isError: lessonError,
    refetch: refetchLesson,
  } = useLesson(courseSlug, lessonSlug, locale);
  const courseLesson = useMemo(
    () => lessons.find((item) => item.slug === lessonSlug) ?? null,
    [lessons, lessonSlug],
  );
  const lesson = dedicatedLesson ?? courseLesson;
  const blocks = lesson?.contentBlocks?.blocks ?? [];
  const videoBlock = blocks.find((block) => block.type === 'video');
  const hasVideoBlock = Boolean(videoBlock);
  const videoContent = videoBlock?.content as
    { posterUrl?: string | null; captionsUrl?: string | null } | undefined;
  const hasVideo = Boolean(videoBlock || lesson?.videoUrl || lesson?.videoMeta);
  const {
    data: playback,
    isLoading: playbackLoading,
    error: playbackErr,
    refetch: refetchPlayback,
  } = useLessonPlayback(courseSlug, lessonSlug, Boolean(lesson && hasVideo), locale);
  const updateProgress = useUpdateLessonProgress();
  const videoUrl =
    playback?.url ??
    playback?.signedUrl ??
    playback?.videoUrl ??
    (lesson?.videoUrl && !lesson.videoUrl.startsWith('tenants/') ? lesson.videoUrl : '');
  const playbackStatus = (playbackErr as (Error & { status?: number }) | null)?.status;
  const gated = playbackStatus === 401 || playbackStatus === 403;
  const requiredQuizIds = blocks
    .filter(
      (block) =>
        block.type === 'quiz' &&
        Boolean((block.content as { requiredToContinue?: boolean }).requiredToContinue),
    )
    .map((block) => block.id);
  const requiredQuizPending = requiredQuizIds.some((id) => !passedQuizIds.has(id));
  const renderBlocks = blocks;

  const index = lessons.findIndex((item) => item.slug === lessonSlug);
  const previous = index > 0 ? lessons[index - 1] : null;
  const next = index >= 0 && index < lessons.length - 1 ? lessons[index + 1] : null;

  const handleQuizResult = (result: QuizAttemptResult, quizId?: string) => {
    if (result.passed && quizId) setPassedQuizIds((current) => new Set(current).add(quizId));
  };

  const markComplete = async () => {
    if (!lesson?.id || requiredQuizPending) return;
    try {
      await updateProgress.mutateAsync({
        lessonId: lesson.id,
        completed: true,
        watchTimeSeconds: Math.floor(videoRef.current?.currentTime ?? 0),
      });
      setCompleted(true);
      toast({ type: 'ok', title: t('completed') });
    } catch {
      toast({ type: 'err', title: t('loadFailed') });
    }
  };

  if (lessonLoading && !courseLesson) {
    return (
      <div className="space-y-4">
        <Skeleton className="aspect-video w-full rounded-xl" />
        <Skeleton className="h-8 w-2/3 rounded-lg" />
        <Skeleton className="h-4 w-1/3 rounded-md" />
      </div>
    );
  }

  if ((lessonError && !courseLesson) || !lesson) {
    return (
      <ErrorState
        title={t('loadFailed')}
        description={lessonError ? tc('noCourses') : undefined}
        onRetry={() => {
          void refetchLesson();
          window.location.reload();
        }}
      />
    );
  }

  const attachments = lesson.attachments ?? [];
  const fallbackContent = lesson.content && renderBlocks.length === 0 ? lesson.content : null;

  return (
    // Reading progress across the lesson. A course lesson is a long scroll —
    // video plus a transcript — and a 2px bar at the very top is the cheapest
    // possible way to answer "how much is left" without adding chrome to every
    // section heading. Driven by the shared scroll timeline, so it stays in step
    // with the compositor rather than trailing it.
    <div className="relative" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <ScrollProgress height={2} />
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {!hasVideoBlock &&
            (videoUrl ? (
              <CinematicVideoPlayer
                key={videoUrl}
                ref={videoRef}
                src={videoUrl}
                poster={lesson.thumbnailUrl ?? videoContent?.posterUrl}
                captionsUrl={videoContent?.captionsUrl}
                locale={locale}
                title={lesson.title}
                variant="lesson"
                onError={() => void refetchPlayback()}
              />
            ) : playbackLoading && hasVideo ? (
              <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-border bg-muted">
                <Loader2 className="size-10 animate-spin text-primary motion-reduce:animate-none" />
                <p className="ms-3 text-sm text-muted-foreground">{t('overview')}…</p>
              </div>
            ) : (
              <div className="relative flex aspect-video w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-border bg-surface-sunken p-6 text-center">
                <img
                  src={getImageSrc(lesson.thumbnailUrl, 'lesson')}
                  alt=""
                  className="absolute inset-0 size-full object-cover opacity-20"
                />
                <div className="blueprint-grid absolute inset-0" aria-hidden />
                <div className="relative">
                  {gated ? (
                    <Lock className="mx-auto size-10 text-primary" />
                  ) : (
                    <PlayCircle className="mx-auto size-10 text-primary" />
                  )}
                  <p className="mt-3 text-base font-semibold text-foreground">
                    {playbackStatus === 401
                      ? 'Please sign in to watch this lesson'
                      : playbackStatus === 403
                        ? tc('enrollToStart')
                        : hasVideo
                          ? t('videoUnavailable')
                          : t('overview')}
                  </p>
                  {gated && (
                    <Button asChild size="sm" className="mt-3">
                      <Link href={playbackStatus === 401 ? '/login' : `/courses/${courseSlug}`}>
                        {playbackStatus === 401 ? 'Sign in' : tc('enroll')}
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            ))}

          <div>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                  {lesson.title}
                </h1>
                <div className="mt-3">
                  <LanguageAvailability
                    availableLocales={lesson.availableLocales ?? course?.availableLocales}
                    resolvedLocale={lesson.resolvedLocale ?? course?.resolvedLocale}
                    fallbackFields={lesson.fallbackFields ?? course?.fallbackFields}
                  />
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <LessonAssistantButton
                  courseId={course?.id ?? ''}
                  lessonId={lesson.id}
                  canAccess={lesson.freePreview || !gated}
                />
                {lesson.videoDuration && (
                  <Badge variant="soft-muted">{formatDuration(lesson.videoDuration)}</Badge>
                )}
                {lesson.freePreview && <Badge variant="soft">{tc('videoPreview')}</Badge>}
              </div>
            </div>
            {lesson.description && (
              <p className="mt-3 leading-relaxed text-muted-foreground">{lesson.description}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => void markComplete()}
              disabled={
                completed || updateProgress.isPending || !isAuthenticated || requiredQuizPending
              }
              variant={completed ? 'secondary' : 'default'}
              loading={updateProgress.isPending && !completed}
            >
              {completed ? <CheckCircle2 className="text-success" /> : <CheckCircle2 />}
              {completed
                ? t('completed')
                : requiredQuizPending
                  ? 'Pass the required quiz to continue'
                  : t('markComplete')}
            </Button>
            <div className="ms-auto flex items-center gap-2">
              {previous && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/courses/${courseSlug}/lessons/${previous.slug}`}>
                    <ChevronLeft className="rtl:rotate-180" />
                    {t('prevLesson')}
                  </Link>
                </Button>
              )}
              {next &&
                (requiredQuizPending ? (
                  <Button size="sm" disabled>
                    Pass the quiz to continue
                  </Button>
                ) : (
                  <Button size="sm" asChild>
                    <Link href={`/courses/${courseSlug}/lessons/${next.slug}`}>
                      {t('nextLesson')}
                      <ArrowRight className="rtl:rotate-180" />
                    </Link>
                  </Button>
                ))}
            </div>
          </div>

          {renderBlocks.length > 0 && (
            <LessonBlockRenderer
              blocks={{ schemaVersion: 1, blocks: renderBlocks }}
              courseSlug={courseSlug}
              lessonSlug={lessonSlug}
              locale={locale}
              videoUrl={videoUrl}
              onQuizResult={handleQuizResult}
              onVideoError={() => void refetchPlayback()}
            />
          )}
          {fallbackContent && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{t('overview')}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {fallbackContent}
                </p>
              </CardContent>
            </Card>
          )}
          {!renderBlocks.length && !fallbackContent && !hasVideo && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  This lesson does not have published content yet.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Download className="size-4 text-primary" />
                {t('resources')}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{t('resourcesDesc')}</p>
            </CardHeader>
            <CardContent className="pt-0">
              {attachments.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">{t('noResources')}</p>
              ) : (
                <ul className="space-y-2">
                  {attachments.map((file) => (
                    <li key={file.id ?? file.url}>
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5 transition-colors hover:bg-muted"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <Download className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {file.name}
                          </span>
                          {typeof file.size === 'number' && (
                            <span className="block text-2xs text-muted-foreground">
                              {(file.size / 1024).toFixed(0)} KB
                            </span>
                          )}
                        </span>
                        <Badge variant="outline" className="shrink-0 text-2xs">
                          {file.type}
                        </Badge>
                        <ExternalLink className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {lessons.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{tc('curriculum')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 pt-0">
                {lessons.map((item, itemIndex) => {
                  const active = item.slug === lessonSlug;
                  return (
                    <Link
                      key={item.id}
                      href={`/courses/${courseSlug}/lessons/${item.slug}`}
                      className={cn(
                        'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
                        active
                          ? 'bg-primary/10 font-medium text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <span className="w-5 shrink-0 tabular-nums text-xs">{itemIndex + 1}</span>
                      <span className="min-w-0 flex-1 truncate">{item.title}</span>
                      {item.freePreview && (
                        <Badge variant="soft" className="shrink-0 text-[10px]">
                          Preview
                        </Badge>
                      )}
                      {!!item.videoDuration && (
                        <span className="shrink-0 text-2xs tabular-nums opacity-70">
                          {formatDuration(item.videoDuration)}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          )}

          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link href={`/courses/${courseSlug}`}>
              <ArrowLeft className="rtl:rotate-180" />
              {tc('overview')}
            </Link>
          </Button>
        </aside>
      </div>
    </div>
  );
}
