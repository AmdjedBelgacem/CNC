'use client';

import { useTranslations } from 'next-intl';
import { AlertCircle, ArrowLeft, Check, Eye, Languages, Loader2, Rocket, Save, Undo2 } from 'lucide-react';
import type { ContentLocale } from '@titan/shared';
import { AnimatePresence, m } from 'framer-motion';
import { cn } from '@/lib/utils';
import { spring } from '@/lib/motion';
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
  const statusKey = saveStatus === 'saving' ? 'saving' : saveStatus === 'saved' ? 'saved' : saveStatus === 'error' ? 'error' : 'idle';
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-3 px-4 pb-2.5 pt-3 sm:px-6 lg:px-10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <button type="button" onClick={onBack} aria-label={t('studio.backToCourses', { default: 'Back to courses' })} className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground active:scale-95">
              <ArrowLeft className="size-[18px] rtl:rotate-180" />
            </button>
            <div className="min-w-0">
              <h1 dir="auto" className="flex min-w-0 items-baseline gap-1.5">
                <span className="hidden shrink-0 text-xs font-medium text-muted-foreground sm:inline">{t('studio.breadcrumb', { default: 'Courses' })}</span>
                <span className="hidden text-muted-foreground/40 sm:inline" aria-hidden>/</span>
                <span className="truncate font-display text-lg font-medium leading-tight tracking-[-0.015em] text-foreground">{courseTitle}</span>
              </h1>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">{t('studio.subtitle', { default: 'Build, localize, and publish with confidence' })}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden items-center rounded-lg border border-border/70 bg-muted/50 p-0.5 sm:flex" role="group" aria-label={t('studio.editingLanguage', { default: 'Editing language' })}>
              {(['en', 'ar'] as ContentLocale[]).map((item) => (
                <button key={item} type="button" onClick={() => onLocaleChange(item)} aria-pressed={locale === item} className={cn('relative rounded-md px-2.5 py-1 text-xs font-medium transition-colors', locale === item ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                  {locale === item && <m.span layoutId="studio-locale-pill" transition={spring.snappy} className="absolute inset-0 rounded-md bg-card shadow-xs ring-1 ring-border/70" aria-hidden />}
                  <span className="relative">{item === 'ar' ? 'العربية' : 'EN'}</span>
                </button>
              ))}
            </div>
            <button type="button" onClick={onPreviewCourse} className="hidden h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground sm:inline-flex">
              <Eye className="size-4" /> {tCommon('preview', { default: 'Preview' })}
            </button>
            <button type="button" onClick={onPreviewLesson} title={t('studio.previewFirstLesson', { default: 'Preview the first lesson' })} className="hidden h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground lg:inline-flex">
              <Eye className="size-4" /> {t('lesson', { default: 'Lesson' })}
            </button>
            <span className="mx-0.5 hidden h-5 w-px bg-border sm:block" aria-hidden />
            <button type="button" onClick={onSave} disabled={saveStatus === 'saving'} className={cn('inline-flex h-9 items-center gap-1.5 overflow-hidden rounded-lg border bg-card px-3 text-xs font-medium shadow-xs transition hover:border-border-strong hover:bg-muted/60 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60', saveStatus === 'error' ? 'border-destructive/30 text-destructive' : 'border-border/80 text-foreground')}>
              <AnimatePresence mode="popLayout" initial={false}>
                <m.span
                  key={statusKey}
                  initial={{ opacity: 0, y: 6, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.9 }}
                  transition={spring.snappy}
                  className="flex items-center gap-1.5"
                >
                  {saveStatus === 'saving' ? <Loader2 className="size-4 animate-spin" /> : saveStatus === 'error' ? <Undo2 className="size-4" /> : saveStatus === 'saved' ? <Check className="size-4 text-success" /> : <Save className="size-4" />}
                  <span className="hidden sm:inline">{saveLabel}</span>
                </m.span>
              </AnimatePresence>
            </button>
            <AnimatePresence mode="popLayout" initial={false}>
              {isPublished ? (
                <m.button key="unpublish" type="button" onClick={onUnpublish} initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }} transition={spring.smooth} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 text-xs font-medium text-muted-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground">
                  <span className="size-1.5 rounded-full bg-success" aria-hidden />
                  {t('studio.unpublish', { default: 'Unpublish' })}
                </m.button>
              ) : (
                <m.button key="publish" type="button" onClick={onPublish} disabled={!canPublish || publishing} title={publishReasons?.length ? publishReasons.join(' • ') : t('studio.publishCourse', { default: 'Publish course' })} initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }} whileTap={canPublish && !publishing ? { scale: 0.97 } : undefined} transition={spring.smooth} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-medium text-primary-foreground shadow-sm transition-[background-color,box-shadow,opacity] hover:bg-primary/90 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none">
                  {publishing ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
                  <span className="hidden sm:inline">{t('studio.publish', { default: 'Publish' })}</span>
                </m.button>
              )}
            </AnimatePresence>
          </div>
        </div>
        <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-0.5">
          <nav className="flex min-w-max flex-1 items-center gap-0.5 overflow-x-auto" aria-label={t('studio.stepsAria', { default: 'Course Studio steps' })}>
            {steps.map((item, index) => {
              const active = step === item.key;
              return (
                <div key={item.key} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setStep(item.key)}
                    aria-current={active ? 'step' : undefined}
                    className={cn(
                      'relative inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                      active ? 'text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                    )}
                  >
                    {active && (
                      <m.span layoutId="studio-step-pill" transition={spring.smooth} className="absolute inset-0 rounded-lg bg-card shadow-xs ring-1 ring-border/80" aria-hidden />
                    )}
                    <span
                      className={cn(
                        'relative flex size-5 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums transition-colors',
                        item.done && 'bg-success/10 text-success',
                        !item.done && active && 'bg-primary text-primary-foreground',
                        !item.done && !active && 'bg-muted text-muted-foreground ring-1 ring-border/80',
                      )}
                    >
                      <AnimatePresence mode="popLayout" initial={false}>
                        <m.span key={item.done ? 'done' : 'num'} initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} transition={spring.snappy} className="flex items-center justify-center">
                          {item.done ? <Check className="size-3" /> : index + 1}
                        </m.span>
                      </AnimatePresence>
                    </span>
                    <span className="relative">{stepLabel(item, t)}</span>
                    {item.advisory && !item.done && (
                      <span className="relative size-1 rounded-full bg-border-strong" aria-hidden />
                    )}
                  </button>
                  {index < steps.length - 1 && (
                    <span
                      aria-hidden
                      className={cn('mx-0.5 h-px w-3 shrink-0 transition-colors duration-500', item.done ? 'bg-success/40' : 'bg-border')}
                    />
                  )}
                </div>
              );
            })}
          </nav>
          <div className="flex shrink-0 items-center rounded-lg border border-border/70 bg-muted/50 p-0.5 sm:hidden" role="group" aria-label={t('studio.editingLanguage', { default: 'Editing language' })}>
            <Languages className="mx-1 size-3.5 text-muted-foreground" />
            {(['en', 'ar'] as ContentLocale[]).map((item) => (
              <button key={item} type="button" onClick={() => onLocaleChange(item)} aria-pressed={locale === item} className={cn('relative rounded-md px-2 py-1 text-[11px] font-medium', locale === item ? 'text-foreground' : 'text-muted-foreground')}>
                {locale === item && <m.span layoutId="studio-locale-pill-sm" transition={spring.snappy} className="absolute inset-0 rounded-md bg-card shadow-xs ring-1 ring-border/70" aria-hidden />}
                <span className="relative">{item === 'ar' ? 'ع' : 'EN'}</span>
              </button>
            ))}
          </div>
        </div>
        <AnimatePresence initial={false}>
          {saveStatus === 'error' && (
            <m.div
              key="save-error"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={spring.smooth}
              className="overflow-hidden"
            >
              <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive"><span className="flex min-w-0 items-center gap-2"><AlertCircle className="size-3.5 shrink-0" /><span className="truncate">{saveError || t('studio.saveFailed', { default: 'The last save failed.' })}</span></span><button type="button" onClick={onRetrySave} className="shrink-0 rounded-md bg-destructive px-2.5 py-1 font-medium text-destructive-foreground transition hover:bg-destructive/90">{tCommon('retry', { default: 'Retry' })}</button></div>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
