'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ease, spring } from '@/lib/motion';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api-client';
import { EMAIL_CATEGORY_LABELS, type EmailCategory, type EmailTemplateSummary } from '@titan/shared';
import { useRouter } from 'next/navigation';
import { AdminCommandBar, AdminPageHeader, BarPrimaryButton } from '@/components/admin/admin-chrome';
import { FormSection, SelectField, TextField } from '@/components/admin/admin-form';
import { SlugField, StatusChip, slugify as kitSlugify } from '@/components/admin/form-page';
import { EmptyState } from '@/components/ui/states';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { AlertTriangle, ChevronRight, Loader2, Mail, Plus, ShieldAlert } from 'lucide-react';

const CATEGORIES = Object.keys(EMAIL_CATEGORY_LABELS) as EmailCategory[];

/** Explicit map rather than a template string, so the runtime-message-keys test
 *  can still verify that every lookup resolves. */
const STATUS_LABEL: Record<string, 'status_draft' | 'status_published' | 'status_archived'> = {
  draft: 'status_draft',
  published: 'status_published',
  archived: 'status_archived',
};

const STATUS_TONE: Record<string, 'draft' | 'live' | 'archived'> = {
  draft: 'draft',
  published: 'live',
  archived: 'archived',
};

const slugify = (input: string) => kitSlugify(input, 80);

export function EmailTemplatesList() {
  const t = useTranslations('admin.email');
  const [templates, setTemplates] = useState<EmailTemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  // Create form
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const router = useRouter();
  const [category, setCategory] = useState<EmailCategory>('custom');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setForbidden(false);
    try {
      const res = await api.get<{ data: EmailTemplateSummary[] }>('/admin/email/templates');
      setTemplates(res?.data ?? []);
    } catch (e) {
      // A 403 is a missing permission, not a failure: it gets its own designed state.
      if ((e as { status?: number })?.status === 403) setForbidden(true);
      else setError(e instanceof Error ? e.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () => (filter === 'all' ? templates : templates.filter((x) => x.category === filter)),
    [templates, filter],
  );

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      await api.post('/admin/email/templates', {
        name: trimmed,
        slug: slug.trim() || slugify(trimmed),
        category,
      });
      setCreating(false);
      setName('');
      setSlug('');
      setCategory('custom');
      await load();
      toast({ type: 'ok', title: t('createdToast') });
    } catch (e) {
      const message = e instanceof Error ? e.message : t('saveError');
      setError(message);
      toast({ type: 'err', title: t('saveError'), description: message });
    } finally {
      setSaving(false);
    }
  }

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const x of templates) map[x.category] = (map[x.category] ?? 0) + 1;
    return map;
  }, [templates]);

  return (
    <div className="w-full">
      <AdminCommandBar
        trail={[{ label: t('title') }, { label: t('templatesTitle') }]}
        live={false}
        count={forbidden ? null : templates.length}
        primary={
          !forbidden ? (
            <BarPrimaryButton
              onClick={() => setCreating((v) => !v)}
              disabled={creating}
              icon={<Plus className="size-4" />}
            >
              {t('newTemplate')}
            </BarPrimaryButton>
          ) : undefined
        }
      />

      <div className="mx-auto w-full max-w-[1500px] space-y-6 pt-6">
        <AdminPageHeader title={t('templatesTitle')} description={t('templatesDescription')} />

        <AnimatePresence initial={false}>
          {error && (
            <m.div
              key="error"
              role="alert"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.24, ease: ease.emerge } }}
              exit={{ opacity: 0, transition: { duration: 0.14 } }}
              className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/[0.06] px-4 py-3 text-sm text-destructive"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </m.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {creating && !forbidden && (
            <m.div
              key="create"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1, transition: { duration: 0.32, ease: ease.emerge } }}
              exit={{ height: 0, opacity: 0, transition: { duration: 0.2, ease: ease.exit } }}
              className="-m-1 overflow-hidden p-1"
            >
              <FormSection
                id="new-template"
                icon={Plus}
                title={t('newTemplate')}
                description={t('createHint')}
              >
                <div className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <TextField
                      id="tmpl-name"
                      label={t('fieldName')}
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('namePlaceholder')}
                      autoFocus
                    />
                    <SelectField
                      label={t('fieldCategory')}
                      value={category}
                      onChange={(e) => setCategory(e.target.value as EmailCategory)}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {EMAIL_CATEGORY_LABELS[c]} ({counts[c] ?? 0})
                        </option>
                      ))}
                    </SelectField>
                  </div>
                  <SlugField
                    label={t('fieldSlug')}
                    value={slug}
                    onChange={setSlug}
                    prefix=""
                    source={name}
                    mode="create"
                    hint={t('slugHint')}
                  />
                  <div className="flex gap-2">
                    <BarPrimaryButton onClick={() => void create()} disabled={saving || !name.trim()}>
                      {saving && <Loader2 className="size-4 animate-spin" />}
                      {t('create')}
                    </BarPrimaryButton>
                    <button
                      type="button"
                      onClick={() => setCreating(false)}
                      className="pressable inline-flex h-9 items-center rounded-lg px-3 text-13 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      {t('cancel')}
                    </button>
                  </div>
                </div>
              </FormSection>
            </m.div>
          )}
        </AnimatePresence>

        {forbidden ? (
          <div className="rounded-xl border border-border/70 bg-card shadow-xs">
            <EmptyState icon={ShieldAlert} title={t('forbiddenTitle')} description={t('forbiddenBody')} />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {(['all', ...CATEGORIES] as const).map((c) => {
                const active = filter === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFilter(c)}
                    aria-pressed={active}
                    className={cn(
                      'relative rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150 active:scale-[0.97]',
                      active
                        ? 'border-transparent text-primary'
                        : 'border-border/70 bg-card text-muted-foreground hover:border-border-strong hover:text-foreground',
                    )}
                  >
                    {active && (
                      <m.span
                        layoutId="email-category-filter"
                        aria-hidden="true"
                        className="absolute inset-0 rounded-full bg-primary/10 ring-1 ring-inset ring-primary/20"
                        transition={spring.smooth}
                      />
                    )}
                    <span className="relative">
                      {c === 'all'
                        ? `${t('allCategories')} (${templates.length})`
                        : `${EMAIL_CATEGORY_LABELS[c]} (${counts[c] ?? 0})`}
                    </span>
                  </button>
                );
              })}
            </div>

            {loading ? (
              <div className="space-y-2" aria-busy="true">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            ) : visible.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/80 bg-surface-sunken/30">
                <EmptyState
                  icon={Mail}
                  title={t('emptyTitle')}
                  description={t('createHint')}
                  action={
                    <BarPrimaryButton onClick={() => setCreating(true)} icon={<Plus className="size-4" />}>
                      {t('newTemplate')}
                    </BarPrimaryButton>
                  }
                />
              </div>
            ) : (
              <ul className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs">
                <AnimatePresence initial={false}>
                  {visible.map((tpl, index) => (
                    <m.li
                      key={tpl.id}
                      initial={{ opacity: 0 }}
                      animate={{
                        opacity: 1,
                        transition: { duration: 0.28, ease: ease.emerge, delay: Math.min(index * 0.03, 0.36) },
                      }}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                      className="border-b border-border/60 last:border-b-0"
                    >
                      <Link
                        href={`/admin/email/templates/${tpl.id}`}
                        onMouseEnter={() => router.prefetch(`/admin/email/templates/${tpl.id}`)}
                        className="group flex items-center gap-4 px-4 py-3.5 outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/50"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                          <Mail className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{tpl.name}</span>
                          <span className="block truncate font-mono text-xs text-muted-foreground" dir="ltr">
                            {tpl.slug}
                          </span>
                        </span>
                        <span className="hidden text-xs text-muted-foreground md:block">
                          {EMAIL_CATEGORY_LABELS[tpl.category] ?? tpl.category}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <StatusChip tone={STATUS_TONE[tpl.status] ?? 'draft'}>
                            {t(STATUS_LABEL[tpl.status] ?? 'status_draft')}
                          </StatusChip>
                          {tpl.isSystem && (
                            <span className="hidden rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground sm:inline">
                              {t('systemBadge')}
                            </span>
                          )}
                        </span>
                        <span className="hidden w-12 text-end font-mono text-xs text-muted-foreground sm:block" dir="ltr">
                          {tpl.status === 'published' ? `v${tpl.version}` : '—'}
                        </span>
                        <span className="hidden w-24 text-end text-xs tabular-nums text-muted-foreground lg:block">
                          {new Date(tpl.updatedAt).toLocaleDateString()}
                        </span>
                        <ChevronRight className="flip-rtl size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
                      </Link>
                    </m.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
