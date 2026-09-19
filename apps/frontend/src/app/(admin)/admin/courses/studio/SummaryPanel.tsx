'use client';
import { Check, Circle, ArrowRight, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GLASS } from './glass';
import type { CourseStudioData } from './types';
import { type StepState, reasonToStep } from './completeness';
function statusPill(c: CourseStudioData) {
  if (c.isArchived)
    return { label: 'Archived', cls: 'bg-muted text-muted-foreground dark:text-muted-foreground' };
  if (c.isPublished)
    return { label: 'Published', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' };
  return { label: 'Draft', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' };
}
export function SummaryPanel({
  course,
  steps,
  saving,
  lastSavedAt,
  publishReasons,
  onJump,
}: {
  course: CourseStudioData;
  steps: StepState[];
  saving: boolean;
  lastSavedAt: number | null;
  publishReasons?: string[];
  onJump?: (step: number) => void;
}) {
  const totalLessons = course.series.reduce((n, s) => n + s.lessons.length, 0);
  const freePreviews = course.series.reduce(
    (n, s) => n + s.lessons.filter((l) => l.freePreview).length,
    0,
  );
  const pill = statusPill(course);
  const doneCount = steps.filter((s) => s.done).length;
  return (
    <div className={cn(GLASS, 'flex flex-col gap-5 rounded-xl p-5')}>
      {' '}
      <div className="flex items-center gap-3">
        {' '}
        {course.thumbnailUrl /* eslint-disable-next-line @next/next/no-img-element */ ? (
          <img
            src={course.thumbnailUrl}
            alt=""
            className="h-14 w-20 rounded-xl object-cover shadow-sm"
          />
        ) : (
          <span className="flex h-14 w-20 items-center justify-center rounded-xl bg-transparent text-muted-foreground">
            {' '}
            No image{' '}
          </span>
        )}{' '}
        <div className="min-w-0">
          {' '}
          <p className="truncate font-display text-lg font-semibold text-foreground">
            {course.title || 'Untitled course'}
          </p>{' '}
          <p className="truncate font-mono text-xs text-muted-foreground">
            /{course.slug || 'slug'}
          </p>{' '}
        </div>{' '}
      </div>{' '}
      <div className="flex items-center justify-between">
        {' '}
        <span className={cn('rounded-md px-2.5 py-0.5 font-sans text-xs font-semibold', pill.cls)}>
          {pill.label}
        </span>{' '}
        <span className="font-sans text-xs text-muted-foreground">
          {' '}
          {saving ? 'Saving…' : lastSavedAt ? 'Saved' : 'Not saved yet'}{' '}
        </span>{' '}
      </div>{' '}
      <div>
        {' '}
        <p className="mb-2 font-sans text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Completeness
        </p>{' '}
        <ul className="space-y-1.5">
          {' '}
          {steps.map((s) => (
            <li key={s.key} className="flex items-center gap-2 font-sans text-sm">
              {' '}
              {s.done ? (
                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Circle className="h-3.5 w-3.5 text-muted-foreground/50" />
              )}{' '}
              <span className={s.done ? 'text-foreground' : 'text-muted-foreground'}>
                {s.label}
              </span>{' '}
            </li>
          ))}{' '}
        </ul>{' '}
      </div>{' '}
      <div className="grid grid-cols-3 gap-2 border-t border-border pt-4 font-sans text-center">
        {' '}
        <div>
          {' '}
          <p className="font-display text-xl font-semibold text-foreground">
            {course.series.length}
          </p>{' '}
          <p className="text-xs text-muted-foreground">Sections</p>{' '}
        </div>{' '}
        <div>
          {' '}
          <p className="font-display text-xl font-semibold text-foreground">{totalLessons}</p>{' '}
          <p className="text-xs text-muted-foreground">Lessons</p>{' '}
        </div>{' '}
        <div>
          {' '}
          <p className="font-display text-xl font-semibold text-foreground">{freePreviews}</p>{' '}
          <p className="text-xs text-muted-foreground">Previews</p>{' '}
        </div>{' '}
      </div>{' '}
      <div className="border-t border-border pt-4 font-sans text-sm">
        {' '}
        <p className="text-muted-foreground">Access</p>{' '}
        <p className="mt-0.5 font-medium capitalize text-foreground">
          {' '}
          {course.accessMode}{' '}
          {course.accessMode === 'paid' && course.priceCents != null
            ? ` · $${(course.priceCents / 100).toFixed(2)}`
            : ''}{' '}
        </p>{' '}
      </div>{' '}
      <div className="font-sans text-xs text-muted-foreground">
        {' '}
        {doneCount}/{steps.length} steps complete{' '}
      </div>{' '}
      {!course.isPublished && publishReasons && publishReasons.length > 0 && (
        <div className="rounded-xl border border-amber-300/50 bg-amber-500/5 p-3 dark:border-amber-500/30">
          {' '}
          <div className="flex items-center gap-1.5 font-sans text-xs font-semibold text-amber-700 dark:text-amber-400">
            {' '}
            <Lock className="h-3.5 w-3.5" /> {publishReasons.length} before you can publish{' '}
          </div>{' '}
          <ul className="mt-2 space-y-1">
            {' '}
            {publishReasons.map((reason, i) => (
              <li key={i}>
                {' '}
                <button
                  type="button"
                  onClick={() => onJump?.(reasonToStep(reason))}
                  className="group flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-left font-sans text-xs text-foreground/80 transition hover:bg-amber-500/10"
                >
                  {' '}
                  <span className="h-1.5 w-1.5 shrink-0 rounded-md bg-amber-500" />{' '}
                  <span className="flex-1">{reason}</span>{' '}
                  <ArrowRight className="h-3 w-3 shrink-0 opacity-0 transition group-hover:opacity-60" />{' '}
                </button>{' '}
              </li>
            ))}{' '}
          </ul>{' '}
        </div>
      )}{' '}
    </div>
  );
}
