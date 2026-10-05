'use client';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { BookOpen, X } from 'lucide-react';
import { CourseCard } from '@/components/academy/course-card';
import { coerceLocale } from '@/i18n/config';
import type { ContentLocale } from '@titan/shared';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { getImageSrc } from '@/lib/images';
import { LayoutBox, Stagger, StaggerItem } from '@/components/ui/motion';

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

  if (isLoading) {
    return (
      <div className="space-y-6">
        {academySlug ? <Skeleton className="h-28 w-full rounded-lg" /> : null}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-video w-full rounded-lg" />
              <Skeleton className="h-5 w-3/4" /> <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <ErrorState
        title="Unable to load courses"
        description="Please make sure the backend server is running."
        onRetry={() => void coursesQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-8" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      {academySlug ? (
        academy ? (
          <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={getImageSrc(academy.heroImageUrl, 'academy')} alt="" className="h-36 w-full object-cover md:h-44" />
            <div className="flex flex-wrap items-center gap-4 border-t border-border p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getImageSrc(academy.logoUrl, 'academy')}
                alt=""
                className="size-14 rounded-md border border-border bg-card object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Academy
                </p>
                <h2 className="truncate font-display text-xl font-semibold tracking-tight text-foreground">
                  {academy.title}
                </h2>
                {academy.subtitle ? (
                  <p className="truncate text-sm text-muted-foreground">{academy.subtitle}</p>
                ) : academy.description ? (
                  <p className="line-clamp-1 text-sm text-muted-foreground">{academy.description}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/academy/${academy.slug}`}>View academy</Link>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/courses">
                    <X />
                    Clear
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        ) : academyMissing ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3">
            <p className="text-sm text-foreground">
              No such academy “{academySlug}” — showing all courses.
            </p>
            <Button variant="outline" size="xs" asChild>
              <Link href="/courses">Clear filter</Link>
            </Button>
          </div>
        ) : null
      ) : null}

      {courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={academySlug ? 'No courses in this academy yet' : 'No courses yet'}
          description={
            academySlug
              ? 'Courses will appear here once they are assigned and published.'
              : 'Courses will appear here once they are published.'
          }
          action={
            academySlug ? (
              <Button variant="outline" size="sm" asChild>
                <Link href="/courses">Browse all courses</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        // `Stagger`/`StaggerItem` are client components wrapping server-rendered
        // cards, so the cascade costs one small shared component rather than a
        // client boundary per card. `LayoutBox` animates the grid cells when a
        // filter changes the result set, instead of every card popping.
        <Stagger as="ul" className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course, i) => (
            <StaggerItem as="li" key={course.id} index={i}>
              <LayoutBox>
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
