'use client';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { X } from 'lucide-react';
import { CourseCard } from '@/components/academy/course-card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';

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

export function CourseGrid() {
  const searchParams = useSearchParams();
  const academySlug = searchParams.get('academy')?.trim() || '';

  const coursesQuery = useQuery<{ data: Course[] }>({
    queryKey: ['courses', { academy: academySlug || 'all' }],
    queryFn: () => {
      const qs = academySlug ? `?academy=${encodeURIComponent(academySlug)}` : '';
      return fetch(`/api/proxy/courses${qs}`, { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to load courses');
        return r.json();
      });
    },
    retry: 2,
  });

  const academyQuery = useQuery<AcademyHeader | null>({
    queryKey: ['academy-header', academySlug || 'none'],
    queryFn: async () => {
      if (!academySlug) return null;
      const res = await fetch(`/api/proxy/academies/${encodeURIComponent(academySlug)}`, {
        credentials: 'include',
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
        {academySlug ? <Skeleton className="h-28 w-full rounded-2xl" /> : null}
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
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="mb-4 h-12 w-12 text-muted-foreground/50" />
        <h3 className="text-lg font-semibold">Unable to load courses</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Please make sure the backend server is running.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {academySlug ? (
        academy ? (
          <div className="relative overflow-hidden rounded-2xl border">
            {academy.heroImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={academy.heroImageUrl} alt="" className="h-36 w-full object-cover md:h-44" />
            ) : (
              <div
                className="h-24 w-full"
                style={{ backgroundColor: `${academy.accentColor || '#7c3aed'}14` }}
              />
            )}
            <div className="flex flex-wrap items-center gap-4 bg-card/95 p-4 backdrop-blur">
              {academy.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={academy.logoUrl}
                  alt=""
                  className="h-14 w-14 rounded-xl border bg-white object-cover"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                  Academy
                </p>
                <h2 className="truncate text-xl font-bold">{academy.title}</h2>
                {academy.subtitle ? (
                  <p className="truncate text-sm text-muted-foreground">{academy.subtitle}</p>
                ) : academy.description ? (
                  <p className="line-clamp-1 text-sm text-muted-foreground">{academy.description}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/academy/${academy.slug}`}
                  className="rounded-lg border px-3 py-1.5 text-xs font-bold hover:bg-muted"
                >
                  View academy
                </Link>
                <Link
                  href="/courses"
                  className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" /> Clear
                </Link>
              </div>
            </div>
          </div>
        ) : academyMissing ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              No such academy “{academySlug}” — showing all courses.
            </p>
            <Link href="/courses" className="text-xs font-bold underline">
              Clear filter
            </Link>
          </div>
        ) : null
      ) : null}

      {courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <h3 className="text-lg font-semibold">
            {academySlug ? `No courses in this academy yet` : 'No courses yet'}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {academySlug
              ? 'Courses will appear here once they are assigned and published.'
              : 'Courses will appear here once they are published.'}
          </p>
          {academySlug ? (
            <Link href="/courses" className="mt-4 text-sm font-bold text-primary">
              Browse all courses
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              slug={course.slug}
              title={course.title}
              subtitle={course.subtitle}
              thumbnailUrl={course.thumbnailUrl}
              difficulty={course.difficulty}
              estimatedHours={course.estimatedHours}
            />
          ))}
        </div>
      )}
    </div>
  );
}
