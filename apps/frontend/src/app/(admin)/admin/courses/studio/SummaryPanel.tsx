'use client';

import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Circle,
  Clock3,
  ImageOff,
  Lock,
  Sparkles,
} from 'lucide-react';
import { AnimatePresence, m } from 'framer-motion';
import { cn } from '@/lib/utils';
import { spring } from '@/lib/motion';
import { AnimatedNumber } from '@/components/ui/motion';
import { StatusPill } from '@/components/admin/admin-ui';
import { difficultyKey, difficultyTone, difficultyFallback } from '@/lib/difficulty';
import type { CourseStudioData } from './types';
import { type StepState, reasonToStep, stepLabel, stepHint } from './completeness';

/**
 * Right-hand rail for the Course Studio.
 *
 * Reads as a live card of the course being edited, then the state of the
 * checklist, then anything blocking a publish. The previous version put the
 * title next to a fixed-width thumbnail inside a `truncate` element, which cut
 * "Machining Titanium & Superalloys" down to "Machining Titanium & …" — the
 * title is the thing an editor most needs to read, so it now gets a full-width
 * line of its own and wraps instead of clipping.
 */
export function SummaryPanel({
  course,
  steps,
  saving,
  lastSavedAt,
  publishReasons,
  warnings = [],
  onJump,
}: {
  course: CourseStudioData;
  steps: StepState[];
  saving: boolean;
  lastSavedAt: number | null;
  publishReasons?: string[];
  warnings?: string[];
  onJump?: (step: number) => void;
}) {
  const t = useTranslations('courses.studio.summary');
  const tStudio = useTranslations('courses');
  const tDifficulty = useTranslations('admin');

  const totalLessons = course.series.reduce((count, section) => count + section.lessons.length, 0);
  const freePreviews = course.series.reduce(
    (count, section) => count + section.lessons.filter((lesson) => lesson.freePreview).length,
    0,
  );
  const doneCount = steps.filter((step) => step.done).length;
  const percent = steps.length ? Math.round((doneCount / steps.length) * 100) : 0;

  const status = course.isArchived
    ? { label: t('statusArchived'), tone: 'slate' as const }
    : course.isPublished
      ? { label: t('statusPublished'), tone: 'emerald' as const }
      : { label: t('statusDraft'), tone: 'amber' as const };

  const price =
    course.accessMode === 'paid' && course.priceCents != null
      ? new Intl.NumberFormat(undefined, {
          style: 'currency',
          currency: course.currency || 'SAR',
        }).format(course.priceCents / 100)
      : null;

  return (
    <div className="flex flex-col gap-5 overflow-hidden rounded-xl border border-border/70 bg-card pb-5 shadow-xs">
      {/* Live course card */}
      <div className="overflow-hidden border-b border-border/70">
        <div className="relative">
          {course.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={course.thumbnailUrl} alt="" className="h-36 w-full object-cover" />
          ) : (
            <div className="flex h-36 w-full flex-col items-center justify-center gap-1.5 bg-muted/50">
              <ImageOff className="size-5 text-muted-foreground/70" />
              <span className="text-2xs font-medium text-muted-foreground">
                {t('noImage', { default: 'No thumbnail yet' })}
              </span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/40 to-transparent" />
          <div className="absolute bottom-2 start-2 flex items-center gap-1.5">
            <StatusPill label={status.label} tone={status.tone} pulse={course.isPublished} />
          </div>
        </div>
        <div className="space-y-2 bg-card px-5 pb-1 pt-4">
          <p
            dir="auto"
            className="text-balance font-display text-lg font-medium leading-snug tracking-[-0.015em] text-foreground"
          >
            {course.title || t('untitled', { default: 'Untitled course' })}
          </p>
          <p dir="ltr" className="truncate font-mono text-2xs text-muted-foreground">
            /{course.slug || t('noSlug', { default: 'no-slug' })}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <StatusPill
              label={tDifficulty(difficultyKey(course.difficulty), {
                default: difficultyFallback(course.difficulty),
              })}
              tone={difficultyTone(course.difficulty)}
              dot={false}
            />
            <StatusPill
              label={t(`accessMode.${course.accessMode}`, { default: course.accessMode })}
              tone="blue"
              dot={false}
            />
            {price && <StatusPill label={price} tone="emerald" dot={false} />}
            {course.academy?.title && (
              <StatusPill label={course.academy.title} tone="purple" dot={false} />
            )}
          </div>
        </div>
      </div>

      {/* Guided checklist */}
      <div className="border-t border-border/70 pt-4">
        <div className="flex items-center justify-between gap-2 px-5">
          <p className="text-xs font-medium text-muted-foreground">
            {t('checklist', { default: 'Guided checklist' })}
          </p>
          <span className="flex items-center gap-2 text-2xs font-medium text-muted-foreground">
            <span className="flex items-center gap-1">
              {saving ? (
                <Clock3 className="size-3 animate-pulse" />
              ) : lastSavedAt ? (
                <Check className="size-3 text-success" />
              ) : null}
              {saving
                ? t('saving', { default: 'Saving…' })
                : lastSavedAt
                  ? t('saved', { default: 'Saved' })
                  : t('notSaved', { default: 'Not saved' })}
            </span>
            <span aria-hidden className="text-border-strong">
              ·
            </span>
            <span>{t('stepsDone', { done: doneCount, total: steps.length })}</span>
          </span>
        </div>
        <div className="mx-5 mt-2.5 h-1 overflow-hidden rounded-full bg-muted">
          <m.div
            className="h-full rounded-full bg-success"
            initial={false}
            animate={{ width: `${percent}%` }}
            transition={spring.gentle}
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        <ul className="mt-3 space-y-0.5 px-3">
          {steps.map((step) => {
            const hint = stepHint(step, tStudio);
            return (
              <li key={step.key}>
                <div
                  className={cn(
                    'flex items-start gap-2 rounded-lg px-2 py-1.5',
                    step.advisory && !step.done && 'opacity-80',
                  )}
                >
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                    <AnimatePresence mode="popLayout" initial={false}>
                      {step.done ? (
                        <m.span key="done" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={spring.snappy}>
                          <Check className="size-4 text-success" />
                        </m.span>
                      ) : (
                        <m.span key="todo" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={spring.snappy}>
                          <Circle className="size-3.5 text-muted-foreground/50" />
                        </m.span>
                      )}
                    </AnimatePresence>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'text-13 font-medium',
                        step.done ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {stepLabel(step, tStudio)}
                      {step.advisory && (
                        <span className="ms-1.5 align-middle text-2xs font-normal text-muted-foreground/80">
                          {t('optional', { default: 'optional' })}
                        </span>
                      )}
                    </p>
                    {hint && <p className="text-2xs leading-relaxed text-muted-foreground">{hint}</p>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Curriculum counts */}
      <div className="mx-5 grid grid-cols-3 divide-x divide-border/70 rounded-lg bg-muted/40 py-3 text-center rtl:divide-x-reverse">
        <div>
          <p className="font-display text-xl font-medium tabular-nums text-foreground"><AnimatedNumber value={course.series.length} animateOnChange durationSeconds={0.6} /></p>
          <p className="text-2xs text-muted-foreground">{t('sections', { default: 'Sections' })}</p>
        </div>
        <div>
          <p className="font-display text-xl font-medium tabular-nums text-foreground"><AnimatedNumber value={totalLessons} animateOnChange durationSeconds={0.6} /></p>
          <p className="text-2xs text-muted-foreground">{t('lessons', { default: 'Lessons' })}</p>
        </div>
        <div>
          <p className="font-display text-xl font-medium tabular-nums text-foreground"><AnimatedNumber value={freePreviews} animateOnChange durationSeconds={0.6} /></p>
          <p className="text-2xs text-muted-foreground">{t('previews', { default: 'Previews' })}</p>
        </div>
      </div>

      {/* Publish blockers: each one is a link to the step that fixes it. */}
      <AnimatePresence initial={false}>
      {!course.isPublished && publishReasons && publishReasons.length > 0 && (
        <m.div
          key="blockers"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0, transition: { duration: 0.18 } }}
          transition={spring.smooth} className="mx-5 overflow-hidden"><div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
            <Lock className="size-3.5" />
            {t('blockers', { count: publishReasons.length })}
          </div>
          <ul className="mt-2 space-y-1">
            {publishReasons.map((reason) => (
              <li key={reason}>
                <button
                  type="button"
                  onClick={() => onJump?.(reasonToStep(reason))}
                  className="group flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-start text-xs text-foreground/80 transition hover:bg-destructive/10"
                >
                  <span className="size-1.5 shrink-0 rounded-full bg-destructive" />
                  <span className="flex-1">{reason}</span>
                  <ArrowRight className="flip-rtl size-3.5 shrink-0 opacity-0 transition group-hover:opacity-60" />
                </button>
              </li>
            ))}
          </ul>
        </div></m.div>
      )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
      {!course.isPublished && warnings.length > 0 && (
        <m.div
          key="warnings"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0, transition: { duration: 0.18 } }}
          transition={spring.smooth} className="mx-5 overflow-hidden"><div className="rounded-lg border border-warning/25 bg-warning/5 p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-warning">
            {warnings.length > 0 ? <AlertTriangle className="size-3.5" /> : <Sparkles className="size-3.5" />}
            {t('optionalReview', { default: 'Optional review' })}
          </div>
          <ul className="mt-2 space-y-1.5">
            {warnings.slice(0, 3).map((warning) => (
              <li key={warning} className="text-xs leading-relaxed text-foreground/75">
                {warning}
              </li>
            ))}
          </ul>
        </div></m.div>
      )}
      </AnimatePresence>
    </div>
  );
}
