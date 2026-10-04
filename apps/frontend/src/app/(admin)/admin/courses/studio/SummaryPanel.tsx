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
import { cn } from '@/lib/utils';
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
    <div className="flex flex-col gap-5 rounded-xl border border-border bg-card shadow-xs">
      {/* Live course card */}
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="relative">
          {course.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={course.thumbnailUrl} alt="" className="h-32 w-full object-cover" />
          ) : (
            <div className="flex h-32 w-full flex-col items-center justify-center gap-1.5 bg-muted/60">
              <ImageOff className="size-5 text-muted-foreground/70" />
              <span className="text-2xs font-semibold text-muted-foreground">
                {t('noImage', { default: 'No thumbnail yet' })}
              </span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-2 start-2 flex items-center gap-1.5">
            <StatusPill label={status.label} tone={status.tone} pulse={course.isPublished} />
          </div>
        </div>
        <div className="space-y-2 bg-card p-4">
          <p
            dir="auto"
            className="font-display text-15 font-semibold leading-snug text-foreground"
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
      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between gap-2 px-4">
          <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('checklist', { default: 'Guided checklist' })}
          </p>
          <span className="flex items-center gap-2 text-2xs font-semibold text-muted-foreground">
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
        <div className="mx-4 mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-success transition-[width] duration-500"
            style={{ width: `${percent}%` }}
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        <ul className="mt-3 space-y-0.5 px-2">
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
                  {step.done ? (
                    <Check className="mt-0.5 size-4 shrink-0 text-success" />
                  ) : (
                    <Circle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50" />
                  )}
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
      <div className="grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
        <div>
          <p className="font-display text-xl font-semibold text-foreground">{course.series.length}</p>
          <p className="text-2xs text-muted-foreground">{t('sections', { default: 'Sections' })}</p>
        </div>
        <div>
          <p className="font-display text-xl font-semibold text-foreground">{totalLessons}</p>
          <p className="text-2xs text-muted-foreground">{t('lessons', { default: 'Lessons' })}</p>
        </div>
        <div>
          <p className="font-display text-xl font-semibold text-foreground">{freePreviews}</p>
          <p className="text-2xs text-muted-foreground">{t('previews', { default: 'Previews' })}</p>
        </div>
      </div>

      {/* Publish blockers: each one is a link to the step that fixes it. */}
      {!course.isPublished && publishReasons && publishReasons.length > 0 && (
        <div className="mx-4 mb-4 rounded-xl border border-destructive/25 bg-destructive/8 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
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
        </div>
      )}

      {!course.isPublished && warnings.length > 0 && (
        <div className="mx-4 mb-4 rounded-xl border border-warning/30 bg-warning/8 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-warning">
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
        </div>
      )}
    </div>
  );
}
