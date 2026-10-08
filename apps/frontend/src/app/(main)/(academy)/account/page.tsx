'use client';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/stores/auth-store';
import { Card, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DifficultyBar } from '@/components/academy/difficulty-bar';
import { Skeleton } from '@/components/ui/skeleton';
import { Award, BookOpen, ArrowRight, Shield } from 'lucide-react';
import { CertificateList } from '@/components/certificates/certificate-list';
import Link from 'next/link';
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
      fetch('/api/proxy/courses/enrollments/mine', { credentials: 'include' }).then((r) =>
        r.json(),
      ),
    enabled: isAuthenticated,
  });
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        {' '}
        <h1 className="text-3xl font-bold mb-4">{t('learning.myLearning')}</h1>{' '}
        <p className="text-muted-foreground mb-6">{t('learning.signInHint')}</p>{' '}
        <Button asChild>
          {' '}
          <Link href="/login">{t('learning.signIn')}</Link>{' '}
        </Button>{' '}
      </div>
    );
  }
  return (
    <div className="container mx-auto px-4 py-12">
      {' '}
      <div className="flex items-center justify-between mb-8">
        {' '}
        <h1 className="text-3xl font-bold">{t('learning.myLearning')}</h1>{' '}
        <Button variant="outline" size="sm" asChild>
          {' '}
          <Link href="/settings/account/security">
            {' '}
            <Shield className="me-2 size-4" /> {t('learning.securitySettings')}{' '}
          </Link>{' '}
        </Button>{' '}
      </div>{' '}
      <div className="grid gap-8 lg:grid-cols-3">
        {' '}
        <div className="lg:col-span-3">
          {' '}
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            {' '}
            <BookOpen className="size-5 text-primary" /> {t('learning.enrolledCourses')}{' '}
          </h2>{' '}
          {isLoading ? (
            <div className="space-y-4">
              {' '}
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-32 rounded-lg" />
              ))}{' '}
            </div>
          ) : enrollments && enrollments.length > 0 ? (
            <div className="space-y-4">
              {' '}
              {enrollments.map((enrollment) => {
                const lessonCount = enrollment.course.series?.length || 0;
                return (
                  <Card key={enrollment.id} className="hover:border-primary/50 transition-colors">
                    {' '}
                    <CardHeader>
                      {' '}
                      <div className="flex items-start justify-between">
                        {' '}
                        <div>
                          {' '}
                          <CardTitle className="text-lg">{enrollment.course.title}</CardTitle>{' '}
                          <div className="flex items-center gap-3 mt-1">
                            {' '}
                            <span className="text-xs text-muted-foreground capitalize">
                              {enrollment.status}
                            </span>{' '}
                            <DifficultyBar
                              level={enrollment.course.difficulty}
                              size="sm"
                              showLabel={false}
                            />{' '}
                          </div>{' '}
                        </div>{' '}
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          {' '}
                          <Award className="size-4" /> {t('learning.seriesCount', { count: lessonCount })}{' '}
                        </div>{' '}
                      </div>{' '}
                    </CardHeader>{' '}
                    <CardFooter>
                      {' '}
                      <Button variant="outline" size="sm" asChild>
                        {' '}
                        <Link href={`/courses/${enrollment.course.slug}`}>
                          {' '}
                          {enrollment.status === 'completed' ? t('learning.review') : t('learning.continue')}{' '}
                          <ArrowRight className="flip-rtl ms-1 size-3.5" />{' '}
                        </Link>{' '}
                      </Button>{' '}
                    </CardFooter>{' '}
                  </Card>
                );
              })}{' '}
            </div>
          ) : (
            <div className="rounded-lg border bg-card p-8 text-center">
              {' '}
              <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />{' '}
              <h3 className="font-semibold mb-1">{t('learning.noEnrollments')}</h3>{' '}
              <p className="text-sm text-muted-foreground mb-4">
                {t('learning.noEnrollmentsHint')}
              </p>{' '}
              <Button asChild>
                {' '}
                <Link href="/courses">{t('learning.browseCourses')}</Link>{' '}
              </Button>{' '}
            </div>
          )}{' '}
        </div>{' '}
      </div>{' '}
      <section className="mt-10">
        <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
          {' '}
          <Award className="size-5 text-primary" /> {t('learning.certifications')}{' '}
        </h2>{' '}
        <CertificateList />
      </section>{' '}
    </div>
  );
}
