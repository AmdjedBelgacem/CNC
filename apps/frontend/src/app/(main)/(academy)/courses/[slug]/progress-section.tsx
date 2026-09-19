'use client';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { Loader2 } from 'lucide-react';
interface ProgressSectionProps {
  courseId: string;
}
export function ProgressSection({ courseId }: ProgressSectionProps) {
  const { isAuthenticated } = useAuthStore();
  const { data, isLoading } = useQuery<{
    total: number;
    completed: number;
    percent: number;
    completedLessonIds: string[];
  }>({
    queryKey: ['course-progress', courseId],
    queryFn: () =>
      fetch(`/api/proxy/courses/${courseId}/progress`, { credentials: 'include' }).then((r) =>
        r.json(),
      ),
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });
  if (!isAuthenticated) return null;
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {' '}
        <Loader2 className="h-4 w-4 animate-spin" /> Loading progress...{' '}
      </div>
    );
  }
  if (!data) return null;
  return (
    <div className="space-y-2">
      {' '}
      <div className="flex items-center justify-between text-sm">
        {' '}
        <span className="text-muted-foreground">Progress</span>{' '}
        <span className="font-medium">
          {data.percent}% ({data.completed}/{data.total} lessons)
        </span>{' '}
      </div>{' '}
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        {' '}
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${data.percent}%` }}
        />{' '}
      </div>{' '}
    </div>
  );
}
