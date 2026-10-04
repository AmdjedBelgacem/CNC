'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp, ListChecks } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useCourseProgress, useMyEnrollments } from '@/hooks/use-learning';
import { Progress, ProgressRing } from '@/components/ui/progress';

export function ProgressSection({ courseId, courseSlug }: { courseId: string; courseSlug: string }) {
  const t = useTranslations('courses');
  const [expanded, setExpanded] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { enrollments, isLoading: enrollmentsLoading } = useMyEnrollments(isAuthenticated);
  const isEnrolled = enrollments.some((enrollment) => enrollment.courseId === courseId);
  const { data, isLoading } = useCourseProgress(courseId, isAuthenticated && isEnrolled);

  if (!isAuthenticated || enrollmentsLoading || !isEnrolled || isLoading || !data) return null;

  const percent = Math.min(100, Math.max(0, data.percent ?? data.progress ?? 0));
  const completed = data.completed ?? data.completedLessons ?? 0;
  const total = data.total ?? data.totalLessons ?? 0;
  const panelId = 'course-progress-panel';

  return (
    <div className="fixed bottom-5 end-5 z-40 w-[min(calc(100vw-2rem),22rem)]">
      {expanded && (
        <div id={panelId} className="mb-3 rounded-2xl border border-border bg-card p-4 text-start shadow-xl shadow-black/10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{t('progressDetails')}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('completedLessons', { completed, total })}
              </p>
            </div>
            <ListChecks className="size-5 text-primary" />
          </div>
          <div className="mt-4">
            <Progress value={percent} label={t('progress')} />
          </div>
          <Link
            href={`/courses/${courseSlug}`}
            onClick={() => setExpanded(false)}
            className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            {t('continueWatching')}
          </Link>
        </div>
      )}
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label={expanded ? t('closeProgress') : t('openProgress')}
        title={expanded ? t('closeProgress') : t('openProgress')}
        className="ms-auto flex items-center gap-2 rounded-full border border-border bg-card p-2.5 text-foreground shadow-lg shadow-black/10 transition hover:border-primary/50 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <ProgressRing value={percent} size={60} strokeWidth={5} />
        {expanded ? <ChevronDown className="me-1 size-4 text-muted-foreground" /> : <ChevronUp className="me-1 size-4 text-muted-foreground" />}
      </button>
    </div>
  );
}
