'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  GraduationCap,
  LayoutTemplate,
  Loader2,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { AnimatePresence, m } from 'framer-motion';
import { cn } from '@/lib/utils';
import { spring } from '@/lib/motion';
import { Reveal, Stagger, StaggerItem } from '@/components/ui/motion';
import * as api from '../studio/api';
import { slugify } from '../studio/slugify';

interface AcademyOption {
  id: string;
  slug: string;
  title: string;
}

const templates = [
  {
    id: 'blank',
    nameKey: 'templates.blank.name',
    descriptionKey: 'templates.blank.description',
    icon: Sparkles,
    tone: 'bg-primary/10 text-primary',
  },
  {
    id: 'workshop',
    nameKey: 'templates.workshop.name',
    descriptionKey: 'templates.workshop.description',
    icon: Wrench,
    tone: 'bg-warning/10 text-warning',
  },
  {
    id: 'academy',
    nameKey: 'templates.academy.name',
    descriptionKey: 'templates.academy.description',
    icon: GraduationCap,
    tone: 'bg-info/10 text-info',
  },
] as const;

export default function NewCoursePage() {
  const router = useRouter();
  const t = useTranslations('admin.coursesNew');
  const tCommon = useTranslations('common');
  const tCourses = useTranslations('admin.coursesPage');
  const tStudio = useTranslations('courses.studio');
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [academyId, setAcademyId] = useState('');
  const [template, setTemplate] = useState<(typeof templates)[number]['id']>('blank');
  const [academies, setAcademies] = useState<AcademyOption[]>([]);
  const [loadingAcademies, setLoadingAcademies] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/proxy/admin/academies?limit=100', {
          credentials: 'include',
        });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && Array.isArray(data?.items)) {
          setAcademies(
            data.items.map((item: AcademyOption) => ({
              id: item.id,
              slug: item.slug,
              title: item.title,
            })),
          );
        }
      } catch {
        if (!cancelled) setAcademies([]);
      } finally {
        if (!cancelled) setLoadingAcademies(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const normalizedSlug = useMemo(() => slugify(slug || title), [slug, title]);
  const canSubmit = title.trim().length > 1 && normalizedSlug.length > 1 && !submitting;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError(t('errTitleRequired'));
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug)) {
      setError(t('errInvalidSlug'));
      return;
    }
    setSubmitting(true);
    try {
      const created = await api.createDraft({
        title: title.trim(),
        slug: normalizedSlug,
        academyId: academyId || undefined,
        metadata: template === 'blank' ? undefined : { template },
      });
      toast({ type: 'ok', title: t('draftCreated') });
      router.push(`/admin/courses/${created.slug}/edit?step=basics`);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : t('createFailedFallback');
      setError(message);
      toast({ type: 'err', title: t('createFailed'), description: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <button
          type="button"
          onClick={() => router.push('/admin/courses')}
          className="group inline-flex items-center gap-2 rounded-lg px-2 py-1 -ms-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5 rtl:rotate-180 rtl:group-hover:translate-x-0.5" />
          {tStudio('backToCourses')}
        </button>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <Reveal><form onSubmit={submit} className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm sm:p-10">
            <div className="flex items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <BookOpen className="size-6" />
              </span>
              <div>
                <p className="eyebrow">{tStudio('title')}</p>
                <h1 className="mt-2 text-balance font-display text-3xl font-medium tracking-[-0.022em] text-foreground sm:text-4xl">{t('createTitle')}</h1>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  {t('subtitle')}
                </p>
              </div>
            </div>

            <div className="mt-10 space-y-7">
              <div className="space-y-2">
                <label htmlFor="course-title" className="text-sm font-medium text-foreground">{t('titleLabel')} <span className="text-destructive">*</span></label>
                <input
                  id="course-title"
                  autoFocus
                  value={title}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    if (!slugTouched) setSlug(slugify(event.target.value));
                  }}
                  placeholder={tStudio('titlePlaceholder')}
                  className="h-12 w-full rounded-lg border border-input bg-background px-4 font-display text-lg text-foreground outline-none transition placeholder:font-sans placeholder:text-base placeholder:text-muted-foreground/60 hover:border-border-strong focus:border-primary/60 focus:ring-2 focus:ring-primary/15"
                />
                <p className="text-xs text-muted-foreground">{t('titleHint')}</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="course-slug" className="text-sm font-medium text-foreground">{t('slugLabel')} <span className="text-destructive">*</span></label>
                <div className="flex h-12 items-center rounded-lg border border-input bg-background px-4 transition hover:border-border-strong focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15">
                  <span className="shrink-0 font-mono text-sm text-muted-foreground">/courses/</span>
                  <input
                    id="course-slug"
                    value={slugTouched ? slug : normalizedSlug}
                    onChange={(event) => {
                      setSlugTouched(true);
                      setSlug(slugify(event.target.value));
                    }}
                    className="min-w-0 flex-1 bg-transparent ps-1 font-mono text-sm text-foreground outline-none"
                    placeholder="cnc-milling-fundamentals"
                  />
                </div>
                <p className="text-xs text-muted-foreground">{t('slugHint')}</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="course-academy" className="text-sm font-medium text-foreground">{tCourses('academyLabel')}</label>
                <select
                  id="course-academy"
                  value={academyId}
                  onChange={(event) => setAcademyId(event.target.value)}
                  disabled={loadingAcademies}
                  className="h-12 w-full rounded-lg border border-input bg-background px-4 text-sm text-foreground outline-none transition hover:border-border-strong focus:border-primary/60 focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
                >
                  <option value="">{loadingAcademies ? t('loadingAcademies') : t('noAcademyOption')}</option>
                  {academies.map((academy) => (
                    <option key={academy.id} value={academy.id}>{academy.title}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">{t('academyHint')}</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <LayoutTemplate className="size-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">{t('chooseTemplate')}</span>
                </div>
                <Stagger className="grid gap-3 sm:grid-cols-3">
                  {templates.map((item, index) => {
                    const Icon = item.icon;
                    const active = template === item.id;
                    return (
                      <StaggerItem key={item.id} index={index}>
                      <button
                        type="button"
                        onClick={() => setTemplate(item.id)}
                        aria-pressed={active}
                        className={cn(
                          'relative h-full w-full rounded-xl border p-4 text-start transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                          active ? 'border-primary/40 shadow-sm' : 'border-border/80 bg-background hover:border-border-strong hover:shadow-sm',
                        )}
                      >
                        {active && <m.span layoutId="new-course-template" transition={spring.smooth} className="absolute inset-0 rounded-xl bg-primary/5 ring-1 ring-primary/30" aria-hidden />}
                        <AnimatePresence>
                          {active && <m.span key="check" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={spring.snappy} className="absolute end-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="size-3.5" /></m.span>}
                        </AnimatePresence>
                        <span className={cn('relative mb-3 flex size-9 items-center justify-center rounded-full', item.tone)}><Icon className="size-4" /></span>
                        <span className="relative block font-display text-base font-medium tracking-[-0.01em] text-foreground">{t(item.nameKey)}</span>
                        <span className="relative mt-1 block text-xs leading-relaxed text-muted-foreground">{t(item.descriptionKey)}</span>
                      </button>
                      </StaggerItem>
                    );
                  })}
                </Stagger>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {error && (
                <m.div key="error" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={spring.smooth} className="overflow-hidden">
                  <div role="alert" className="mt-6 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
                    {error}
                  </div>
                </m.div>
              )}
            </AnimatePresence>

            <div className="mt-10 flex flex-col-reverse gap-3 border-t border-border/70 pt-6 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => router.push('/admin/courses')} className="h-11 rounded-lg px-5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">{tCommon('cancel')}</button>
              <button type="submit" disabled={!canSubmit} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none">
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4 rtl:rotate-180" />}
                {submitting ? t('creating') : t('submitLabel')}
              </button>
            </div>
          </form></Reveal>

          <Reveal from="end" delay={0.08} className="lg:sticky lg:top-8"><aside className="space-y-4">
            <div className="rounded-xl border border-border/70 bg-card p-6 shadow-xs">
              <p className="font-display text-lg font-medium tracking-[-0.012em] text-foreground">{t('nextTitle')}</p>
              <ol className="mt-5 space-y-5">
                {[
                  ['01', tStudio('steps.basics'), t('steps.basics.body')],
                  ['02', tStudio('steps.curriculum'), t('steps.curriculum.body')],
                  ['03', tStudio('steps.publish'), t('steps.publish.body')],
                ].map(([number, titleText, body]) => (
                  <li key={number} className="flex gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-xs font-medium text-primary">{number}</span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{titleText}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/40 p-5 text-sm">
              <p className="font-medium text-foreground">{t('guidedTitle')}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t('guidedBody')}</p>
            </div>
          </aside></Reveal>
        </div>
      </div>
    </div>
  );
}
