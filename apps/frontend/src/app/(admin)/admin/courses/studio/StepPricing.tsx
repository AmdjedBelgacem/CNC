'use client';
import { INPUT, LABEL } from './glass';
import type { AccessMode, CourseStudioData } from './types';
const MODES: { value: AccessMode; label: string; hint: string }[] = [
  { value: 'open', label: 'Open enrollment', hint: 'Any learner can enroll for free.' },
  { value: 'invite', label: 'Invite only', hint: 'Learners enroll by invitation or approval.' },
  { value: 'paid', label: 'Paid', hint: 'Requires a one-time purchase to enroll.' },
];
export function StepPricing({
  course,
  update,
}: {
  course: CourseStudioData;
  update: (patch: Partial<CourseStudioData>) => void;
}) {
  const priceDollars = course.priceCents != null ? (course.priceCents / 100).toString() : '';
  return (
    <div className="space-y-6">
      {' '}
      <div className="space-y-2">
        {' '}
        <label className={LABEL}>Access mode</label>{' '}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {' '}
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => update({ accessMode: m.value })}
              className={
                'rounded-xl border p-4 text-left transition ' +
                (course.accessMode === m.value
                  ? 'border-accent/60 bg-accent/10 shadow-sm'
                  : 'border-border bg-card hover:border-accent/30')
              }
            >
              {' '}
              <p className="font-sans text-sm font-semibold text-foreground">{m.label}</p>{' '}
              <p className="mt-1 font-sans text-xs text-muted-foreground">{m.hint}</p>{' '}
            </button>
          ))}{' '}
        </div>{' '}
      </div>{' '}
      {course.accessMode === 'paid' && (
        <div className="grid grid-cols-2 gap-4">
          {' '}
          <div className="space-y-1.5">
            {' '}
            <label className={LABEL}>Price (USD)</label>{' '}
            <input
              type="number"
              min={0}
              step="0.01"
              value={priceDollars}
              onChange={(e) =>
                update({
                  priceCents: e.target.value ? Math.round(Number(e.target.value) * 100) : 0,
                })
              }
              placeholder="49.00"
              className={INPUT}
            />{' '}
            {course.accessMode === 'paid' && (!course.priceCents || course.priceCents <= 0) && (
              <p className="font-sans text-xs text-red-600 dark:text-red-400">
                Set a price greater than 0 to publish.
              </p>
            )}{' '}
          </div>{' '}
          <div className="space-y-1.5">
            {' '}
            <label className={LABEL}>Currency</label>{' '}
            <input
              value={course.currency}
              onChange={(e) => update({ currency: e.target.value || 'USD' })}
              className={INPUT}
            />{' '}
          </div>{' '}
        </div>
      )}{' '}
      {course.accessMode === 'invite' && (
        <p className="rounded-xl border border-border bg-card px-4 py-3 font-sans text-sm text-muted-foreground">
          {' '}
          Invite-only courses won’t appear in open catalogs. Enrollment is granted manually or via
          invite links.{' '}
        </p>
      )}{' '}
    </div>
  );
}
