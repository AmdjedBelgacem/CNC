'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Globe,
  GlobeLock,
  BookOpen,
  Plus,
  Search,
  X,
  Upload,
  Loader2,
  Trash2,
  Type,
  Palette,
  GraduationCap,
  Clock,
  ExternalLink,
  AlertCircle,
  AlertTriangle,
  Languages,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { difficultyKey, difficultyTone, difficultyFallback } from '@/lib/difficulty';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api-client';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AnimatePresence, m } from 'framer-motion';
import { spring, transition } from '@/lib/motion';
import { Reveal } from '@/components/ui/motion';
import { AdminCommandBar, BarButton, AdminPageHeader } from '@/components/admin/admin-chrome';
import { StatusPill, EmptyState, ErrorBanner } from '@/components/admin/admin-ui';
import {
  FormSection,
  FormSkeleton,
  TextField,
  TextAreaField,
} from '@/components/admin/admin-form';
import {
  ColorField,
  FormLayout,
  SaveDock,
  SectionNav,
  SlugField,
  StatusChip,
} from '@/components/admin/form-page';
import {
  TranslateAction,
  TranslationCoveragePanel,
  useTranslateDraft,
} from '@/components/admin/translation';
import {
  ACADEMY_FIELDS,
  type AcademyContentTranslation,
  type ContentLocale,
} from '@titan/shared';

interface AcademyDetail {
  id: string;
  slug: string;
  /** Localized copy. Long present in the schema but unusable until the DTO accepted it. */
  translations?: Partial<Record<ContentLocale, AcademyContentTranslation>> | null;
  title: string;
  subtitle: string | null;
  description: string | null;
  heroImageUrl: string | null;
  logoUrl: string | null;
  seoImageUrl: string | null;
  accentColor: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  isPublished: boolean;
  isArchived: boolean;
  sortOrder: number | null;
  updatedAt: string;
  courseCount: number;
  courses: RosterCourse[];
}

interface RosterCourse {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  thumbnailUrl: string | null;
  difficulty: number | null;
  estimatedHours: number | null;
  isPublished: boolean;
  isArchived: boolean;
  sortOrder: number | null;
  updatedAt: string;
}

interface CourseOption {
  id: string;
  slug: string;
  title: string;
}

type EditableField =
  'slug' | 'title' | 'subtitle' | 'description' | 'accentColor' | 'seoTitle' | 'seoDescription';

type ArabicField = 'title' | 'subtitle' | 'description' | 'seoTitle' | 'seoDescription';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BRAND_CLAY = '#B65433';

const ARABIC_FIELDS: ArabicField[] = ['title', 'subtitle', 'description', 'seoTitle', 'seoDescription'];

function isDirty(a: AcademyDetail | null, b: Partial<Record<EditableField, string>>): boolean {
  if (!a) return false;
  return (Object.keys(b) as EditableField[]).some((k) => (b[k] ?? '') !== (a[k] ?? ''));
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('Could not read file'));
    r.readAsDataURL(file);
  });
}

export default function AcademyEditorPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const t = useTranslations('admin.academiesPage.editor');
  const tAdmin = useTranslations('admin');
  const tEditor = useTranslations('admin.academiesEditor');
  const tNew = useTranslations('admin.academiesNew');
  const tForm = useTranslations('ui.adminForm');
  const tTranslate = useTranslations('admin.translate');
  const tCommon = useTranslations('common');
  const tDifficulty = useTranslations('admin');
  const [academy, setAcademy] = useState<AcademyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  // Errors only appear after the first attempt to save.
  const [attempted, setAttempted] = useState(false);
  const [form, setForm] = useState<Partial<Record<EditableField, string>>>({});
  const [formAr, setFormAr] = useState<Record<ArabicField, string>>(() =>
    Object.fromEntries(ARABIC_FIELDS.map((field) => [field, ''])) as Record<ArabicField, string>,
  );

  const arabicDirty = academy
    ? ARABIC_FIELDS.some((field) => (formAr[field] ?? '') !== (academy.translations?.ar?.[field] ?? ''))
    : false;
  const dirty = isDirty(academy, form) || arabicDirty;

  const { busy: translateBusy, run: runTranslate, coverageFor } = useTranslateDraft({
    entity: 'academy copy',
    descriptors: ACADEMY_FIELDS,
    groups: [
      {
        key: 'academy',
        fields: {
          Title: form.title ?? '',
          Subtitle: form.subtitle ?? '',
          Description: form.description ?? '',
          'SEO title': form.seoTitle ?? '',
          'SEO description': form.seoDescription ?? '',
        },
      },
    ],
    onApply: (_key, translations) => {
      setFormAr((prev) => ({
        ...prev,
        title: translations['Title'] ?? prev.title,
        subtitle: translations['Subtitle'] ?? prev.subtitle,
        description: translations['Description'] ?? prev.description,
        seoTitle: translations['SEO title'] ?? prev.seoTitle,
        seoDescription: translations['SEO description'] ?? prev.seoDescription,
      }));
    },
    confirmOverwrite: () => window.confirm(tTranslate('overwriteConfirm')),
  });

  const academyCoverage = academy
    ? coverageFor(
        {
          title: form.title ?? '',
          subtitle: form.subtitle ?? '',
          description: form.description ?? '',
          seoTitle: form.seoTitle ?? '',
          seoDescription: form.seoDescription ?? '',
        },
        formAr,
      )
    : null;
  const [publishReasons, setPublishReasons] = useState<string[]>([]);
  const [publishWarnings, setPublishWarnings] = useState<string[]>([]);

  // Course picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [courseOptions, setCourseOptions] = useState<CourseOption[] | null>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerSelected, setPickerSelected] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);

  /**
   * `silent` keeps the page on screen (no skeleton) for refreshes after an action.
   * `keepForm` refreshes the record without touching in-progress edits — an image upload or a
   * roster change must not wipe unsaved text.
   */
  const load = useCallback(async (opts?: { silent?: boolean; keepForm?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/proxy/admin/academies/${slug}`, { credentials: 'include' });
      if (!res.ok) throw new Error(tAdmin('drawer.requestFailed', { status: res.status }));
      const data: AcademyDetail = await res.json();
      setAcademy(data);
      if (opts?.keepForm) return;
      setForm({
        slug: data.slug ?? '',
        title: data.title ?? '',
        subtitle: data.subtitle ?? '',
        description: data.description ?? '',
        accentColor: data.accentColor ?? '',
        seoTitle: data.seoTitle ?? '',
        seoDescription: data.seoDescription ?? '',
      });
      setFormAr(Object.fromEntries(
        ARABIC_FIELDS.map((field) => [field, data.translations?.ar?.[field] ?? '']),
      ) as Record<ArabicField, string>);
    } catch (e: any) {
      setError(e?.message || tEditor('loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const discard = () => {
    if (!academy) return;
    setForm({
      slug: academy.slug ?? '',
      title: academy.title ?? '',
      subtitle: academy.subtitle ?? '',
      description: academy.description ?? '',
      accentColor: academy.accentColor ?? '',
      seoTitle: academy.seoTitle ?? '',
      seoDescription: academy.seoDescription ?? '',
    });
    setFormAr(Object.fromEntries(
      ARABIC_FIELDS.map((field) => [field, academy.translations?.ar?.[field] ?? '']),
    ) as Record<ArabicField, string>);
    setAttempted(false);
  };

  const titleMissing = !(form.title ?? '').trim();
  const slugValue = form.slug ?? '';
  const slugMissing = !slugValue;
  const slugInvalid = !!slugValue && !SLUG_RE.test(slugValue);
  const accentValue = form.accentColor ?? '';
  const accentInvalid = !!accentValue && !HEX.test(accentValue);
  const basicsInvalid = titleMissing || slugMissing || slugInvalid;

  useEffect(() => {
    if (pickerOpen && courseOptions === null) {
      void (async () => {
        try {
          const res = await fetch('/api/proxy/admin/courses?limit=100', { credentials: 'include' });
          if (!res.ok) throw new Error(tAdmin('drawer.requestFailed', { status: res.status }));
          const data = await res.json();
          setCourseOptions(Array.isArray(data?.items) ? data.items : []);
        } catch {
          setCourseOptions([]);
        }
      })();
    }
  }, [pickerOpen, courseOptions]);


  const save = async () => {
    if (!academy || !dirty) return;
    setAttempted(true);
    if (basicsInvalid || accentInvalid) {
      document
        .getElementById(basicsInvalid ? 'basics' : 'branding')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast({ type: 'err', title: t('fixErrors') });
      return;
    }
    setSaving(true);
    setSaveFailed(false);
    try {
      const patch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(form)) {
        if ((v ?? '') !== ((academy as any)[k] ?? '')) patch[k] = v === '' ? null : v;
      }
      if (arabicDirty) {
        // Sent as an object rather than field-by-field: the API takes the whole locale block, and
        // sending only the changed keys would blank the rest of the Arabic on save.
        patch.translations = {
          ...(academy?.translations ?? {}),
          ar: Object.fromEntries(
            ARABIC_FIELDS.map((field) => [field, formAr[field].trim() || null]),
          ),
        };
      }
      const updated = await api.patch<{ slug?: string }>(`/admin/academies/${academy.slug}`, patch);
      toast({ type: 'ok', title: t('saved', { default: 'Academy saved' }) });
      setAttempted(false);
      // Slug may have been edited — stay on the (possibly new) slug.
      if (updated.slug && updated.slug !== academy.slug) {
        router.replace(`/admin/academies/${updated.slug}/edit`);
      } else {
        await load({ silent: true });
      }
    } catch (e: any) {
      setSaveFailed(true);
      toast({ type: 'err', title: t('saveFailed', { default: 'Save failed' }), description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async () => {
    if (!academy) return;
    setPublishing(true);
    try {
      const action = academy.isPublished ? 'unpublish' : 'publish';
      let publishedData: unknown = null;
      try {
        publishedData = await api.post(`/admin/academies/${academy.slug}/${action}`);
      } catch (err: any) {
        if (action === 'publish') {
          const vres = await fetch(`/api/proxy/admin/academies/${academy.slug}/validate`, {
            credentials: 'include',
          });
          const vdata = await vres.json().catch(() => null);
          setPublishReasons(Array.isArray(vdata?.reasons) ? vdata.reasons : []);
          setPublishWarnings(Array.isArray(vdata?.warnings) ? vdata.warnings : []);
        }
        const data = err?.body ?? null;
        const details =
          Array.isArray(data?.reasons) && data.reasons.length
            ? data.reasons.join('; ')
            : (data?.message ?? tAdmin('drawer.requestFailed', { status: err?.status }));
        throw new Error(details);
      }
      // Publish now succeeds even with 0 courses — surface non-blocking warnings if any.
      try {
        const vres = await fetch(`/api/proxy/admin/academies/${academy.slug}/validate`, {
          credentials: 'include',
        });
        const vdata = await vres.json().catch(() => null);
        const warnings: string[] = Array.isArray(vdata?.warnings) ? vdata.warnings : [];
        setPublishWarnings(warnings);
        setPublishReasons([]);
        if (action === 'publish' && warnings.length) {
          toast({
            type: 'ok',
            title: t('publishedWithWarnings', { default: 'Academy published with warnings' }),
            description: warnings.join('; '),
          });
        } else {
          toast({
            type: 'ok',
            title:
              action === 'publish'
                ? t('published', { default: 'Academy published' })
                : t('unpublished', { default: 'Academy unpublished' }),
          });
        }
      } catch {
        setPublishReasons([]);
        setPublishWarnings([]);
        toast({
          type: 'ok',
          title:
              action === 'publish'
                ? t('published', { default: 'Academy published' })
                : t('unpublished', { default: 'Academy unpublished' }),
        });
      }
      // `publishedData` holds the fresh academy row but `load()` refreshes roster + counts.
      void publishedData;
      await load({ silent: true, keepForm: true });
    } catch (e: any) {
      toast({ type: 'err', title: t('actionFailed', { default: 'Action failed' }), description: e?.message });
    } finally {
      setPublishing(false);
    }
  };

  const assignCourses = async (slugs: string[]) => {
    if (!academy || !slugs.length) return;
    setAssigning(true);
    try {
      const data = await api.post<{ assigned: number }>(`/admin/academies/${academy.slug}/courses`, {
        courseSlugs: slugs,
      });
      toast({
        type: 'ok',
        title: t('coursesAdded', {
          count: data.assigned,
          default: '{count, plural, one {# course added} other {# courses added}}',
        }),
      });
      setPickerOpen(false);
      setPickerSelected([]);
      void load({ silent: true, keepForm: true });
    } catch (e: any) {
      toast({ type: 'err', title: t('assignFailed', { default: 'Assign failed' }), description: e?.message });
    } finally {
      setAssigning(false);
    }
  };

  /** Unassign via the course PATCH flow (academyId: null) — never deletes course data. */
  const removeCourse = async (courseSlug: string) => {
    try {
      await api.patch(`/admin/courses/${courseSlug}`, { academyId: null });
      toast({ type: 'ok', title: t('courseRemoved', { default: 'Course removed from academy' }) });
      void load({ silent: true, keepForm: true });
    } catch (e: any) {
      toast({ type: 'err', title: t('courseRemoveFailed', { default: 'Remove failed' }), description: e?.message });
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 pt-6">
        <Skeleton className="h-9 w-72 rounded-lg" />
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_17rem] xl:gap-8">
          <div className="space-y-6">
            <div className="rounded-xl border border-border/70 bg-card p-5 shadow-xs">
              <FormSkeleton fields={4} />
            </div>
            <div className="rounded-xl border border-border/70 bg-card p-5 shadow-xs">
              <FormSkeleton fields={2} />
            </div>
          </div>
          <Skeleton className="hidden h-64 rounded-xl xl:block" />
        </div>
      </div>
    );
  }
  if (error || !academy) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-balance font-display text-xl font-medium tracking-[-0.015em] text-foreground">{error || tEditor('notFound')}</p>
        <button
          type="button"
          onClick={() => router.push('/admin/academies')}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90 active:scale-[0.98]"
        >
          {tEditor('backToAcademies')}
        </button>
      </div>
    );
  }

  const rosterSlugs = new Set(academy.courses.map((c) => c.slug));
  const filteredOptions = (courseOptions ?? []).filter((c) => {
    if (rosterSlugs.has(c.slug)) return false;
    if (!pickerQuery) return true;
    return (
      c.title.toLowerCase().includes(pickerQuery.toLowerCase()) ||
      c.slug.toLowerCase().includes(pickerQuery.toLowerCase())
    );
  });
  const previewAccent = HEX.test(accentValue) ? accentValue : BRAND_CLAY;
  const preview = (
    <AcademyPreview
      title={form.title || t('previewPlaceholderName', { default: 'Untitled academy' })}
      subtitle={form.subtitle ?? null}
      description={form.description ?? null}
      logoUrl={academy.logoUrl}
      heroImageUrl={academy.heroImageUrl}
      accent={previewAccent}
      courseCount={academy.courseCount}
    />
  );
  const statusTone = academy.isArchived ? 'archived' : academy.isPublished ? 'live' : 'draft';
  const statusLabel = academy.isArchived
    ? t('statusArchived', { default: 'Archived' })
    : academy.isPublished
      ? t('statusPublished', { default: 'Published' })
      : t('statusDraft', { default: 'Draft' });

  return (
    <div className="w-full">
      <AdminCommandBar
        trail={[{ label: tAdmin('academies'), href: '/admin/academies' }, { label: academy.title }]}
        // Status lives in the page header chip and unsaved state in the dock.
        live={false}
        actions={
          <BarButton
            icon={academy.isPublished ? <GlobeLock className="size-4" /> : <Globe className="size-4" />}
            disabled={publishing}
            onClick={() => void togglePublish()}
          >
            {publishing
              ? t('working', { default: 'Working…' })
              : academy.isPublished
                ? t('unpublish', { default: 'Unpublish' })
                : t('publish', { default: 'Publish' })}
          </BarButton>
        }
      />

      <div className="space-y-6 pt-6">
        <div className="mx-auto w-full max-w-6xl space-y-4">
          <AdminPageHeader
            title={academy.title}
            description={
              <span className="flex flex-wrap items-center gap-x-2">
                <bdi dir="ltr" className="font-mono text-xs">
                  /academy/{academy.slug}
                </bdi>
                <span aria-hidden className="text-border-strong">
                  ·
                </span>
                <span>
                  {t('courseCount', {
                    count: academy.courseCount,
                    default: '{count, plural, one {# course} other {# courses}}',
                  })}
                </span>
              </span>
            }
            badge={<StatusChip tone={statusTone}>{statusLabel}</StatusChip>}
          />

          {error && <ErrorBanner message={error} onRetry={() => void load()} retryLabel={tCommon('retry')} />}

          {/* Publishing is blocked or warned by the server; say which, and why. */}
          <AnimatePresence initial={false}>
            {publishReasons.length > 0 && (
              <m.div
                key="reasons"
                role="alert"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0, transition: spring.smooth }}
                exit={{ opacity: 0, y: -4, transition: transition.leave }}
                className="rounded-xl border border-destructive/20 bg-destructive/8 px-5 py-3.5"
              >
                <p className="flex items-center gap-2 text-13 font-medium text-destructive">
                  <AlertCircle className="size-4" />
                  {t('cannotPublish', { default: 'This academy cannot be published yet' })}
                </p>
                <ul className="mt-1.5 list-disc space-y-0.5 ps-6 text-xs text-destructive/90">
                  {publishReasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </m.div>
            )}
            {publishReasons.length === 0 && publishWarnings.length > 0 && (
              <m.div
                key="warnings"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0, transition: spring.smooth }}
                exit={{ opacity: 0, y: -4, transition: transition.leave }}
                className="rounded-xl border border-warning/25 bg-warning/8 px-5 py-3.5"
              >
                <p className="flex items-center gap-2 text-13 font-medium text-warning">
                  <AlertTriangle className="size-4" />
                  {t('publishedWithWarnings', { default: 'Published with warnings' })}
                </p>
                <ul className="mt-1.5 list-disc space-y-0.5 ps-6 text-xs text-warning/90">
                  {publishWarnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </m.div>
            )}
          </AnimatePresence>
        </div>

        <FormLayout
          aside={
            <>
              <SectionNav
                items={[
                  { id: 'basics', label: t('basics', { default: 'Basics' }), icon: Type, invalid: attempted && basicsInvalid },
                  { id: 'branding', label: tNew('branding'), icon: Palette, invalid: attempted && accentInvalid },
                  { id: 'seo', label: tNew('seoSharing'), icon: Search },
                  { id: 'arabic', label: t('arabicSection', { default: 'Arabic copy' }), icon: Languages },
                  {
                    id: 'courses',
                    label: t('roster', { default: 'Courses in this academy' }),
                    icon: BookOpen,
                    badge: academy.courseCount,
                  },
                ]}
              />
              {preview}
            </>
          }
        >
          <Reveal>
            <FormSection
              id="basics"
              icon={Type}
              title={t('basics', { default: 'Basics' })}
              description={t('basicsDesc', { default: 'How this academy is named and described.' })}
            >
              <div className="space-y-5">
                <TextField
                  label={t('title', { default: 'Title' })}
                  required
                  dir="auto"
                  value={form.title ?? ''}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  error={attempted && titleMissing ? tNew('titleRequired') : undefined}
                />
                <SlugField
                  label={t('slug', { default: 'Slug' })}
                  mode="edit"
                  prefix="/academy/"
                  value={slugValue}
                  onChange={(next) => setForm((f) => ({ ...f, slug: next }))}
                  error={
                    attempted && (slugMissing || slugInvalid) ? t('slugInvalid') : undefined
                  }
                />
                <TextField
                  label={t('subtitle', { default: 'Subtitle' })}
                  hint={tNew('subtitleHint')}
                  dir="auto"
                  value={form.subtitle ?? ''}
                  onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                />
                <TextAreaField
                  label={t('description', { default: 'Description' })}
                  dir="auto"
                  rows={5}
                  value={form.description ?? ''}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
            </FormSection>
          </Reveal>

          <Reveal delay={0.04}>
            <FormSection
              id="branding"
              icon={Palette}
              title={tNew('branding')}
              description={t('brandingDesc')}
              badge={tForm('optional')}
            >
              <div className="flex flex-col gap-6">
                {/* The preview follows the form in the rail on wide screens only. */}
                <div className="xl:hidden">{preview}</div>
                <ColorField
                  label={t('accent', { default: 'Accent colour' })}
                  hint={t('accentDesc', { default: 'Used across this academy and its course cards.' })}
                  value={accentValue}
                  onChange={(next) => setForm((f) => ({ ...f, accentColor: next }))}
                />
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <AcademyImageField
                    label={t('heroBanner', { default: 'Hero banner' })}
                    hint={t('heroHint', {
                      default: 'Branding · 1920×1080 recommended · JPG/PNG/WebP/AVIF · ≤5 MB.',
                    })}
                    kind="hero"
                    slug={academy.slug}
                    currentUrl={academy.heroImageUrl}
                    onChanged={() => load({ silent: true, keepForm: true })}
                  />
                  <AcademyImageField
                    label={t('logo', { default: 'Logo / mark' })}
                    hint={t('logoHint', {
                      default: 'Square PNG/WebP with a transparent background · ≤5 MB.',
                    })}
                    kind="logo"
                    slug={academy.slug}
                    currentUrl={academy.logoUrl}
                    onChanged={() => load({ silent: true, keepForm: true })}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{t('imagesLiveNote')}</p>
              </div>
            </FormSection>
          </Reveal>

          <Reveal>
            <FormSection
              id="seo"
              icon={Search}
              title={tNew('seoSharing')}
              description={t('seoDesc', {
                default: 'Overrides for search results. Blank falls back to the title and description above.',
              })}
              badge={tForm('optional')}
            >
              <div className="space-y-5">
                <TextField
                  label={t('seoTitle', { default: 'SEO title' })}
                  dir="auto"
                  value={form.seoTitle ?? ''}
                  onChange={(e) => setForm({ ...form, seoTitle: e.target.value })}
                  placeholder={t('seoTitlePlaceholder', {
                    default: 'Custom page title (meta title) for search results',
                  })}
                />
                <TextAreaField
                  label={t('seoDescription', { default: 'SEO description' })}
                  dir="auto"
                  rows={3}
                  value={form.seoDescription ?? ''}
                  onChange={(e) => setForm({ ...form, seoDescription: e.target.value })}
                  placeholder={t('seoDescriptionPlaceholder', {
                    default: 'Meta description for search & social unfurls',
                  })}
                />
                <div className="max-w-md">
                  <AcademyImageField
                    label={t('socialImage', { default: 'Social preview image' })}
                    hint={t('socialHint', {
                      default: 'og:image · 1200×630 recommended · JPG/PNG/WebP · ≤5 MB.',
                    })}
                    kind="seo"
                    slug={academy.slug}
                    currentUrl={academy.seoImageUrl}
                    onChanged={() => load({ silent: true, keepForm: true })}
                  />
                </div>
              </div>
            </FormSection>
          </Reveal>

          {/* Arabic used to be impossible to save here at all: the column existed, the form read it,
              and the API rejected any payload containing it. */}
          <Reveal>
            <FormSection
              id="arabic"
              title={t('arabicSection', { default: 'Arabic copy' })}
              icon={Languages}
              description={t('arabicSectionDesc', {
                default: 'Shown to Arabic visitors. Translate from English, then review before saving.',
              })}
              badge={tForm('optional')}
              actions={
                academyCoverage && (
                  <TranslateAction
                    coverage={academyCoverage}
                    busy={translateBusy}
                    onTranslate={(scope) => void runTranslate(scope)}
                  />
                )
              }
            >
              {academyCoverage && <TranslationCoveragePanel coverage={academyCoverage} className="mb-4" />}
              <div dir="rtl" className="grid gap-5">
                <TextField
                  label={t('arabicTitle', { default: 'Arabic title' })}
                  value={formAr.title}
                  onChange={(e) => setFormAr({ ...formAr, title: e.target.value })}
                />
                <TextField
                  label={t('arabicSubtitle', { default: 'Arabic subtitle' })}
                  value={formAr.subtitle}
                  onChange={(e) => setFormAr({ ...formAr, subtitle: e.target.value })}
                />
                <TextAreaField
                  label={t('arabicDescription', { default: 'Arabic description' })}
                  value={formAr.description}
                  onChange={(e) => setFormAr({ ...formAr, description: e.target.value })}
                />
                <TextField
                  label={t('arabicSeoTitle', { default: 'Arabic SEO title' })}
                  value={formAr.seoTitle}
                  onChange={(e) => setFormAr({ ...formAr, seoTitle: e.target.value })}
                />
                <TextAreaField
                  label={t('arabicSeoDescription', { default: 'Arabic SEO description' })}
                  value={formAr.seoDescription}
                  onChange={(e) => setFormAr({ ...formAr, seoDescription: e.target.value })}
                />
              </div>
            </FormSection>
          </Reveal>

          <Reveal>
          <FormSection
            id="courses"
            title={t('roster', { default: 'Courses in this academy' })}
            icon={BookOpen}
            description={t('rosterDesc', {
              default: 'Courses placed here are grouped into this destination.',
            })}
            actions={
              <Button size="sm" onClick={() => { setPickerSelected([]); setPickerOpen(true); }} disabled={assigning}>
                <Plus className="size-4" />
                {t('assignCourses', { default: 'Assign courses' })}
              </Button>
            }
            bodyClassName="p-0"
          >
            {academy.courses.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                tone="blue"
                title={t('rosterEmpty', { default: 'No courses in this academy yet' })}
                body={t('rosterEmptyHint', {
                  default:
                    'Assign courses to group them into a single branded destination for learners.',
                })}
                action={
                  <button
                    type="button"
                    onClick={() => { setPickerSelected([]); setPickerOpen(true); }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90 active:scale-[0.98]"
                  >
                    <Plus className="size-4" />
                    {t('assignFirst', { default: 'Assign the first course' })}
                  </button>
                }
              />
            ) : (
              <ul className="divide-y divide-border/60">
                <AnimatePresence initial={false}>
                {academy.courses.map((c) => (
                  <m.li
                    key={c.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0, transition: spring.smooth }}
                    exit={{ opacity: 0, x: -8, transition: transition.leave }}
                    className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/40"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-surface-sunken">
                      {c.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.thumbnailUrl} alt="" className="size-full object-cover" />
                      ) : (
                        <GraduationCap className="size-4 text-muted-foreground" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p dir="auto" className="truncate text-13 font-medium text-foreground">
                        {c.title}
                      </p>
                        <StatusPill
                          label={
                            c.isArchived
                              ? t('statusArchived', { default: 'Archived' })
                              : c.isPublished
                                ? t('statusPublished', { default: 'Published' })
                                : t('statusDraft', { default: 'Draft' })
                          }
                          tone={c.isArchived ? 'slate' : c.isPublished ? 'emerald' : 'amber'}
                        />
                        {typeof c.difficulty === 'number' && (
                          <StatusPill
                            label={tDifficulty(difficultyKey(c.difficulty), {
                              default: difficultyFallback(c.difficulty),
                            })}
                            tone={difficultyTone(c.difficulty)}
                            dot={false}
                          />
                        )}
                      </div>
                      {c.subtitle && (
                        <p dir="auto" className="truncate text-xs text-muted-foreground">
                          {c.subtitle}
                        </p>
                      )}
                      <p className="truncate font-mono text-2xs text-muted-foreground" dir="ltr">
                        /{c.slug}
                      </p>
                    </div>
                    <div className="hidden shrink-0 items-center gap-3 text-2xs text-muted-foreground sm:flex">
                      {typeof c.estimatedHours === 'number' && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3" />
                          {t('hoursShort', { count: c.estimatedHours, default: '{count}h' })}
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <a
                        href={`/admin/courses/${c.slug}/edit`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-xs transition hover:border-border-strong hover:bg-muted"
                      >
                        <ExternalLink className="size-3.5" />
                        {t('openStudio', { default: 'Open Studio' })}
                      </a>
                      <button
                        type="button"
                        onClick={() => void removeCourse(c.slug)}
                        aria-label={t('removeCourse', { title: c.title, default: 'Remove {title} from this academy' })}
                        title={t('removeCourse', { title: c.title, default: 'Remove {title} from this academy' })}
                        className="flex size-8 items-center justify-center rounded-lg border border-border/70 text-destructive transition hover:border-destructive/30 hover:bg-destructive/8 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  </m.li>
                ))}
                </AnimatePresence>
              </ul>
            )}
          </FormSection>
          </Reveal>
        </FormLayout>
      </div>

      <SaveDock
        mode="edit"
        dirty={dirty}
        saving={saving}
        failed={saveFailed}
        onSave={() => void save()}
        onDiscard={discard}
      />

      {/* Course picker */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent
          size="md"
          aria-label={t('pickerTitle', { title: academy.title, default: 'Assign courses to {title}' })}
        >
            <DialogHeader>
              <DialogTitle>
                {t('pickerTitle', { title: academy.title, default: 'Assign courses to {title}' })}
              </DialogTitle>
            </DialogHeader>
            <div className="shrink-0 px-5 pb-3 sm:px-7">
              <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-surface-sunken/60 px-3 py-2 transition focus-within:border-primary/50 focus-within:bg-background focus-within:ring-4 focus-within:ring-primary/10">
                <Search className="size-4 shrink-0 text-muted-foreground" />
                <input
                  autoFocus
                  className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
                  placeholder={t('pickerSearch', { default: 'Search courses by title or slug…' })}
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                />
              </div>
            </div>
            <DialogBody className="max-h-80 border-t border-border/70 p-0 sm:p-0">
              {courseOptions === null ? (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                  {t('pickerLoading', { default: 'Loading courses…' })}
                </div>
              ) : filteredOptions.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                  {t('pickerEmpty', { default: 'No courses match that search.' })}
                </div>
              ) : (
                filteredOptions.map((c) => {
                  const already = academy.courses.some((x) => x.id === c.id);
                  return (
                    <label
                      key={c.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 border-b border-border/60 px-5 py-3 transition-colors last:border-0 sm:px-7',
                        already ? 'opacity-50' : 'hover:bg-muted/40',
                        pickerSelected.includes(c.slug) && !already && 'bg-primary/5',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={pickerSelected.includes(c.slug) || already}
                        disabled={already}
                        onChange={(e) =>
                          setPickerSelected((prev) =>
                            e.target.checked
                              ? [...prev, c.slug]
                              : prev.filter((s) => s !== c.slug),
                          )
                        }
                        className="size-3.5 shrink-0 rounded border-border text-primary focus:ring-primary/30"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-13 font-medium text-foreground">{c.title}</span>
                        <span className="block truncate font-mono text-2xs text-muted-foreground" dir="ltr">
                          /{c.slug}
                        </span>
                      </span>
                      {already && (
                        <StatusPill
                          label={t('alreadyAssigned', { default: 'Assigned' })}
                          tone="emerald"
                          dot={false}
                        />
                      )}
                    </label>
                  );
                })
              )}
            </DialogBody>
            <DialogFooter>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="rounded-xl border border-border/70 bg-card px-4 py-2 text-sm font-medium text-foreground shadow-xs transition hover:bg-muted active:scale-[0.98]"
              >
                {tCommon('cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pickerSelected.length) void assignCourses(pickerSelected);
                  else setPickerOpen(false);
                }}
                disabled={assigning || pickerSelected.length === 0}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
              >
                {assigning ? t('assigning', { default: 'Assigning…' }) : t('assign', { default: 'Assign' })}
              </button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Only a well-formed 6-digit hex may be applied to a colour input or preview. */
const HEX = /^#[0-9a-fA-F]{6}$/;

/* -----------------------------------------------------------------------------
 * Live preview.
 *
 * The academy hero is driven almost entirely by these fields, and the accent
 * colour is easy to get wrong blind. This renders the real stored logo and hero
 * image with the in-progress title/subtitle/accent overlaid, so the effect of an
 * edit is visible before saving.
 * --------------------------------------------------------------------------- */
function AcademyPreview({
  title,
  subtitle,
  description,
  logoUrl,
  heroImageUrl,
  accent,
  courseCount,
}: {
  title: string;
  subtitle: string | null;
  description: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  accent: string;
  courseCount: number;
}) {
  const t = useTranslations('admin.academiesPage.editor');
  return (
    <section className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs">
      <header className="flex items-center gap-2 border-b border-border/70 px-5 py-3.5">
        <Palette className="size-4 shrink-0 text-primary" />
        <h2 className="font-display text-base font-medium tracking-[-0.015em] text-foreground">
          {t('preview', { default: 'Live preview' })}
        </h2>
        <span dir="ltr" className="ms-auto inline-flex items-center gap-1.5 font-mono text-2xs text-muted-foreground">
          <m.span
            aria-hidden
            className="size-2.5 rounded-full"
            animate={{ backgroundColor: accent }}
            transition={transition.crossfade}
          />
          {accent}
        </span>
      </header>
      <div className="p-5">
        <div className="relative overflow-hidden rounded-xl border border-border/70">
          {/* Hero image when uploaded, otherwise an accent wash so the colour
              choice is still legible. */}
          {heroImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroImageUrl} alt="" className="h-36 w-full object-cover" />
          ) : (
            <div
              className="h-36 w-full transition-[background] duration-500"
              style={{
                background: `linear-gradient(135deg, ${accent} 0%, ${accent}b3 55%, ${accent}40 100%)`,
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-4">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                className="size-10 shrink-0 rounded-lg border border-white/25 bg-white/10 object-contain p-0.5"
              />
            ) : (
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-white/25 text-white/85"
                style={{ backgroundColor: `${accent}66` }}
              >
                <GraduationCap className="size-4" />
              </span>
            )}
            <div className="min-w-0">
              <p dir="auto" className="truncate font-display text-base font-medium tracking-[-0.01em] text-white">
                {title}
              </p>
              {subtitle && (
                <p dir="auto" className="truncate text-xs text-white/80">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="mt-3.5 space-y-2">
          <p dir="auto" className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
            {description ||
              t('previewPlaceholderDesc', {
                default: 'Add a description to preview the summary learners will read.',
              })}
          </p>
          <div className="flex items-center gap-2 pt-0.5">
            <StatusPill
              label={t('previewCourseCount', {
                count: courseCount,
                default: '{count, plural, one {# course} other {# courses}}',
              })}
              tone="blue"
              dot={false}
            />
            <span
              className="size-3 rounded-full ring-2 ring-background"
              style={{ backgroundColor: accent }}
              aria-hidden
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* -----------------------------------------------------------------------------
 * Image upload field.
 *
 * Upload-only by design: external URLs are rejected server-side, so the control
 * never offers a URL box that would fail. Drag-drop, click-to-pick, remove, and
 * an inline preview all live in one tile.
 * --------------------------------------------------------------------------- */
function AcademyImageField({
  label,
  hint,
  kind,
  slug,
  currentUrl,
  onChanged,
}: {
  label: string;
  hint: string;
  kind: 'hero' | 'logo' | 'seo';
  slug: string;
  currentUrl: string | null;
  onChanged: () => void | Promise<void>;
}) {
  const t = useTranslations('admin.academiesPage.editor');
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const busy = uploading || deleting;

  const doUpload = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({
        type: 'err',
        title: t('notAnImage', { default: 'Not an image' }),
        description: t('notAnImageHint', {
          default: 'Choose an image file (JPG, PNG, WebP, GIF, SVG, AVIF).',
        }),
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({
        type: 'err',
        title: t('fileTooLarge', { default: 'File too large' }),
        description: t('fileTooLargeHint', { default: 'Max 5 MB per image.' }),
      });
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      await api.post(`/admin/academies/${slug}/images`, {
        kind,
        image: dataUrl,
        filename: file.name,
      });
      toast({ type: 'ok', title: t('uploaded', { label, default: '{label} uploaded' }) });
      await onChanged();
    } catch (e: any) {
      toast({
        type: 'err',
        title: t('uploadFailed', { default: 'Upload failed' }),
        description: e?.message,
      });
    } finally {
      setUploading(false);
    }
  };

  const doDelete = async () => {
    if (!currentUrl) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/academies/${slug}/images/${kind}`);
      toast({ type: 'ok', title: t('removed', { label, default: '{label} removed' }) });
      await onChanged();
    } catch (e: any) {
      toast({
        type: 'err',
        title: t('removeFailed', { default: 'Remove failed' }),
        description: e?.message,
      });
    } finally {
      setDeleting(false);
    }
  };

  const aspect = kind === 'logo' ? 'aspect-square' : 'aspect-[16/9]';

  return (
    <div className="flex flex-col gap-2">
      <span className="text-13 font-medium text-foreground">{label}</span>
      <div
        onClick={() => {
          if (!busy) inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void doUpload(e.dataTransfer.files?.[0]);
        }}
        role="button"
        tabIndex={0}
        aria-label={t('chooseImageFor', { label, default: 'Choose an image for {label}' })}
        aria-busy={busy}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !busy) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={cn(
          'group relative flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed border-border-strong bg-surface-sunken/50 px-3 py-4 text-center transition-[background-color,border-color] duration-300',
          'hover:border-primary/40 hover:bg-primary/5',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
          drag && 'border-primary/60 bg-primary/10',
          busy && 'pointer-events-none opacity-60',
        )}
      >
        {currentUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentUrl}
              alt=""
              className={cn('w-full rounded-lg object-cover', aspect)}
            />
            <span className="text-2xs font-medium text-muted-foreground group-hover:text-foreground">
              {t('replace', { default: 'Replace' })}
            </span>
          </>
        ) : busy ? (
          <div className="flex flex-col items-center gap-2 py-6">
            <Loader2 className="size-5 animate-spin text-primary" />
            <span className="text-2xs text-muted-foreground">
              {t('uploading', { default: 'Uploading…' })}
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-5">
            <span className="flex size-9 items-center justify-center rounded-xl border border-border/70 bg-card text-muted-foreground shadow-xs transition group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:text-primary">
              <Upload className="size-4" />
            </span>
            <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground">
              {t('dropOrBrowse', { default: 'Drop an image or click to browse' })}
            </span>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          void doUpload(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <div className="flex items-start gap-2">
        <p className="flex-1 text-2xs leading-relaxed text-muted-foreground">{hint}</p>
        {currentUrl && (
          <button
            type="button"
            onClick={() => void doDelete()}
            disabled={busy}
            aria-label={t('removeLabel', { label, default: 'Remove {label}' })}
            title={t('removeLabel', { label, default: 'Remove {label}' })}
            className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition hover:border-destructive/40 hover:bg-destructive/8 hover:text-destructive disabled:opacity-50"
          >
            {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}
