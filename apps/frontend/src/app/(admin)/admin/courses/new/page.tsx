'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ArrowRight,
  Check,
  GraduationCap,
  LayoutTemplate,
  Sparkles,
  Type,
  Wrench,
} from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { AnimatePresence, m } from 'framer-motion';
import { cn } from '@/lib/utils';
import { spring } from '@/lib/motion';
import { Reveal, Stagger, StaggerItem } from '@/components/ui/motion';
import { AdminCommandBar, AdminPageHeader } from '@/components/admin/admin-chrome';
import { FormSection, SelectField, TextField } from '@/components/admin/admin-form';
import { FormLayout, SaveDock, SlugField, StatusChip } from '@/components/admin/form-page';
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

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The "what happens next" rail: the three stages a new course moves through. */
function NextSteps() {
  const t = useTranslations('admin.coursesNew');
  const tStudio = useTranslations('courses.studio');
  const steps = [
    ['01', tStudio('steps.basics'), t('steps.basics.body')],
    ['02', tStudio('steps.curriculum'), t('steps.curriculum.body')],
    ['03', tStudio('steps.publish'), t('steps.publish.body')],
  ];
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/70 bg-card p-5 shadow-xs">
        <p className="font-display text-base font-medium tracking-[-0.012em] text-foreground">
          {t('nextTitle')}
        </p>
        <ol className="mt-4 space-y-4">
          {steps.map(([number, titleText, body]) => (
            <li key={number} className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-2xs font-medium text-primary">
                {number}
              </span>
              <div>
                <p className="text-13 font-medium text-foreground">{titleText}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <div className="rounded-xl border border-border/70 bg-muted/40 p-4">
        <p className="text-13 font-medium text-foreground">{t('guidedTitle')}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t('guidedBody')}</p>
      </div>
    </div>
  );
}

export default function NewCoursePage() {
  const router = useRouter();
  const t = useTranslations('admin.coursesNew');
  const tAdmin = useTranslations('admin');
  const tCourses = useTranslations('admin.coursesPage');
  const tForm = useTranslations('ui.adminForm');
  const tStudio = useTranslations('courses.studio');
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [academyId, setAcademyId] = useState('');
  const [template, setTemplate] = useState<(typeof templates)[number]['id']>('blank');
  const [academies, setAcademies] = useState<AcademyOption[]>([]);
  const [loadingAcademies, setLoadingAcademies] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Errors only appear after the first attempt, so the form is not red on arrival.
  const [attempted, setAttempted] = useState(false);

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
  const titleMissing = !title.trim();
  const slugInvalid = !SLUG_RE.test(normalizedSlug);
  const canSave = title.trim().length > 1 && normalizedSlug.length > 1;

  const submit = async () => {
    if (submitting) return;
    setAttempted(true);
    setError(null);
    if (titleMissing || slugInvalid) {
      document.getElementById('basics')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setSubmitting(true);
    setFailed(false);
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
      setFailed(true);
      setError(message);
      toast({ type: 'err', title: t('createFailed'), description: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      className="w-full"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {/* Gives Enter in a text field something to submit; Save itself lives in the dock. */}
      <button type="submit" tabIndex={-1} aria-hidden="true" className="sr-only" />
      <AdminCommandBar
        trail={[
          { label: tAdmin('courses'), href: '/admin/courses' },
          { label: t('createTitle') },
        ]}
        // A course that does not exist yet is not "Live"; the header carries a `New` chip.
        live={false}
      />

      <div className="space-y-6 pt-6">
        <div className="mx-auto w-full max-w-6xl">
          <AdminPageHeader
            title={t('createTitle')}
            description={t('subtitle')}
            badge={<StatusChip tone="new">{tForm('statusNew')}</StatusChip>}
          />
        </div>

        <FormLayout aside={<NextSteps />}>
          <Reveal>
            <FormSection id="basics" icon={Type} title={t('basicsTitle')} description={t('basicsHint')}>
              <div className="space-y-5">
                <TextField
                  label={t('titleLabel')}
                  required
                  autoFocus
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={tStudio('titlePlaceholder')}
                  hint={t('titleHint')}
                  error={attempted && titleMissing ? t('errTitleRequired') : undefined}
                />
                <SlugField
                  label={t('slugLabel')}
                  value={slug}
                  onChange={setSlug}
                  prefix="/courses/"
                  source={title}
                  mode="create"
                  hint={t('slugHint')}
                  error={attempted && !titleMissing && slugInvalid ? t('errInvalidSlug') : undefined}
                />
                <SelectField
                  label={tCourses('academyLabel')}
                  hint={t('academyHint')}
                  value={academyId}
                  onChange={(event) => setAcademyId(event.target.value)}
                  disabled={loadingAcademies}
                >
                  <option value="">
                    {loadingAcademies ? t('loadingAcademies') : t('noAcademyOption')}
                  </option>
                  {academies.map((academy) => (
                    <option key={academy.id} value={academy.id}>
                      {academy.title}
                    </option>
                  ))}
                </SelectField>
              </div>
            </FormSection>
          </Reveal>

          <Reveal delay={0.04}>
            <FormSection
              id="start"
              icon={LayoutTemplate}
              title={t('chooseTemplate')}
              description={t('startHint')}
              badge={tForm('optional')}
            >
              <Stagger className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label={t('chooseTemplate')}>
                {templates.map((item, index) => {
                  const Icon = item.icon;
                  const active = template === item.id;
                  return (
                    <StaggerItem key={item.id} index={index}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setTemplate(item.id)}
                        className={cn(
                          'pressable relative h-full w-full rounded-xl border bg-card p-4 text-start transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                          active
                            ? 'border-primary/40 shadow-sm'
                            : 'border-border/80 hover:border-border-strong hover:shadow-sm',
                        )}
                      >
                        {active && (
                          <m.span
                            layoutId="new-course-template"
                            transition={spring.smooth}
                            className="absolute inset-0 rounded-xl bg-primary/5 ring-1 ring-primary/30"
                            aria-hidden
                          />
                        )}
                        <AnimatePresence>
                          {active && (
                            <m.span
                              key="check"
                              initial={{ scale: 0.4, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.4, opacity: 0 }}
                              transition={spring.snappy}
                              className="absolute end-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                            >
                              <Check className="size-3.5" />
                            </m.span>
                          )}
                        </AnimatePresence>
                        <span
                          className={cn(
                            'relative mb-3 flex size-9 items-center justify-center rounded-full',
                            item.tone,
                          )}
                        >
                          <Icon className="size-4" />
                        </span>
                        <span className="relative block font-display text-base font-medium tracking-[-0.01em] text-foreground">
                          {t(item.nameKey)}
                        </span>
                        <span className="relative mt-1 block text-xs leading-relaxed text-muted-foreground">
                          {t(item.descriptionKey)}
                        </span>
                      </button>
                    </StaggerItem>
                  );
                })}
              </Stagger>
            </FormSection>
          </Reveal>

          <AnimatePresence initial={false}>
            {error && (
              <m.div
                key="error"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={spring.smooth}
                className="overflow-hidden"
              >
                <div
                  role="alert"
                  className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive"
                >
                  {error}
                </div>
              </m.div>
            )}
          </AnimatePresence>

          {/* Below xl the rail is hidden, so the same guidance follows the form. */}
          <div className="xl:hidden">
            <Reveal delay={0.08}>
              <NextSteps />
            </Reveal>
          </div>
        </FormLayout>
      </div>

      <SaveDock
        mode="create"
        saving={submitting}
        failed={failed}
        canSave={canSave}
        onSave={() => void submit()}
        onCancel={() => router.push('/admin/courses')}
        saveLabel={
          submitting ? (
            t('creating')
          ) : (
            <span className="inline-flex items-center gap-2">
              {t('submitLabel')}
              <ArrowRight className="size-4 rtl:rotate-180" />
            </span>
          )
        }
        savingLabel={t('creating')}
      />
    </form>
  );
}
