'use client';

import { useTranslations } from 'next-intl';
import { AlertCircle, ArrowLeft, Check, Eye, Languages, Loader2, Rocket, Save, Undo2 } from 'lucide-react';
import type { ContentLocale } from '@titan/shared';
import { cn } from '@/lib/utils';
import { type StepState, stepLabel } from './completeness';

export type StudioSaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export function StudioHeader({
  courseTitle,
  steps,
  step,
  setStep,
  locale,
  onLocaleChange,
  canPublish,
  isPublished,
  saveStatus,
  saveError,
  publishing,
  publishReasons,
  onBack,
  onSave,
  onRetrySave,
  onPublish,
  onUnpublish,
  onPreviewCourse,
  onPreviewLesson,
}: {
  courseTitle: string;
  steps: StepState[];
  step: string;
  setStep: (step: string) => void;
  locale: ContentLocale;
  onLocaleChange: (locale: ContentLocale) => void;
  canPublish: boolean;
  isPublished: boolean;
  saveStatus: StudioSaveStatus;
  saveError?: string | null;
  publishing: boolean;
  publishReasons?: string[];
  onBack: () => void;
  onSave: () => void;
  onRetrySave: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onPreviewCourse: () => void;
  onPreviewLesson: () => void;
}) {
  const t = useTranslations('courses');
  const tCommon = useTranslations('common');
  const saveLabel = saveStatus === 'saving'
    ? tCommon('saving', { default: 'Saving…' })
    : saveStatus === 'saved'
      ? tCommon('saved', { default: 'Saved' })
      : saveStatus === 'error'
        ? t('studio.retrySave', { default: 'Retry save' })
        : tCommon('save', { default: 'Save' });
  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-3 px-4 py-3 sm:px-6 lg:px-10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <button type="button" onClick={onBack} aria-label={t('studio.backToCourses', { default: 'Back to courses' })} className="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground active:scale-95">
              <ArrowLeft className="size-5 rtl:rotate-180" />
            </button>
            <div className="min-w-0">
              <h1 dir="auto" className="truncate text-13 font-semibold text-foreground">{t('studio.breadcrumb', { default: 'Courses' })} <span className="text-muted-foreground/60">/</span> <span className="text-foreground">{courseTitle}</span></h1>
              <p className="hidden truncate text-2xs text-muted-foreground sm:block">{t('studio.subtitle', { default: 'Build, localize, and publish with confidence' })}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden items-center rounded-xl border border-border bg-card p-1 sm:flex" role="group" aria-label={t('studio.editingLanguage', { default: 'Editing language' })}>
              {(['en', 'ar'] as ContentLocale[]).map((item) => (
                <button key={item} type="button" onClick={() => onLocaleChange(item)} className={cn('rounded-lg px-2.5 py-1.5 text-xs font-semibold transition', locale === item ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground')}>
                  {item === 'ar' ? 'العربية' : 'EN'}
                </button>
              ))}
            </div>
            <button type="button" onClick={onPreviewCourse} className="hidden h-9 items-center gap-1.5 rounded-xl border border-border bg-background px-3 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground sm:inline-flex">
              <Eye className="size-4" /> {tCommon('preview', { default: 'Preview' })}
            </button>
            <button type="button" onClick={onPreviewLesson} title={t('studio.previewFirstLesson', { default: 'Preview the first lesson' })} className="hidden h-9 items-center gap-1.5 rounded-xl border border-border bg-background px-3 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground lg:inline-flex">
              <Eye className="size-4" /> {t('lesson', { default: 'Lesson' })}
            </button>
            <button type="button" onClick={onSave} disabled={saveStatus === 'saving'} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50">
              {saveStatus === 'saving' ? <Loader2 className="size-4 animate-spin" /> : saveStatus === 'error' ? <Undo2 className="size-4" /> : saveStatus === 'saved' ? <Check className="size-4 text-success" /> : <Save className="size-4" />}
              <span className="hidden sm:inline">{saveLabel}</span>
            </button>
            {isPublished ? (
              <button type="button" onClick={onUnpublish} className="inline-flex h-9 items-center rounded-xl border border-border bg-background px-3 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground">{t('studio.unpublish', { default: 'Unpublish' })}</button>
            ) : (
              <button type="button" onClick={onPublish} disabled={!canPublish || publishing} title={publishReasons?.length ? publishReasons.join(' • ') : t('studio.publishCourse', { default: 'Publish course' })} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary disabled:cursor-not-allowed disabled:opacity-40">
                {publishing ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
                <span className="hidden sm:inline">{t('studio.publish', { default: 'Publish' })}</span>
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          <nav className="flex min-w-max flex-1 items-center gap-1 overflow-x-auto" aria-label={t('studio.stepsAria', { default: 'Course Studio steps' })}>
            {steps.map((item, index) => {
              const active = step === item.key;
              return (
                <div key={item.key} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setStep(item.key)}
                    aria-current={active ? 'step' : undefined}
                    className={cn(
                      'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold transition',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-5 items-center justify-center rounded-full text-[10px] font-bold transition',
                        item.done && 'bg-success/10 text-success',
                        !item.done && active && 'bg-primary/15 text-primary',
                        !item.done && !active && 'bg-muted text-muted-foreground ring-1 ring-border',
                      )}
                    >
                      {item.done ? <Check className="size-3" /> : index + 1}
                    </span>
                    {stepLabel(item, t)}
                    {item.advisory && !item.done && (
                      <span className="size-1 rounded-full bg-border-strong" aria-hidden />
                    )}
                  </button>
                  {index < steps.length - 1 && (
                    <span
                      aria-hidden
                      className={cn('mx-0.5 h-px w-3 shrink-0', item.done ? 'bg-success/40' : 'bg-border')}
                    />
                  )}
                </div>
              );
            })}
          </nav>
          <div className="flex shrink-0 items-center rounded-xl border border-border bg-card p-1 sm:hidden" role="group" aria-label={t('studio.editingLanguage', { default: 'Editing language' })}>
            <Languages className="mx-1 size-3.5 text-muted-foreground" />
            {(['en', 'ar'] as ContentLocale[]).map((item) => <button key={item} type="button" onClick={() => onLocaleChange(item)} className={cn('rounded-md px-2 py-1 text-[11px] font-semibold', locale === item ? 'bg-primary/10 text-primary' : 'text-muted-foreground')}>{item === 'ar' ? 'ع' : 'EN'}</button>)}
          </div>
        </div>
        {saveStatus === 'error' && <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive"><span className="flex min-w-0 items-center gap-2"><AlertCircle className="size-3.5 shrink-0" /><span className="truncate">{saveError || t('studio.saveFailed', { default: 'The last save failed.' })}</span></span><button type="button" onClick={onRetrySave} className="shrink-0 rounded-lg bg-destructive px-2.5 py-1 font-semibold text-destructive-foreground">{tCommon('retry', { default: 'Retry' })}</button></div>}
      </div>
    </header>
  );
}
