'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Award, BookOpen, CheckCircle2, Clock, Flame, PlayCircle, Trophy } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useMyEnrollments } from '@/hooks/use-learning';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SkeletonRegion } from '@/components/ui/skeletons/region';
import { LearningContentSkeleton } from '@/components/skeletons/public-route-skeletons';
import { Progress, ProgressRing } from '@/components/ui/progress';
import { AnimatedNumber, Reveal, Stagger, StaggerItem } from '@/components/ui/motion';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { getImageSrc } from '@/lib/images';
import type { Enrollment } from '@/lib/api/types';

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof BookOpen;
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <Card className="h-full rounded-xl border-border/70 shadow-xs">
      <CardContent className="flex flex-col gap-4 p-5">
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground',
            tone,
          )}
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-3xl font-medium leading-none tracking-[-0.02em] text-foreground">
            {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
          </p>
          <p className="mt-2 truncate text-xs font-medium text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/** Pick the lesson the learner should resume: first incomplete, else the first. */
function nextLessonHref(enrollment: Enrollment): string {
  const course = enrollment.course;
  const slug = course?.slug;
  if (!slug) return '/courses';
  const lessons = course?.series?.flatMap((s) => (s.lessons ?? []).map((l) => l.slug)) ?? [];
  return lessons.length > 0 ? `/courses/${slug}/lessons/${lessons[0]}` : `/courses/${slug}`;
}

export default function LearningPage() {
  const t = useTranslations('learning');
  const tc = useTranslations('common');
  const locale = useLocale();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { enrollments, isLoading, isError, error, refetch } = useMyEnrollments(isAuthenticated);

  const stats = useMemo(() => {
    const total = enrollments.length;
    const completed = enrollments.filter((e) => (e.progress ?? 0) >= 100 || e.completed).length;
    const inProgress = total - completed;
    const hours = enrollments.reduce((sum, e) => sum + (e.course?.estimatedHours ?? 0), 0);
    return { total, completed, inProgress, hours };
  }, [enrollments]);

  const continueWith = useMemo(
    () =>
      enrollments.find((e) => (e.progress ?? 0) < 100 && !e.completed) ?? enrollments[0] ?? null,
    [enrollments],
  );

  if (!isAuthenticated) {
    // No heading in this branch, so a signed-out visitor got a page with no title structure.
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="sr-only">{t('title')}</h1>
        <EmptyState
          icon={BookOpen}
          title={t('empty')}
          description={t('emptyHint')}
          action={
            <Button asChild>
              <Link href="/courses">{t('browseCourses')}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
      <header className="mb-10 border-b border-border/70 pb-8">
        <h1 className="font-display text-4xl font-medium tracking-[-0.022em] text-foreground sm:text-5xl">
          {t('title')}
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground">{t('subtitle')}</p>
      </header>

      {isLoading ? (
        <SkeletonRegion>
          <LearningContentSkeleton />
        </SkeletonRegion>
      ) : isError ? (
        <ErrorState
          title={t('loadFailed')}
          description={(error as Error)?.message}
          onRetry={() => void refetch()}
        />
      ) : enrollments.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={t('empty')}
          description={t('emptyHint')}
          action={
            <Button asChild>
              <Link href="/courses">{t('browseCourses')}</Link>
            </Button>
          }
        />
      ) : (
        <>
          {/* The KPI row cascades first, then the continue card, then the
              course grid — so the page resolves top-to-bottom in reading order
              rather than all at once. */}
          <Stagger
            className="mb-10 grid grid-cols-2 gap-3 lg:grid-cols-4"
            gap={0.05}
            maxDelay={0.24}
          >
            <StaggerItem index={0}>
              <StatCard icon={Flame} label={t('inProgress')} value={stats.inProgress} />
            </StaggerItem>
            <StaggerItem index={1}>
              <StatCard
                icon={CheckCircle2}
                label={t('completedCourses')}
                value={stats.completed}
                tone="bg-success/10 text-success"
              />
            </StaggerItem>
            <StaggerItem index={2}>
              <StatCard icon={Clock} label={t('hoursLearned')} value={stats.hours} />
            </StaggerItem>
            <StaggerItem index={3}>
              <StatCard
                icon={Trophy}
                label={t('certificates')}
                value={stats.completed}
                tone="bg-primary/10 text-primary"
              />
            </StaggerItem>
          </Stagger>

          {continueWith && (
            <Reveal className="mb-12">
            <Card className="card-hover relative overflow-hidden rounded-2xl border-border/70 bg-card shadow-sm hover:shadow-lg">
              <div className="ambient-wash pointer-events-none absolute inset-0" aria-hidden />
              <CardContent className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:p-7">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
                  <PlayCircle className="size-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="eyebrow">{t('continue')}</p>
                  <h2 className="mt-1.5 truncate font-display text-2xl font-medium tracking-[-0.015em] text-foreground">
                    {continueWith.course?.title ?? 'Course'}
                  </h2>
                  <div className="mt-2 flex items-center gap-3">
                    <Progress
                      value={continueWith.progress ?? 0}
                      className="h-1.5 max-w-xs"
                      label={t('continue')}
                    />
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {Math.round(continueWith.progress ?? 0)}%
                    </span>
                  </div>
                </div>
                <Button asChild className="shrink-0 rounded-full px-6">
                  <Link href={nextLessonHref(continueWith)}>
                    <PlayCircle />
                    {t('continue')}
                  </Link>
                </Button>
              </CardContent>
            </Card>
            </Reveal>
          )}

          <h2 className="mb-5 flex items-baseline gap-2 font-display text-2xl font-medium tracking-[-0.015em] text-foreground">
            {tc('all')} <span className="font-sans text-sm font-normal tabular-nums text-muted-foreground">({stats.total})</span>
          </h2>
          <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" gap={0.04} maxDelay={0.3}>
            {enrollments.map((enrollment, i) => {
              const course = enrollment.course;
              const pct = enrollment.progress ?? 0;
              const done = pct >= 100 || enrollment.completed;
              return (
                <StaggerItem as="div" key={enrollment.id} index={i}>
                  <Card className="card-hover group h-full overflow-hidden rounded-2xl border-border/70 shadow-xs transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-lg">
                    <Link href={`/courses/${course?.slug ?? ''}`} className="block">
                      <div className="relative m-2 mb-0 aspect-video overflow-hidden rounded-xl bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={getImageSrc(course?.thumbnailUrl, 'course')}
                          alt={course?.title ?? ''}
                          className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                          loading="lazy"
                        />
                        {done && (
                          <span className="absolute end-2 top-2 inline-flex items-center gap-1 rounded-full bg-card/90 px-2.5 py-1 text-2xs font-medium text-success shadow-sm backdrop-blur">
                            <Award className="size-3.5" />
                            {t('completedCourses')}
                          </span>
                        )}
                      </div>
                    </Link>

                    <CardContent className="p-5">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/courses/${course?.slug ?? ''}`}
                            className="line-clamp-2 font-display text-lg font-medium leading-snug text-foreground transition-colors hover:text-primary"
                          >
                            {course?.title ?? 'Course'}
                          </Link>
                          {enrollment.enrolledAt && (
                            <p className="mt-1 text-2xs text-muted-foreground">
                              {t('enrolledOn', { date: formatDate(enrollment.enrolledAt, locale) })}
                            </p>
                          )}
                        </div>
                        <ProgressRing value={pct} size={44} />
                      </div>

                      <div className="mt-3">
                        <Progress value={pct} label={`${course?.title ?? ''} progress`} />
                      </div>

                      <Button asChild variant="outline" size="sm" className="mt-4 w-full rounded-full">
                        <Link href={nextLessonHref(enrollment)}>
                          <PlayCircle />
                          {done ? tc('start') : t('continue')}
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                </StaggerItem>
              );
            })}
          </Stagger>
        </>
      )}
    </div>
  );
}
