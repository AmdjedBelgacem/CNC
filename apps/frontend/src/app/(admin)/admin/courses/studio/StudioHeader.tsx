'use client';
import { ArrowLeft, Save, Rocket, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StepState } from './completeness';
export function StudioHeader({
  steps,
  step,
  setStep,
  canPublish,
  isPublished,
  saving,
  publishReasons,
  onBack,
  onSave,
  onPublish,
  onUnpublish,
}: {
  steps: StepState[];
  step: number;
  setStep: (i: number) => void;
  canPublish: boolean;
  isPublished: boolean;
  saving: boolean;
  publishReasons?: string[];
  onBack: () => void;
  onSave: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 -mx-4 -mt-4 border-b border-border/80 bg-background/85 backdrop-blur-xl transition-shadow duration-300 sm:-mx-6 sm:-mt-6 lg:-ml-20 lg:-mr-8 lg:-mt-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6 lg:px-10 lg:py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to courses"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground active:scale-95"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="truncate text-[18px] font-semibold tracking-tight text-foreground">
              Course Studio
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-background px-3.5 text-[13px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground active:scale-[0.98] disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
            </button>
            {isPublished ? (
              <button
                type="button"
                onClick={onUnpublish}
                className="inline-flex h-9 items-center rounded-xl border border-border bg-background px-3.5 text-[13px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground active:scale-[0.98]"
              >
                Unpublish
              </button>
            ) : (
              <div className="flex items-center gap-2">
                {!canPublish && publishReasons && publishReasons.length > 0 && (
                  <span
                    title={publishReasons.join('\n')}
                    className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-100"
                  >
                    <AlertCircle className="h-3.5 w-3.5" /> {publishReasons.length} to publish
                  </span>
                )}
                <button
                  type="button"
                  onClick={onPublish}
                  disabled={!canPublish}
                  title={
                    canPublish
                      ? 'Publish course'
                      : publishReasons && publishReasons.length
                        ? publishReasons.join(' • ')
                        : 'Complete all steps to publish'
                  }
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-[13px] font-semibold text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.98] disabled:opacity-40"
                >
                  <Rocket className="h-4 w-4" /> Publish
                </button>
              </div>
            )}
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
          {steps.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setStep(i)}
              className={cn(
                'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-medium transition',
                i === step
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold',
                  s.done
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100'
                    : 'bg-background text-muted-foreground ring-1 ring-border',
                )}
              >
                {i + 1}
              </span>
              {s.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
