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
  Lock,
  PlayCircle,
} from 'lucide-react';
import type { ContentLocale, QuizAttemptResult } from '@titan/shared';
import { useAuthStore } from '@/stores/auth-store';
import { useCourse, useLesson } from '@/hooks/use-courses';
import { useLessonPlayback, useUpdateLessonProgress } from '@/hooks/use-learning';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonRegion } from '@/components/ui/skeletons/region';
import { LessonPlayerBodySkeleton } from '@/components/skeletons/public-route-skeletons';
import { ErrorState } from '@/components/ui/states';
import { LessonAssistantButton } from '@/components/ai/lesson-assistant-button';
import { LessonBlockRenderer } from '@/components/learning/lesson-block-renderer';
import { Reveal, ScrollProgress, Stagger, StaggerItem } from '@/components/ui/motion';
import { AnimatePresence, m } from 'framer-motion';
import { spring } from '@/lib/motion';
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
  const tp = useTranslations('pages.lessonPlayer');
  const tCommon = useTranslations('common');
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
      <SkeletonRegion>
        <LessonPlayerBodySkeleton />
      </SkeletonRegion>
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
  // Where this lesson sits in the course, for the progress rail. Unknown (-1)
  // reads as the start rather than hiding the rail.
  const position = Math.max(0, index);
  const coursePercent = lessons.length > 1 ? (position / (lessons.length - 1)) * 100 : 100;

  return (
    // Reading progress across the lesson. A course lesson is a long scroll —
    // video plus a transcript — and a 2px bar at the very top is the cheapest
    // possible way to answer "how much is left" without adding chrome to every
    // section heading. Driven by the shared scroll timeline, so it stays in step
    // with the compositor rather than trailing it.
    <div className="relative" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <ScrollProgress height={2} />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_19rem] xl:gap-14">
        <div className="min-w-0 space-y-8">
          {!hasVideoBlock &&
            (videoUrl ? (
              <div className="overflow-hidden rounded-2xl shadow-lg">
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
              </div>
            ) : playbackLoading && hasVideo ? (
              // The player's own frame, waiting for the signed playback URL.
              <div role="status" aria-busy="true">
                <span className="sr-only">{tCommon('loading')}</span>
                <Skeleton className="aspect-video w-full rounded-2xl border border-border/70" />
              </div>
            ) : (
              <div className="relative flex aspect-video w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-border/70 bg-surface-sunken p-6 text-center">
                {/* Only a real thumbnail is washed in behind the prompt; the generic
                    placeholder art carries its own play glyph and darkens the panel. */}
                {lesson.thumbnailUrl && (
                  <img
                    src={getImageSrc(lesson.thumbnailUrl, 'lesson')}
                    alt=""
                    className="absolute inset-0 size-full object-cover opacity-[0.12] blur-[1px]"
                  />
                )}
                <div className="blueprint-grid absolute inset-0" aria-hidden />
                <m.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.32, 0.72, 0, 1] } }}
                  className="relative flex flex-col items-center"
                >
                  <span className="flex size-14 items-center justify-center rounded-full bg-card text-primary shadow-md ring-1 ring-border/70">
                    {gated ? <Lock className="size-6" /> : <PlayCircle className="size-6" />}
                  </span>
                  <p className="mt-4 max-w-sm text-balance font-display text-xl font-medium text-foreground">
                    {playbackStatus === 401
                      ? tp('signInToWatch')
                      : playbackStatus === 403
                        ? tc('enrollToStart')
                        : hasVideo
                          ? t('videoUnavailable')
                          : t('overview')}
                  </p>
                  {gated && (
                    <Button asChild size="sm" className="mt-4 rounded-full px-5">
                      <Link href={playbackStatus === 401 ? '/login' : `/courses/${courseSlug}`}>
                        {playbackStatus === 401 ? tCommon('signIn') : tc('enroll')}
                      </Link>
                    </Button>
                  )}
                </m.div>
              </div>
            ))}

          <header className="mx-auto max-w-3xl">
            {lessons.length > 0 && index >= 0 && (
              <p className="eyebrow mb-3">
                {tc('curriculum')} · <span className="tabular-nums">{index + 1} / {lessons.length}</span>
              </p>
            )}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h1 className="text-balance font-display text-3xl font-medium leading-tight tracking-[-0.02em] text-foreground sm:text-4xl">
                  {lesson.title}
                </h1>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 pt-1">
                {lesson.videoDuration && (
                  <Badge variant="soft-muted">{formatDuration(lesson.videoDuration)}</Badge>
                )}
                {lesson.freePreview && <Badge variant="soft">{tc('videoPreview')}</Badge>}
              </div>
            </div>
            {lesson.description && (
              <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">{lesson.description}</p>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <LessonAssistantButton
                courseId={course?.id ?? ''}
                lessonId={lesson.id}
                canAccess={lesson.freePreview || !gated}
              />
              <LanguageAvailability
                availableLocales={lesson.availableLocales ?? course?.availableLocales}
                resolvedLocale={lesson.resolvedLocale ?? course?.resolvedLocale}
                fallbackFields={lesson.fallbackFields ?? course?.fallbackFields}
              />
            </div>
          </header>

          <div className="mx-auto max-w-3xl space-y-8">
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
              <Reveal>
                <p className="whitespace-pre-line text-base leading-8 text-foreground/85">
                  {fallbackContent}
                </p>
              </Reveal>
            )}
            {!renderBlocks.length && !fallbackContent && !hasVideo && (
              <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center">
                <p className="text-sm text-muted-foreground">{tp('noPublishedContent')}</p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-xs">
              <Button
                onClick={() => void markComplete()}
                disabled={
                  completed || updateProgress.isPending || !isAuthenticated || requiredQuizPending
                }
                variant={completed ? 'secondary' : 'default'}
                loading={updateProgress.isPending && !completed}
                className="rounded-full"
              >
                <AnimatePresence initial={false} mode="popLayout">
                  <m.span
                    key={completed ? 'done' : 'todo'}
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1, transition: spring.snappy }}
                    exit={{ scale: 0.4, opacity: 0, transition: { duration: 0.1 } }}
                    className="flex"
                  >
                    <CheckCircle2 className={completed ? 'text-success' : undefined} />
                  </m.span>
                </AnimatePresence>
                {completed
                  ? t('completed')
                  : requiredQuizPending
                    ? tp('passQuizRequired')
                    : t('markComplete')}
              </Button>
              <div className="ms-auto flex items-center gap-2">
                {previous && (
                  <Button variant="ghost" size="sm" className="rounded-full" asChild>
                    <Link href={`/courses/${courseSlug}/lessons/${previous.slug}`}>
                      <ChevronLeft className="rtl:rotate-180" />
                      {t('prevLesson')}
                    </Link>
                  </Button>
                )}
                {next &&
                  (requiredQuizPending ? (
                    <Button size="sm" variant="outline" className="rounded-full" disabled>
                      {tp('passQuizToContinue')}
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="group rounded-full" asChild>
                      <Link href={`/courses/${courseSlug}/lessons/${next.slug}`}>
                        {t('nextLesson')}
                        <ArrowRight className="transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
                      </Link>
                    </Button>
                  ))}
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-y-auto lg:pb-6">
          {lessons.length > 0 && (
            <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-xs">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-lg font-medium text-foreground">{tc('curriculum')}</h2>
                {index >= 0 && (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {index + 1} / {lessons.length}
                  </span>
                )}
              </div>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
                <m.div
                  className="h-full origin-left rounded-full bg-primary rtl:origin-right"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: coursePercent / 100 }}
                  transition={spring.gentle}
                />
              </div>
              {/* The rail: a hairline spine with a clay fill that grows to the
                  current lesson, one node per lesson. */}
              <ol className="relative mt-4">
                <span
                  className="pointer-events-none absolute bottom-4 start-[0.9375rem] top-4 w-px bg-border"
                  aria-hidden
                />
                <m.span
                  className="pointer-events-none absolute start-[0.9375rem] top-4 w-px origin-top bg-primary"
                  style={{ height: 'calc(100% - 2rem)' }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: lessons.length > 1 ? position / (lessons.length - 1) : 0 }}
                  transition={spring.gentle}
                  aria-hidden
                />
                {lessons.map((item, itemIndex) => {
                  const active = item.slug === lessonSlug;
                  const passed = index >= 0 && itemIndex < index;
                  return (
                    <li key={item.id} className="relative">
                      <Link
                        href={`/courses/${courseSlug}/lessons/${item.slug}`}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'relative flex items-center gap-3 rounded-lg py-2 pe-2 ps-1 text-sm transition-colors',
                          active ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {active && (
                          <m.span
                            layoutId="lesson-rail-active"
                            transition={spring.smooth}
                            className="absolute inset-0 rounded-lg bg-muted"
                            aria-hidden
                          />
                        )}
                        <span
                          className={cn(
                            'relative z-10 flex size-[1.875rem] shrink-0 items-center justify-center rounded-full border text-2xs tabular-nums transition-colors',
                            active
                              ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                              : passed
                                ? 'border-primary/40 bg-card text-primary'
                                : 'border-border bg-card text-muted-foreground',
                          )}
                        >
                          {itemIndex + 1}
                        </span>
                        <span className="relative min-w-0 flex-1 truncate">{item.title}</span>
                        {item.freePreview && (
                          <Badge variant="soft" className="relative shrink-0 text-[10px]">
                            {tc('videoPreview')}
                          </Badge>
                        )}
                        {!!item.videoDuration && (
                          <span className="relative shrink-0 text-2xs tabular-nums opacity-70">
                            {formatDuration(item.videoDuration)}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-xs">
            <h2 className="flex items-center gap-2 font-display text-lg font-medium text-foreground">
              <Download className="size-4 text-primary" />
              {t('resources')}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{t('resourcesDesc')}</p>
            {attachments.length === 0 ? (
              <p className="mt-3 rounded-lg bg-muted/50 py-4 text-center text-xs text-muted-foreground">{t('noResources')}</p>
            ) : (
              <Stagger as="ul" className="mt-4 space-y-2">
                {attachments.map((file, fileIndex) => (
                  <StaggerItem as="li" index={fileIndex} key={file.id ?? file.url}>
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-3 rounded-lg border border-border/70 bg-card px-3 py-2.5 transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-sm"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Download className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {file.name}
                        </span>
                        {typeof file.size === 'number' && (
                          <span className="block text-2xs tabular-nums text-muted-foreground">
                            {(file.size / 1024).toFixed(0)} KB
                          </span>
                        )}
                      </span>
                      <Badge variant="outline" className="shrink-0 text-2xs">
                        {file.type}
                      </Badge>
                      <ExternalLink className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </a>
                  </StaggerItem>
                ))}
              </Stagger>
            )}
          </section>

          <Button variant="ghost" size="sm" className="w-full rounded-full" asChild>
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
