'use client';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DifficultyBar } from '@/components/academy/difficulty-bar';
import { Skeleton } from '@/components/ui/skeleton';
import { Award, BookOpen, ArrowRight, Shield } from 'lucide-react';
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
  const { isAuthenticated } = useAuthStore();
  const { data: enrollments, isLoading } = useQuery<Enrollment[]>({
    queryKey: ['my-enrollments'],
    queryFn: () =>
      fetch('/api/proxy/courses/enrollments/mine', { credentials: 'include' }).then((r) =>
        r.json(),
      ),
    enabled: isAuthenticated,
  });
  const { data: certifications } = useQuery({
    queryKey: ['my-certifications'],
    queryFn: () =>
      fetch('/api/proxy/certifications/my', { credentials: 'include' }).then((r) => r.json()),
    enabled: isAuthenticated,
  });
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        {' '}
        <h1 className="text-3xl font-bold mb-4">My Learning</h1>{' '}
        <p className="text-muted-foreground mb-6">Sign in to track your progress.</p>{' '}
        <Button asChild>
          {' '}
          <Link href="/login">Sign In</Link>{' '}
        </Button>{' '}
      </div>
    );
  }
  return (
    <div className="container mx-auto px-4 py-12">
      {' '}
      <div className="flex items-center justify-between mb-8">
        {' '}
        <h1 className="text-3xl font-bold">My Learning</h1>{' '}
        <Button variant="outline" size="sm" asChild>
          {' '}
          <Link href="/settings/account/security">
            {' '}
            <Shield className="mr-2 h-4 w-4" /> Security Settings{' '}
          </Link>{' '}
        </Button>{' '}
      </div>{' '}
      <div className="grid gap-8 lg:grid-cols-3">
        {' '}
        <div className="lg:col-span-2">
          {' '}
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            {' '}
            <BookOpen className="h-5 w-5 text-primary" /> Enrolled Courses{' '}
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
                          <Award className="h-4 w-4" /> {lessonCount} series{' '}
                        </div>{' '}
                      </div>{' '}
                    </CardHeader>{' '}
                    <CardFooter>
                      {' '}
                      <Button variant="outline" size="sm" asChild>
                        {' '}
                        <Link href={`/courses/${enrollment.course.slug}`}>
                          {' '}
                          {enrollment.status === 'completed' ? 'Review' : 'Continue'}{' '}
                          <ArrowRight className="ml-1 h-3 w-3" />{' '}
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
              <h3 className="font-semibold mb-1">No enrollments yet</h3>{' '}
              <p className="text-sm text-muted-foreground mb-4">
                Browse courses and start learning.
              </p>{' '}
              <Button asChild>
                {' '}
                <Link href="/courses">Browse Courses</Link>{' '}
              </Button>{' '}
            </div>
          )}{' '}
        </div>{' '}
        <div>
          {' '}
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            {' '}
            <Award className="h-5 w-5 text-primary" /> Certifications{' '}
          </h2>{' '}
          {certifications && certifications.length > 0 ? (
            <div className="space-y-3">
              {' '}
              {certifications.map(
                (cert: { id: string; certificateNumber: string; course?: { title: string } }) => (
                  <Card key={cert.id}>
                    {' '}
                    <CardContent className="p-4">
                      {' '}
                      <Award className="h-8 w-8 text-primary mb-2" />{' '}
                      <p className="text-sm font-semibold">{cert.course?.title || 'Certificate'}</p>{' '}
                      <p className="text-xs text-muted-foreground">{cert.certificateNumber}</p>{' '}
                    </CardContent>{' '}
                  </Card>
                ),
              )}{' '}
            </div>
          ) : (
            <div className="rounded-lg border bg-card p-6 text-center">
              {' '}
              <Award className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />{' '}
              <p className="text-sm text-muted-foreground">
                Complete a course to earn a certificate.
              </p>{' '}
            </div>
          )}{' '}
        </div>{' '}
      </div>{' '}
    </div>
  );
}
