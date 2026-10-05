'use client';

import Link from 'next/link';
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

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
      {children}
    </p>
  );
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
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="font-display text-xl font-semibold leading-none tracking-tight text-foreground">{value}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{label}</p>
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
      <Icon className="size-4 text-primary" />
      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-sm font-semibold text-background">{value}</span>
        <span className="text-xs text-background/60">{label}</span>
      </div>
    </div>
  );
}

function CoursePageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-foreground text-background">
        <div className="container mx-auto space-y-6 px-4 py-10 sm:px-6 lg:px-8">
          <Skeleton className="h-4 w-32 bg-white/10" />
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)] lg:items-center">
            <div className="space-y-5">
              <Skeleton className="h-5 w-40 bg-white/10" />
              <Skeleton className="h-16 w-4/5 bg-white/10" />
              <Skeleton className="h-6 w-3/5 bg-white/10" />
              <div className="flex gap-5">
                <Skeleton className="h-8 w-28 bg-white/10" />
                <Skeleton className="h-8 w-28 bg-white/10" />
              </div>
            </div>
            <Skeleton className="aspect-[4/3] w-full bg-white/10" />
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
      <section className="relative isolate overflow-hidden border-b border-border bg-foreground text-background">
        <div className="blueprint-grid absolute inset-0 -z-20 opacity-20" />
        <div className="absolute -end-32 -top-32 -z-10 size-[28rem] rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-48 start-1/3 -z-10 size-[24rem] rounded-full bg-accent/10 blur-3xl" />

        <div className="container relative mx-auto px-4 pt-5 sm:px-6 lg:px-8">
          <Link
            href="/courses"
            className="inline-flex items-center gap-2 text-sm font-medium text-background/60 transition-colors hover:text-background"
          >
            <ArrowLeft className="size-4 rtl:rotate-180" />
            {t('title')}
          </Link>
        </div>

        <div className="container relative mx-auto grid gap-10 px-4 pb-12 pt-10 sm:px-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(26rem,1.08fr)] lg:items-start lg:gap-10 lg:px-8 lg:pb-16 lg:pt-14">
          <div className="min-w-0">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              {academy ? (
                <Link
                  href={`/academy/${academy.slug}`}
                  className="group inline-flex max-w-full items-center gap-2 rounded-full border border-background/20 bg-background/10 py-1 pe-3 ps-1 text-xs text-background/80 transition-colors hover:border-background/40 hover:bg-background/15"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-background/15">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={getImageSrc(academy.logoUrl, 'academy')} alt="" className="size-full object-cover" />
                  </span>
                  <span className="truncate">{t('academyLabel')} · <strong className="font-semibold text-background">{academy.title}</strong></span>
                  <ArrowRight className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                </Link>
              ) : (
                <span className="rounded-full border border-background/20 bg-background/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-background/75">
                  {t('coursePath')}
                </span>
              )}
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-background/45">CNC / {course.slug}</span>
            </div>

            <h1 className="max-w-4xl font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              {course.title}
            </h1>
            {course.subtitle ? (
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-background/70 sm:text-xl">
                {course.subtitle}
              </p>
            ) : null}

            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 border-y border-background/15 py-4">
              <HeroStat icon={Clock} value={durationLabel} label={t('duration')} />
              <HeroStat icon={PlayCircle} value={t('lessonsCount', { count: lessonCount })} label="" />
              <HeroStat icon={Gauge} value={difficultyLabel} label={t('level')} />
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <div className="w-full sm:w-64">
                <EnrollButton
                  courseId={course.id}
                  courseSlug={slug}
                  className="h-12"
                  isFree={isFree}
                  priceCents={course.priceCents ?? 0}
                  currency={course.currency || 'SAR'}
                />
              </div>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="border-background/25 bg-transparent text-background hover:border-background/40 hover:bg-background/10 hover:text-background"
              >
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
                tone="inverse"
              />
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-2xl lg:max-w-none">
            <div className="pointer-events-none absolute -inset-2 z-10 rounded-3xl border border-primary/50" />
            {trailerUrl ? (
              <CinematicVideoPlayer
                src={trailerUrl}
                poster={getImageSrc(course.thumbnailUrl, 'course')}
                title={course.title}
                variant="trailer"
                className="w-full"
              />
            ) : (
              <div className="relative aspect-video overflow-hidden rounded-3xl border border-background/20 bg-background/10 shadow-2xl shadow-black/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getImageSrc(course.thumbnailUrl, 'course')}
                  alt={course.title}
                  className="size-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-transparent to-transparent" />
                <Badge variant="soft" className="absolute bottom-5 start-5 border-white/15 bg-black/25 text-white backdrop-blur-sm">
                  <PlayCircle className="size-3" />
                  {t('videoPreview')}
                </Badge>
              </div>
            )}
            <div className="mt-3 flex items-center justify-between px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-background/45">
              <span>{t('courseVisual')} / 01</span>
              <span>{course.isPublished ? t('publishedPath') : t('videoPreview')}</span>
            </div>
          </div>
        </div>
      </section>

      <section id="overview" className="container mx-auto scroll-mt-24 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <SectionEyebrow>{t('courseOverview')}</SectionEyebrow>
              <span className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-primary">
                {t('whatYouPractice')}
              </span>
            </div>
            <h2 className="mt-3 max-w-3xl font-display text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
              {course.subtitle || course.title}
            </h2>
            <p className="mt-5 max-w-3xl whitespace-pre-line text-base leading-8 text-muted-foreground sm:text-lg">
              {courseDescription}
            </p>

            <div className="mt-9 grid gap-3 sm:grid-cols-3">
              <StatTile icon={Layers3} value={String(series.length)} label={t('coursePath')} />
              <StatTile icon={PlayCircle} value={String(lessonCount)} label={t('lessons')} />
              <StatTile icon={FileDown} value={String(resourceCount)} label={t('courseMaterials')} />
            </div>
          </div>

          <Card className="h-fit overflow-hidden">
            <div className="border-b border-border bg-secondary px-5 py-5 text-secondary-foreground">
              <SectionEyebrow>{t('courseBrief')}</SectionEyebrow>
              <div className="mt-3 flex items-end justify-between gap-3">
                <p className="font-display text-2xl font-semibold tracking-tight">
                  {priceLabel || accessLabel}
                </p>
                {priceLabel ? <Badge variant="soft">{accessLabel}</Badge> : null}
              </div>
            </div>
            <CardContent className="space-y-5 p-5">
              <div>
                <div className="mb-2 flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground">
                  <span>{t('level')}</span>
                  <span className="font-semibold text-foreground">{difficultyLabel}</span>
                </div>
                <DifficultyBar level={difficulty} size="sm" showLabel={false} />
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border pt-4 text-sm">
                <span className="inline-flex items-center gap-2 text-muted-foreground"><Clock className="size-4" />{t('duration')}</span>
                <span className="font-semibold text-foreground">{durationLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border pt-4 text-sm">
                <span className="inline-flex items-center gap-2 text-muted-foreground"><BookOpen className="size-4" />{t('lessons')}</span>
                <span className="font-semibold text-foreground">{lessonCount}</span>
              </div>
              {academy ? (
                <Link
                  href={`/academy/${academy.slug}`}
                  className="group flex items-center gap-3 border-t border-border pt-4"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={getImageSrc(academy.logoUrl, 'academy')} alt="" className="size-full object-cover" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{t('academyLabel')}</span>
                    <span className="block truncate text-sm font-semibold text-foreground group-hover:text-primary">{academy.title}</span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                </Link>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="curriculum" className="scroll-mt-24 border-y border-border bg-surface-sunken/35">
        <div className="container mx-auto px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <SectionEyebrow>{t('curriculum')}</SectionEyebrow>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                {t('coursePath')}
              </h2>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="font-mono text-xs uppercase tracking-[0.14em]">{String(series.length).padStart(2, '0')}</span>
              <span>{t('coursePath')}</span>
              <span className="h-1 w-1 rounded-full bg-primary" />
              <span className="font-mono text-xs uppercase tracking-[0.14em]">{String(lessonCount).padStart(2, '0')}</span>
              <span>{t('lessons')}</span>
            </div>
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
            <div className="min-w-0 space-y-4">
              {series.length === 0 ? (
                <Card>
                  <EmptyState compact icon={Compass} title={t('noCourses')} />
                </Card>
              ) : (
                series.map((item, seriesIndex) => {
                  const itemLessons = item.lessons ?? [];
                  const lessonOffset = series.slice(0, seriesIndex).reduce((sum, entry) => sum + (entry.lessons?.length ?? 0), 0);
                  return (
                    <details key={item.id} open={seriesIndex === 0} className="group overflow-hidden rounded-xl border border-border bg-card shadow-xs">
                      <summary className="flex cursor-pointer list-none items-center gap-4 px-4 py-4 transition-colors hover:bg-muted/40 sm:px-5">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 font-mono text-xs font-semibold text-primary">
                          {String(seriesIndex + 1).padStart(2, '0')}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-display text-lg font-semibold tracking-tight text-foreground">{item.title}</span>
                          <span className="mt-1 block truncate text-xs text-muted-foreground">
                            {item.description || t('lessonsCount', { count: itemLessons.length })}
                          </span>
                        </span>
                        <span className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
                          <span>{t('lessonsCount', { count: itemLessons.length })}</span>
                          <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
                        </span>
                        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180 sm:hidden" />
                      </summary>
                      <div className="border-t border-border">
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
                      </div>
                    </details>
                  );
                })
              )}
            </div>

            <aside className="space-y-4 lg:pt-1">
              <Card className="p-5">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Target className="size-4" /></span>
                  <h3 className="font-display text-base font-semibold text-foreground">{t('requirements')}</h3>
                </div>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">{requirement}</p>
              </Card>

              <Card className="p-5">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-accent/10 text-accent"><Sparkles className="size-4" /></span>
                  <h3 className="font-display text-base font-semibold text-foreground">{t('includes')}</h3>
                </div>
                <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-success" />{t('lessonsCount', { count: lessonCount })}</li>
                  {previewCount > 0 ? <li className="flex items-start gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-success" />{previewCount} {t('videoPreview')}</li> : null}
                  {quizCount > 0 ? <li className="flex items-start gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-success" />{quizCount} {t('knowledgeChecks')}</li> : null}
                  {resourceCount > 0 ? <li className="flex items-start gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-success" />{resourceCount} {t('courseMaterials')}</li> : null}
                  <li className="flex items-start gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-success" />{t('selfPaced')}</li>
                  <li className="flex items-start gap-2.5"><Award className="mt-0.5 size-4 shrink-0 text-success" />{t('certificate')}</li>
                </ul>
              </Card>

              <CourseProductsSidebar courseId={course.id} academyId={course.academyId ?? undefined} />
            </aside>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="relative isolate overflow-hidden rounded-2xl border border-border bg-foreground px-6 py-8 text-background sm:px-10 sm:py-10">
          <div className="blueprint-grid absolute inset-0 -z-10 opacity-15" />
          <div className="absolute -end-10 -top-20 -z-10 size-64 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative flex flex-col justify-between gap-7 md:flex-row md:items-center">
            <div className="max-w-2xl">
              <SectionEyebrow>{t('readyToStart')}</SectionEyebrow>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{t('enrollToStart')}</h2>
              <p className="mt-3 text-sm leading-6 text-background/65">{course.title} · {durationLabel}</p>
            </div>
            <div className="w-full shrink-0 md:w-56">
              <EnrollButton
                  courseId={course.id}
                  courseSlug={slug}
                  className="h-12"
                  isFree={isFree}
                  priceCents={course.priceCents ?? 0}
                  currency={course.currency || 'SAR'}
                />
            </div>
          </div>
        </div>
      </section>

      <ProgressSection courseId={course.id} courseSlug={slug} />
    </div>
  );
}
