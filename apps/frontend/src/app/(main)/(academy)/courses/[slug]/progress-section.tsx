'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronUp, ListChecks } from 'lucide-react';
import { AnimatePresence, m } from 'framer-motion';
import { spring } from '@/lib/motion';
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
      <AnimatePresence>
        {expanded && (
          <m.div
            id={panelId}
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: spring.gentle }}
            exit={{ opacity: 0, y: 6, scale: 0.98, transition: { duration: 0.14 } }}
            className="mb-3 origin-bottom-right rounded-2xl border border-border/80 bg-card p-5 text-start shadow-xl rtl:origin-bottom-left"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg font-medium text-foreground">{t('progressDetails')}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('completedLessons', { completed, total })}
                </p>
              </div>
              <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ListChecks className="size-4" />
              </span>
            </div>
            <div className="mt-4">
              <Progress value={percent} label={t('progress')} />
            </div>
            <Link
              href={`/courses/${courseSlug}`}
              onClick={() => setExpanded(false)}
              className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              {t('continueWatching')}
            </Link>
          </m.div>
        )}
      </AnimatePresence>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label={expanded ? t('closeProgress') : t('openProgress')}
        title={expanded ? t('closeProgress') : t('openProgress')}
        className="ms-auto flex items-center gap-2 rounded-full border border-border/80 bg-card p-2 text-foreground shadow-lg transition hover:border-border-strong hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <ProgressRing value={percent} size={60} strokeWidth={5} />
        <m.span animate={{ rotate: expanded ? 180 : 0 }} transition={spring.smooth} className="me-1 flex text-muted-foreground">
          <ChevronUp className="size-4" />
        </m.span>
      </button>
    </div>
  );
}
