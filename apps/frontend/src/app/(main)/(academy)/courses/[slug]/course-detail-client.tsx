'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Check,
  ChevronDown,
  Clock,
  Compass,
  FileDown,
  Gauge,
  Layers3,
  PlayCircle,
  Sparkles,
  Target,
  type LucideIcon,
} from 'lucide-react';
import { getImageSrc } from '@/lib/images';
import { useCourse } from '@/hooks/use-courses';
import type { Course } from '@/lib/api/types';
import { DifficultyBar } from '@/components/academy/difficulty-bar';
import { CourseProductsSidebar } from '@/components/store/course-products-sidebar';
import { LiveSessionsSection } from '@/components/academy/live-sessions-section';
import { CinematicVideoPlayer } from '@/components/media/cinematic-player';
import { EnrollButton } from './enroll-button';
import { ProgressSection } from './progress-section';
import { LessonRow } from './lesson-row';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { LanguageAvailability } from '@/components/academy/language-availability';
import { coerceLocale } from '@/i18n/config';
import { formatDuration, formatMoney } from '@/lib/api/normalize';
import { AnimatedNumber, Reveal, Stagger, StaggerItem } from '@/components/ui/motion';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}

function StatTile({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
}) {
  const numeric = /^\d+$/.test(value) ? Number(value) : null;
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border/70 bg-card p-5 shadow-xs">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-[18px]" />
      </div>
      <div className="min-w-0">
        <p className="font-display text-2xl font-medium leading-none tracking-[-0.02em] text-foreground">
          {numeric !== null ? <AnimatedNumber value={numeric} /> : value}
        </p>
        <p className="mt-1.5 truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function HeroStat({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="flex items-baseline gap-1.5">
        <span className="text-sm font-medium text-foreground">{value}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

/** One collapsible series in the curriculum; the body height springs open. */
function CurriculumSeries({
  index,
  title,
  summary,
  countLabel,
  defaultOpen,
  children,
}: {
  index: number;
  title: string;
  summary: string;
  countLabel: string;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border bg-card transition-[border-color,box-shadow] duration-300',
        open ? 'border-border shadow-sm' : 'border-border/70 shadow-xs hover:border-border-strong',
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-4 px-4 py-4 text-start transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5"
      >
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-full font-display text-base font-medium tabular-nums transition-colors',
            open ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
          )}
        >
          {index}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-lg font-medium tracking-[-0.012em] text-foreground">
            {title}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{summary}</span>
        </span>
        <span className="hidden text-xs text-muted-foreground sm:inline">{countLabel}</span>
        <m.span animate={{ rotate: open ? 180 : 0 }} transition={spring.smooth} className="flex text-muted-foreground">
          <ChevronDown className="size-4" />
        </m.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            id={panelId}
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1, transition: { height: spring.layout, opacity: { duration: 0.2 } } }}
            exit={{ height: 0, opacity: 0, transition: { height: { duration: 0.22, ease: [0.4, 0, 1, 1] }, opacity: { duration: 0.12 } } }}
            className="overflow-hidden"
          >
            <div className="divide-y divide-border/50 border-t border-border/60">{children}</div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CoursePageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/70">
        <div className="container mx-auto space-y-6 px-4 py-10 sm:px-6 lg:px-8">
          <Skeleton className="h-4 w-32" />
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)] lg:items-center">
            <div className="space-y-5">
              <Skeleton className="h-5 w-40 rounded-full" />
              <Skeleton className="h-16 w-4/5" />
              <Skeleton className="h-6 w-3/5" />
              <div className="flex gap-5">
                <Skeleton className="h-8 w-28 rounded-full" />
                <Skeleton className="h-8 w-28 rounded-full" />
              </div>
            </div>
            <Skeleton className="aspect-video w-full rounded-2xl" />
          </div>
        </div>
      </div>
      <div className="container mx-auto space-y-10 px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}

export interface CourseDetailClientProps {
  /** Fetched on the server so the first HTML contains real course content. */
  initialCourse?: Course | null;
}

/**
 * Client half of the course page.
 *
 * The server component owns data fetching and metadata; this owns interactivity
 * (enrol, progress, product sidebar). When `initialCourse` is present the query is
 * seeded with it, so there is no loading state and no client refetch on first paint.
 */
export default function CourseDetailClient({ initialCourse }: CourseDetailClientProps) {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
  const t = useTranslations('courses');
  const locale = coerceLocale(useLocale());
  const { course, isLoading, isError, error, refetch } = useCourse(slug, locale, initialCourse);

  // Only skeleton when there is genuinely nothing to show yet.
  if (isLoading && !course) return <CoursePageSkeleton />;

  if (isError || !course) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <ErrorState
          title={t('loadFailed')}
          description={(error as Error)?.message}
          onRetry={() => void refetch()}
        />
        <div className="mt-6 text-center">
          <Button variant="outline" asChild>
            <Link href="/courses">{t('title')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const series = course.series ?? [];
  const lessons = series.flatMap((item) => item.lessons ?? []);
  const lessonCount = lessons.length;
  const totalSeconds = lessons.reduce((sum, lesson) => sum + (lesson.videoDuration ?? 0), 0);
  const previewCount = lessons.filter((lesson) => lesson.freePreview).length;
  const quizCount = lessons.filter((lesson) => lesson.contentBlocks?.blocks?.some((block) => block.type === 'quiz')).length;
  const resourceCount = lessons.reduce((sum, lesson) => sum + (lesson.attachments?.length ?? 0), 0);
  const difficulty = Math.min(5, Math.max(1, course.difficulty ?? 1));
  const difficultyLabel = difficulty <= 1 ? t('beginner') : difficulty === 2 ? t('intermediate') : t('advanced');
  const durationLabel = course.estimatedHours
    ? t('hoursCount', { count: course.estimatedHours })
    : totalSeconds > 0
      ? formatDuration(totalSeconds)
      : t('selfPaced');
  const isFree = course.priceCents === 0 || course.accessMode === 'free' || course.accessMode === 'open';
  const priceLabel = typeof course.priceCents === 'number' && course.priceCents > 0
    ? formatMoney(course.priceCents, course.currency || 'SAR', locale)
    : null;
  const accessLabel = course.accessMode === 'invite'
    ? t('inviteOnly')
    : isFree
      ? t('freeAccess')
      : t('courseAccess');
  const requirement = difficulty <= 2
    ? t('beginnerRequirement')
    : difficulty <= 4
      ? t('intermediateRequirement')
      : t('advancedRequirement');
  const courseDescription = course.description || course.subtitle || t('courseOverview');
  const academy = course.academy;
  const trailerUrl = course.trailerUrl && !course.trailerUrl.startsWith('tenants/') ? course.trailerUrl : null;

  return (
    <div dir={locale === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-background">
      <section className="relative isolate overflow-hidden border-b border-border/70">
        <div className="ambient-wash absolute inset-0 -z-20" aria-hidden />
        <div className="blueprint-grid absolute inset-0 -z-10 opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" aria-hidden />

        <div className="container relative mx-auto px-4 pt-6 sm:px-6 lg:px-8">
          <Link
            href="/courses"
            className="group inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5 rtl:rotate-180 rtl:group-hover:translate-x-0.5" />
            {t('title')}
          </Link>
        </div>

        <div className="container relative mx-auto grid gap-12 px-4 pb-14 pt-10 sm:px-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(26rem,1.05fr)] lg:items-center lg:gap-14 lg:px-8 lg:pb-20 lg:pt-14">
          <div className="min-w-0">
            <div className="mb-6 flex flex-wrap items-center gap-3">
              {academy ? (
                <Link
                  href={`/academy/${academy.slug}`}
                  className="group inline-flex max-w-full items-center gap-2 rounded-full border border-border/70 bg-card py-1 pe-3 ps-1 text-xs text-muted-foreground shadow-xs transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-sm"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={getImageSrc(academy.logoUrl, 'academy')} alt="" className="size-full object-cover" />
                  </span>
                  <span className="truncate">{t('academyLabel')} · <strong className="font-medium text-foreground">{academy.title}</strong></span>
                  <ArrowRight className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                </Link>
              ) : (
                <span className="eyebrow">{t('coursePath')}</span>
              )}
              <span className="font-mono text-xs text-muted-foreground/70">{course.slug}</span>
            </div>

            <h1 className="max-w-4xl text-balance font-display text-4xl font-medium leading-[1.05] tracking-[-0.022em] text-foreground sm:text-5xl lg:text-6xl">
              {course.title}
            </h1>
            {course.subtitle ? (
              <p className="mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
                {course.subtitle}
              </p>
            ) : null}

            <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3 border-y border-border/70 py-4">
              <HeroStat icon={Clock} value={durationLabel} label={t('duration')} />
              <HeroStat icon={PlayCircle} value={t('lessonsCount', { count: lessonCount })} label="" />
              <HeroStat icon={Gauge} value={difficultyLabel} label={t('level')} />
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <div className="w-full sm:w-64">
                <EnrollButton
                  courseId={course.id}
                  courseSlug={slug}
                  className="h-12 rounded-full"
                  isFree={isFree}
                  priceCents={course.priceCents ?? 0}
                  currency={course.currency || 'SAR'}
                />
              </div>
              <Button variant="outline" size="lg" asChild className="h-12 rounded-full">
                <Link href="#curriculum">
                  {t('curriculum')}
                  <ArrowRight className="rtl:rotate-180" />
                </Link>
              </Button>
            </div>

            <div className="mt-6">
              <LanguageAvailability
                availableLocales={course.availableLocales}
                resolvedLocale={course.resolvedLocale}
                fallbackFields={course.fallbackFields}
              />
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-2xl animate-fade-in-up lg:max-w-none">
            {trailerUrl ? (
              <CinematicVideoPlayer
                src={trailerUrl}
                poster={getImageSrc(course.thumbnailUrl, 'course')}
                title={course.title}
                variant="trailer"
                className="w-full"
              />
            ) : (
              <div className="relative aspect-video overflow-hidden rounded-2xl border border-border/70 bg-surface-sunken shadow-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getImageSrc(course.thumbnailUrl, 'course')}
                  alt={course.title}
                  className="size-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/40 via-transparent to-transparent" />
                <Badge variant="soft" className="absolute bottom-5 start-5 border-white/15 bg-black/30 text-white backdrop-blur-sm">
                  <PlayCircle className="size-3" />
                  {t('videoPreview')}
                </Badge>
              </div>
            )}
            <div className="mt-3 flex items-center justify-between px-1 text-xs text-muted-foreground">
              <span>{t('courseVisual')}</span>
              <span className="inline-flex items-center gap-1.5">
                <span className={cn('size-1.5 rounded-full', course.isPublished ? 'bg-success' : 'bg-warning')} aria-hidden />
                {course.isPublished ? t('publishedPath') : t('videoPreview')}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section id="overview" className="container mx-auto scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16">
          <Reveal className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <SectionEyebrow>{t('courseOverview')}</SectionEyebrow>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {t('whatYouPractice')}
              </span>
            </div>
            <h2 className="mt-4 max-w-3xl text-balance font-display text-3xl font-medium leading-tight tracking-[-0.02em] text-foreground sm:text-4xl">
              {course.subtitle || course.title}
            </h2>
            <p className="mt-5 max-w-prose whitespace-pre-line text-base leading-8 text-muted-foreground sm:text-lg">
              {courseDescription}
            </p>

            <Stagger inViewOnly className="mt-10 grid gap-3 sm:grid-cols-3">
              <StaggerItem index={0}>
                <StatTile icon={Layers3} value={String(series.length)} label={t('coursePath')} />
              </StaggerItem>
              <StaggerItem index={1}>
                <StatTile icon={PlayCircle} value={String(lessonCount)} label={t('lessons')} />
              </StaggerItem>
              <StaggerItem index={2}>
                <StatTile icon={FileDown} value={String(resourceCount)} label={t('courseMaterials')} />
              </StaggerItem>
            </Stagger>
          </Reveal>

          <Reveal delay={0.08} className="h-fit lg:sticky lg:top-24">
            <Card className="overflow-hidden rounded-2xl border-border/70 shadow-sm">
              <div className="border-b border-border/60 bg-muted/40 px-6 py-5">
                <SectionEyebrow>{t('courseBrief')}</SectionEyebrow>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <p className="font-display text-3xl font-medium tracking-[-0.02em] text-foreground">
                    {priceLabel || accessLabel}
                  </p>
                  {priceLabel ? <Badge variant="soft">{accessLabel}</Badge> : null}
                </div>
              </div>
              <CardContent className="space-y-4 p-6">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>{t('level')}</span>
                    <span className="font-medium text-foreground">{difficultyLabel}</span>
                  </div>
                  <DifficultyBar level={difficulty} size="sm" showLabel={false} />
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-4 text-sm">
                  <span className="inline-flex items-center gap-2 text-muted-foreground"><Clock className="size-4" />{t('duration')}</span>
                  <span className="font-medium text-foreground">{durationLabel}</span>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-4 text-sm">
                  <span className="inline-flex items-center gap-2 text-muted-foreground"><BookOpen className="size-4" />{t('lessons')}</span>
                  <span className="font-medium tabular-nums text-foreground">{lessonCount}</span>
                </div>
                {academy ? (
                  <Link
                    href={`/academy/${academy.slug}`}
                    className="group flex items-center gap-3 border-t border-border/60 pt-4"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={getImageSrc(academy.logoUrl, 'academy')} alt="" className="size-full object-cover" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs text-muted-foreground">{t('academyLabel')}</span>
                      <span className="block truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">{academy.title}</span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                  </Link>
                ) : null}
              </CardContent>
            </Card>
          </Reveal>
        </div>
      </section>

      <section id="curriculum" className="scroll-mt-24 border-y border-border/70 bg-muted/30">
        <div className="container mx-auto px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <Reveal className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <SectionEyebrow>{t('curriculum')}</SectionEyebrow>
              <h2 className="mt-3 font-display text-3xl font-medium tracking-[-0.02em] text-foreground sm:text-4xl">
                {t('coursePath')}
              </h2>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <span className="font-medium tabular-nums text-foreground">{series.length}</span>
              <span>{t('coursePath')}</span>
              <span className="size-1 rounded-full bg-primary" />
              <span className="font-medium tabular-nums text-foreground">{lessonCount}</span>
              <span>{t('lessons')}</span>
            </div>
          </Reveal>

          <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12">
            <div className="min-w-0">
              {series.length === 0 ? (
                <Card className="rounded-xl border-border/70">
                  <EmptyState compact icon={Compass} title={t('noCourses')} />
                </Card>
              ) : (
                <Stagger inViewOnly className="space-y-3">
                  {series.map((item, seriesIndex) => {
                    const itemLessons = item.lessons ?? [];
                    const lessonOffset = series.slice(0, seriesIndex).reduce((sum, entry) => sum + (entry.lessons?.length ?? 0), 0);
                    return (
                      <StaggerItem key={item.id} index={seriesIndex}>
                        <CurriculumSeries
                          index={seriesIndex + 1}
                          title={item.title}
                          summary={item.description || t('lessonsCount', { count: itemLessons.length })}
                          countLabel={t('lessonsCount', { count: itemLessons.length })}
                          defaultOpen={seriesIndex === 0}
                        >
                          {itemLessons.length === 0 ? (
                            <p className="px-5 py-6 text-sm text-muted-foreground">{t('noCourses')}</p>
                          ) : (
                            itemLessons.map((lesson, lessonIndex) => (
                              <LessonRow
                                key={lesson.id}
                                lesson={lesson}
                                courseSlug={slug}
                                courseId={course.id}
                                index={lessonOffset + lessonIndex + 1}
                              />
                            ))
                          )}
                        </CurriculumSeries>
                      </StaggerItem>
                    );
                  })}
                </Stagger>
              )}
            </div>

            <aside className="space-y-4 lg:pt-1">
              <Reveal>
                <Card className="rounded-xl border-border/70 p-6 shadow-xs">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary"><Target className="size-4" /></span>
                    <h3 className="font-display text-lg font-medium text-foreground">{t('requirements')}</h3>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">{requirement}</p>
                </Card>
              </Reveal>

              <Reveal delay={0.06}>
                <Card className="rounded-xl border-border/70 p-6 shadow-xs">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-full bg-accent/15 text-accent-foreground dark:text-accent"><Sparkles className="size-4" /></span>
                    <h3 className="font-display text-lg font-medium text-foreground">{t('includes')}</h3>
                  </div>
                  <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-success" />{t('lessonsCount', { count: lessonCount })}</li>
                    {previewCount > 0 ? <li className="flex items-start gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-success" />{previewCount} {t('videoPreview')}</li> : null}
                    {quizCount > 0 ? <li className="flex items-start gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-success" />{quizCount} {t('knowledgeChecks')}</li> : null}
                    {resourceCount > 0 ? <li className="flex items-start gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-success" />{resourceCount} {t('courseMaterials')}</li> : null}
                    <li className="flex items-start gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-success" />{t('selfPaced')}</li>
                    <li className="flex items-start gap-2.5"><Award className="mt-0.5 size-4 shrink-0 text-primary" />{t('certificate')}</li>
                  </ul>
                </Card>
              </Reveal>

              <CourseProductsSidebar courseId={course.id} academyId={course.academyId ?? undefined} />
            </aside>
          </div>
        </div>
      </section>

      <LiveSessionsSection courseId={course.id} />

      <section className="container mx-auto px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <Reveal className="relative isolate overflow-hidden rounded-2xl border border-border/70 bg-card px-6 py-10 shadow-sm sm:px-12 sm:py-14">
          <div className="ambient-wash absolute inset-0 -z-10" aria-hidden />
          <div className="relative flex flex-col justify-between gap-8 md:flex-row md:items-center">
            <div className="max-w-2xl">
              <SectionEyebrow>{t('readyToStart')}</SectionEyebrow>
              <h2 className="mt-3 text-balance font-display text-3xl font-medium tracking-[-0.02em] text-foreground sm:text-4xl">{t('enrollToStart')}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{course.title} · {durationLabel}</p>
            </div>
            <div className="w-full shrink-0 md:w-60">
              <EnrollButton
                  courseId={course.id}
                  courseSlug={slug}
                  className="h-12 rounded-full"
                  isFree={isFree}
                  priceCents={course.priceCents ?? 0}
                  currency={course.currency || 'SAR'}
                />
            </div>
          </div>
        </Reveal>
      </section>

      <ProgressSection courseId={course.id} courseSlug={slug} />
    </div>
  );
}
