'use client';
import { rememberListCount } from '@/lib/admin-shape-memory';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/stores/auth-store';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Reveal, Stagger, StaggerItem } from '@/components/ui/motion';
import { Button } from '@/components/ui/button';
import { DifficultyBar } from '@/components/academy/difficulty-bar';
import { SkeletonRegion } from '@/components/ui/skeletons/region';
import { EnrollmentListSkeleton } from '@/components/skeletons/public-route-skeletons';
import { Award, BookOpen, ArrowRight, Shield, Video } from 'lucide-react';
import { CertificateList } from '@/components/certificates/certificate-list';
import { useNextLiveSession } from '@/hooks/use-live-sessions';
import Link from 'next/link';
import { fetchWithRefresh } from '@/hooks/use-api-proxy';
interface Enrollment {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  certificateId: string | null;
  course: {
    id: string;
    title: string;
    slug: string;
    difficulty: number;
    estimatedHours: number | null;
    series?: { id: string }[];
  };
}
export default function AccountPage() {
  const t = useTranslations('account');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: enrollments, isLoading } = useQuery<Enrollment[]>({
    queryKey: ['my-enrollments'],
    queryFn: () =>
      fetchWithRefresh('/api/proxy/courses/enrollments/mine', { credentials: 'include' }).then((r) =>
        r.json(),
      ),
    enabled: isAuthenticated,
  });
  const { nextSession } = useNextLiveSession(isAuthenticated);

  // The /account skeleton draws as many enrolment rows as this list last showed.
  useEffect(() => {
    if (!isLoading && Array.isArray(enrollments)) rememberListCount('public-account-enrollments', enrollments.length);
  }, [isLoading, enrollments]);
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto max-w-xl px-4 py-24 text-center">
        <span className="mx-auto mb-6 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <BookOpen className="size-5" />
        </span>
        <h1 className="mb-3 text-balance font-display text-4xl font-medium tracking-[-0.022em] text-foreground">
          {t('learning.myLearning')}
        </h1>
        <p className="mb-8 text-muted-foreground">{t('learning.signInHint')}</p>
        <Button asChild className="rounded-full px-6">
          <Link href="/login">{t('learning.signIn')}</Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="container mx-auto max-w-5xl px-4 py-12 md:py-16">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4 border-b border-border/70 pb-8">
        <h1 className="font-display text-4xl font-medium tracking-[-0.022em] text-foreground sm:text-5xl">
          {t('learning.myLearning')}
        </h1>
        <Button variant="outline" size="sm" className="rounded-full" asChild>
          <Link href="/settings/account/security">
            <Shield className="me-2 size-4" /> {t('learning.securitySettings')}
          </Link>
        </Button>
      </div>
      <div className="space-y-12">
        {nextSession ? (
          <Reveal>
            <Card className="card-hover relative overflow-hidden rounded-2xl border-border/70 shadow-xs hover:shadow-lg">
              <div className="ambient-wash pointer-events-none absolute inset-0" aria-hidden />
              <CardHeader className="relative p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs font-medium text-primary">
                      <span className="relative flex size-2">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60 motion-reduce:animate-none" />
                        <span className="relative inline-flex size-2 rounded-full bg-primary" />
                      </span>
                      <Video className="size-4" /> {t('learning.nextLiveSession')}
                    </div>
                    <CardTitle className="mt-3 font-display text-2xl font-medium tracking-[-0.015em]">
                      {nextSession.title}
                    </CardTitle>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      {nextSession.courseTitle} ·{' '}
                      {new Intl.DateTimeFormat(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                        timeZone: nextSession.timezone || undefined,
                      }).format(new Date(nextSession.startsAt))}
                    </p>
                  </div>
                  <Button size="sm" className="rounded-full" asChild>
                    <Link href={`/courses/${nextSession.courseSlug}#live-sessions`}>
                      {t('learning.openCourse')} <ArrowRight className="flip-rtl ms-1 size-3.5" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
            </Card>
          </Reveal>
        ) : null}
        <section>
          <Reveal as="header" className="mb-5 flex items-center gap-2.5">
            <BookOpen className="size-5 text-primary" />
            <h2 className="font-display text-2xl font-medium tracking-[-0.015em] text-foreground">
              {t('learning.enrolledCourses')}
            </h2>
          </Reveal>
          {isLoading ? (
            <SkeletonRegion>
              <EnrollmentListSkeleton />
            </SkeletonRegion>
          ) : enrollments && enrollments.length > 0 ? (
            <Stagger className="space-y-3">
              {enrollments.map((enrollment, index) => {
                const lessonCount = enrollment.course.series?.length || 0;
                return (
                  <StaggerItem key={enrollment.id} index={index}>
                    <Link
                      href={`/courses/${enrollment.course.slug}`}
                      className="card-hover group flex flex-wrap items-center gap-5 rounded-xl border border-border/70 bg-card p-5 shadow-xs transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-lg"
                    >
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <BookOpen className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-display text-lg font-medium text-foreground transition-colors group-hover:text-primary">
                          {enrollment.course.title}
                        </h3>
                        <div className="mt-1.5 flex flex-wrap items-center gap-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-2xs font-medium capitalize ${enrollment.status === 'completed' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}
                          >
                            {enrollment.status}
                          </span>
                          <div className="w-24">
                            <DifficultyBar
                              level={enrollment.course.difficulty}
                              size="sm"
                              showLabel={false}
                            />
                          </div>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Award className="size-3.5" />{' '}
                            {t('learning.seriesCount', { count: lessonCount })}
                          </span>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-foreground">
                        {enrollment.status === 'completed'
                          ? t('learning.review')
                          : t('learning.continue')}
                        <ArrowRight className="flip-rtl ms-1 size-3.5 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
                      </span>
                    </Link>
                  </StaggerItem>
                );
              })}
            </Stagger>
          ) : (
            <Reveal className="rounded-2xl border border-dashed border-border px-8 py-14 text-center">
              <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <BookOpen className="size-5" />
              </span>
              <h3 className="mb-1 font-display text-xl font-medium text-foreground">
                {t('learning.noEnrollments')}
              </h3>
              <p className="mx-auto mb-6 max-w-sm text-sm text-muted-foreground">
                {t('learning.noEnrollmentsHint')}
              </p>
              <Button asChild className="rounded-full px-6">
                <Link href="/courses">{t('learning.browseCourses')}</Link>
              </Button>
            </Reveal>
          )}
        </section>
        <section>
          <Reveal as="header" className="mb-5 flex items-center gap-2.5">
            <Award className="size-5 text-primary" />
            <h2 className="font-display text-2xl font-medium tracking-[-0.015em] text-foreground">
              {t('learning.certifications')}
            </h2>
          </Reveal>
          <CertificateList />
        </section>
      </div>
    </div>
  );
}
