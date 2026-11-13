'use client';
import { rememberListCount } from '@/lib/admin-shape-memory';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { BookOpen, X } from 'lucide-react';
import { CourseCard } from '@/components/academy/course-card';
import { coerceLocale } from '@/i18n/config';
import type { ContentLocale } from '@titan/shared';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonRegion } from '@/components/ui/skeletons/region';
import { CourseGridSkeleton } from '@/components/ui/skeletons/public';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { getImageSrc } from '@/lib/images';
import { LayoutBox, Reveal, Stagger, StaggerItem } from '@/components/ui/motion';

interface Course {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description?: string | null;
  thumbnailUrl: string | null;
  difficulty: number;
  estimatedHours: number | null;
  academyId?: string | null;
  academySlug?: string | null;
  academyTitle?: string | null;
  availableLocales?: ContentLocale[];
  resolvedLocale?: ContentLocale;
  fallbackFields?: string[];
}

interface AcademyHeader {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  heroImageUrl: string | null;
  logoUrl: string | null;
  accentColor: string | null;
  courseCount: number;
}

export interface CourseGridProps {
  /**
   * Courses fetched on the server for the unfiltered listing.
   *
   * The grid used to fetch only on the client, so `/courses` shipped a skeleton to every
   * crawler. When an academy filter is present the URL differs from what the server
   * rendered, so the server value is ignored and the client fetch takes over — the seeded
   * query key is keyed on the same 'all' bucket so there is no duplicate request for the
   * default case.
   */
  initialCourses?: { data: Course[] } | null;
}

export function CourseGrid({ initialCourses }: CourseGridProps) {
  const t = useTranslations('pages.courseGrid');
  const tc = useTranslations('courses');
  const tCommon = useTranslations('common');
  const searchParams = useSearchParams();
  const locale = coerceLocale(useLocale());
  const academySlug = searchParams.get('academy')?.trim() || '';
  const localeHeaders = { 'x-locale': locale, 'x-next-locale': locale, 'accept-language': `${locale},en;q=0.8` };
  // Only seed when showing the unfiltered listing; a filtered URL must fetch its own set.
  const seeded = academySlug ? null : initialCourses ?? null;

  const coursesQuery = useQuery<{ data: Course[] }>({
    queryKey: ['courses', locale, { academy: academySlug || 'all' }],
    queryFn: () => {
      const qs = academySlug ? `?academy=${encodeURIComponent(academySlug)}` : '';
      return fetch(`/api/proxy/courses${qs}`, { credentials: 'include', headers: localeHeaders }).then((r) => {
        if (!r.ok) throw new Error('Failed to load courses');
        return r.json();
      });
    },
    retry: 2,
    ...(seeded ? { initialData: seeded, staleTime: 60_000 } : {}),
  });

  const academyQuery = useQuery<AcademyHeader | null>({
    queryKey: ['academy-header', locale, academySlug || 'none'],
    queryFn: async () => {
      if (!academySlug) return null;
      const res = await fetch(`/api/proxy/academies/${encodeURIComponent(academySlug)}`, {
        credentials: 'include',
        headers: localeHeaders,
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to load academy');
      return res.json();
    },
    retry: 1,
    enabled: Boolean(academySlug),
  });

  const { data, isLoading, error } = coursesQuery;
  const courses = data?.data || [];
  const academy = academyQuery.data ?? null;
  const academyMissing = Boolean(academySlug) && academyQuery.isSuccess && academy === null;

  // The /courses skeleton draws as many cards as the unfiltered catalogue last showed.
  useEffect(() => {
    if (!academySlug && !isLoading && !error) rememberListCount('public-courses', courses.length);
  }, [academySlug, isLoading, error, courses.length]);

  if (isLoading) {
    // Same wrapper and grid as the loaded list below, so the cards land in place.
    return (
      <SkeletonRegion className="space-y-8">
        {academySlug ? <Skeleton className="h-[15.75rem] w-full rounded-2xl md:h-[18.75rem]" /> : null}
        <CourseGridSkeleton />
      </SkeletonRegion>
    );
  }
  if (error) {
    return (
      <ErrorState
        title={t('loadFailedTitle')}
        description={t('loadFailedHint')}
        onRetry={() => void coursesQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-8" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      {academySlug ? (
        academy ? (
          <Reveal className="relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xs">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={getImageSrc(academy.heroImageUrl, 'academy')} alt="" className="h-36 w-full object-cover md:h-48" />
            <div className="flex flex-wrap items-center gap-4 border-t border-border/60 p-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getImageSrc(academy.logoUrl, 'academy')}
                alt=""
                className="-mt-10 size-16 rounded-xl border-4 border-card bg-card object-cover shadow-md"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {tc('academyLabel')}
                </p>
                <h2 className="truncate font-display text-2xl font-medium tracking-[-0.015em] text-foreground">
                  {academy.title}
                </h2>
                {academy.subtitle ? (
                  <p className="truncate text-sm text-muted-foreground">{academy.subtitle}</p>
                ) : academy.description ? (
                  <p className="line-clamp-1 text-sm text-muted-foreground">{academy.description}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="rounded-full" asChild>
                  <Link href={`/academy/${academy.slug}`}>{t('viewAcademy')}</Link>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/courses">
                    <X />
                    {tCommon('clear')}
                  </Link>
                </Button>
              </div>
            </div>
          </Reveal>
        ) : academyMissing ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3">
            <p className="text-sm text-foreground">
              {t('academyNotFound', { slug: academySlug })}
            </p>
            <Button variant="outline" size="xs" asChild>
              <Link href="/courses">{t('clearFilter')}</Link>
            </Button>
          </div>
        ) : null
      ) : null}

      {courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={academySlug ? t('emptyAcademyTitle') : t('emptyTitle')}
          description={
            academySlug ? t('emptyAcademyHint') : t('emptyHint')
          }
          action={
            academySlug ? (
              <Button variant="outline" size="sm" asChild>
                <Link href="/courses">{t('browseAll')}</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        // `Stagger`/`StaggerItem` are client components wrapping server-rendered
        // cards, so the cascade costs one small shared component rather than a
        // client boundary per card. `LayoutBox` animates the grid cells when a
        // filter changes the result set, instead of every card popping.
        <Stagger as="ul" className="grid gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course, i) => (
            <StaggerItem as="li" key={course.id} index={i}>
              <LayoutBox className="h-full">
                <CourseCard
                  slug={course.slug}
                  title={course.title}
                  subtitle={course.subtitle}
                  thumbnailUrl={course.thumbnailUrl}
                  difficulty={course.difficulty}
                  estimatedHours={course.estimatedHours}
                  availableLocales={course.availableLocales}
                  resolvedLocale={course.resolvedLocale}
                  fallbackFields={course.fallbackFields}
                />
              </LayoutBox>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
