'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Globe,
  GlobeLock,
  Save,
  BookOpen,
  Plus,
  Search,
  X,
  Upload,
  Loader2,
  Image as ImageIcon,
  Trash2,
  Store,
  Palette,
  GraduationCap,
  Clock,
  ExternalLink,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { difficultyKey, difficultyTone, difficultyFallback } from '@/lib/difficulty';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import {
  AdminCommandBar,
  BarButton,
  BarPrimaryButton,
  AdminPageHeader,
} from '@/components/admin/admin-chrome';
import { StatusPill, EmptyState, ErrorBanner } from '@/components/admin/admin-ui';
import {
  Field,
  FormSection,
  FormSkeleton,
  TextInput,
  TextField,
  TextAreaField,
} from '@/components/admin/admin-form';

interface AcademyDetail {
  id: string;
  slug: string;
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
  'title' | 'subtitle' | 'description' | 'accentColor' | 'seoTitle' | 'seoDescription';

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
  const tCommon = useTranslations('common');
  const tDifficulty = useTranslations('admin');
  const [academy, setAcademy] = useState<AcademyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [form, setForm] = useState<Partial<Record<EditableField, string>>>({});
  const [publishReasons, setPublishReasons] = useState<string[]>([]);
  const [publishWarnings, setPublishWarnings] = useState<string[]>([]);

  // Course picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [courseOptions, setCourseOptions] = useState<CourseOption[] | null>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerSelected, setPickerSelected] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/proxy/admin/academies/${slug}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data: AcademyDetail = await res.json();
      setAcademy(data);
      setForm({
        title: data.title ?? '',
        subtitle: data.subtitle ?? '',
        description: data.description ?? '',
        accentColor: data.accentColor ?? '',
        seoTitle: data.seoTitle ?? '',
        seoDescription: data.seoDescription ?? '',
      });
    } catch (e: any) {
      setError(e?.message || 'Failed to load academy');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (pickerOpen && courseOptions === null) {
      void (async () => {
        try {
          const res = await fetch('/api/proxy/admin/courses?limit=100', { credentials: 'include' });
          if (!res.ok) throw new Error(`Request failed (${res.status})`);
          const data = await res.json();
          setCourseOptions(Array.isArray(data?.items) ? data.items : []);
        } catch {
          setCourseOptions([]);
        }
      })();
    }
  }, [pickerOpen, courseOptions]);

  const dirty = isDirty(academy, form);

  const save = async () => {
    if (!academy || !dirty) return;
    setSaving(true);
    try {
      const patch: Record<string, string | null> = {};
      for (const [k, v] of Object.entries(form)) {
        if ((v ?? '') !== ((academy as any)[k] ?? '')) patch[k] = v === '' ? null : v;
      }
      const res = await fetch(`/api/proxy/admin/academies/${academy.slug}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? `Request failed (${res.status})`);
      }
      const updated = await res.json();
      toast({ type: 'ok', title: t('saved', { default: 'Academy saved' }) });
      // Slug may have been edited — stay on the (possibly new) slug.
      if (updated.slug && updated.slug !== academy.slug) {
        router.replace(`/admin/academies/${updated.slug}/edit`);
      } else {
        void load();
      }
    } catch (e: any) {
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
      const res = await fetch(`/api/proxy/admin/academies/${academy.slug}/${action}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        if (action === 'publish') {
          const vres = await fetch(`/api/proxy/admin/academies/${academy.slug}/validate`, {
            credentials: 'include',
          });
          const vdata = await vres.json().catch(() => null);
          setPublishReasons(Array.isArray(vdata?.reasons) ? vdata.reasons : []);
          setPublishWarnings(Array.isArray(vdata?.warnings) ? vdata.warnings : []);
        }
        const data = await res.json().catch(() => null);
        const details =
          Array.isArray(data?.reasons) && data.reasons.length
            ? data.reasons.join('; ')
            : (data?.message ?? `Request failed (${res.status})`);
        throw new Error(details);
      }
      const publishedData = await res.json().catch(() => null);
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
      await load();
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
      const res = await fetch(`/api/proxy/admin/academies/${academy.slug}/courses`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseSlugs: slugs }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? `Request failed (${res.status})`);
      }
      const data = await res.json();
      toast({
        type: 'ok',
        title: t('coursesAdded', {
          count: data.assigned,
          default: '{count, plural, one {# course added} other {# courses added}}',
        }),
      });
      setPickerOpen(false);
      setPickerSelected([]);
      void load();
    } catch (e: any) {
      toast({ type: 'err', title: t('assignFailed', { default: 'Assign failed' }), description: e?.message });
    } finally {
      setAssigning(false);
    }
  };

  /** Unassign via the course PATCH flow (academyId: null) — never deletes course data. */
  const removeCourse = async (courseSlug: string) => {
    try {
      const res = await fetch(`/api/proxy/admin/courses/${courseSlug}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ academyId: null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? `Request failed (${res.status})`);
      }
      toast({ type: 'ok', title: t('courseRemoved', { default: 'Course removed from academy' }) });
      void load();
    } catch (e: any) {
      toast({ type: 'err', title: t('courseRemoveFailed', { default: 'Remove failed' }), description: e?.message });
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // re-bound every render so `save` closure stays fresh

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1500px] space-y-6 pt-6">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <FormSkeleton fields={4} />
          </div>
          <div className="space-y-5">
            <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
              <FormSkeleton fields={1} />
            </div>
            <Skeleton className="h-56 rounded-xl border border-border" />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <FormSkeleton fields={3} />
        </div>
      </div>
    );
  }
  if (error || !academy) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-base text-foreground">{error || 'Academy not found'}</p>
        <button
          type="button"
          onClick={() => router.push('/admin/academies')}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs transition hover:bg-primary active:scale-[0.98]"
        >
          Back to academies
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
  return (
    <div className="w-full">
      <AdminCommandBar
        trail={[{ label: tAdmin('academies'), href: '/admin/academies' }, { label: academy.title }]}
        live={
          dirty ? (
            t('unsaved', { default: 'Unsaved changes' })
          ) : academy.isPublished ? (
            t('live', { default: 'Live' })
          ) : (
            t('draft', { default: 'Draft' })
          )
        }
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
        primary={
          <BarPrimaryButton
            icon={<Save className="size-4" strokeWidth={2.5} />}
            disabled={!dirty || saving}
            onClick={() => void save()}
          >
            {saving ? t('saving', { default: 'Saving…' }) : t('saveChanges', { default: 'Save changes' })}
          </BarPrimaryButton>
        }
      />

      <div className="mx-auto w-full max-w-[1500px] space-y-6 pt-6">
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
          badge={
            <StatusPill
              label={
                academy.isArchived
                  ? t('statusArchived', { default: 'Archived' })
                  : academy.isPublished
                    ? t('statusPublished', { default: 'Published' })
                    : t('statusDraft', { default: 'Draft' })
              }
              tone={academy.isArchived ? 'slate' : academy.isPublished ? 'emerald' : 'amber'}
              pulse={academy.isPublished}
              className="self-start md:self-auto"
            />
          }
        />

        {error && <ErrorBanner message={error} onRetry={() => void load()} retryLabel={tCommon('retry')} />}

        {/* Publishing is blocked or warned by the server; say which, and why. */}
        {publishReasons.length > 0 && (
          <div
            role="alert"
            className="rounded-xl border border-destructive/25 bg-destructive/8 px-4 py-3"
          >
            <p className="flex items-center gap-2 text-13 font-semibold text-destructive">
              <AlertCircle className="size-4" />
              {t('cannotPublish', { default: 'This academy cannot be published yet' })}
            </p>
            <ul className="mt-1.5 list-disc space-y-0.5 ps-6 text-xs text-destructive/90">
              {publishReasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}
        {publishReasons.length === 0 && publishWarnings.length > 0 && (
          <div className="rounded-xl border border-warning/30 bg-warning/8 px-4 py-3">
            <p className="flex items-center gap-2 text-13 font-semibold text-warning">
              <AlertTriangle className="size-4" />
              {t('publishedWithWarnings', { default: 'Published with warnings' })}
            </p>
            <ul className="mt-1.5 list-disc space-y-0.5 ps-6 text-xs text-warning/90">
              {publishWarnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Basics and the live preview sit together, so a title or accent change
            is visible while it is being typed. */}
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <FormSection
            title={t('basics', { default: 'Basics' })}
            icon={Store}
            description={t('basicsDesc', {
              default: 'How this academy is named and described.',
            })}
          >
            <div className="space-y-4">
              <TextField
                label={t('title', { default: 'Title' })}
                required
                dir="auto"
                value={form.title ?? ''}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <Field
                label={t('slug', { default: 'Slug' })}
                hint={t('slugHint', { default: 'The public address. External URLs are disabled.' })}
              >
                {(a) => (
                  <TextInput {...a} value={academy.slug} readOnly dir="ltr" className="font-mono" />
                )}
              </Field>
              <TextField
                label={t('subtitle', { default: 'Subtitle' })}
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

          <div className="space-y-5 lg:sticky lg:top-24">
            <FormSection
              title={t('accent', { default: 'Accent colour' })}
              icon={Palette}
              description={t('accentDesc', {
                default: 'Used across this academy and its course cards.',
              })}
            >
              <Field
                label={t('accentLabel', { default: 'Hex value' })}
                error={
                  form.accentColor && !/^#[0-9a-fA-F]{6}$/.test(form.accentColor)
                    ? t('accentInvalid', { default: 'Use a 6-digit hex value.' })
                    : undefined
                }
              >
                {(a) => (
                  <div className="flex items-center gap-2">
                    <span className="relative shrink-0">
                      <input
                        type="color"
                        value={HEX.test(form.accentColor ?? '') ? (form.accentColor as string) : '#1E40AF'}
                        onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                        aria-label={t('accentLabel', { default: 'Hex value' })}
                        className="size-10 cursor-pointer rounded-xl border border-border bg-transparent p-1"
                      />
                    </span>
                    <TextInput
                      {...a}
                      dir="ltr"
                      value={form.accentColor ?? ''}
                      onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                      spellCheck={false}
                      className="font-mono"
                    />
                  </div>
                )}
              </Field>
            </FormSection>

            <AcademyPreview
              title={form.title || t('previewPlaceholderName', { default: 'Untitled academy' })}
              subtitle={form.subtitle ?? null}
              description={form.description ?? null}
              logoUrl={academy.logoUrl}
              heroImageUrl={academy.heroImageUrl}
              accent={HEX.test(form.accentColor ?? '') ? (form.accentColor as string) : '#1E40AF'}
              courseCount={academy.courseCount}
            />
          </div>
        </div>

        {/* Images share a row because they are the same kind of control. */}
        <FormSection
          title={t('images', { default: 'Images' })}
          icon={ImageIcon}
          description={t('imagesDesc', {
            default: 'Upload only — external URLs are disabled.',
          })}
          bodyClassName="p-5"
        >
          <div className="grid gap-5 lg:grid-cols-3">
            <AcademyImageField
              label={t('heroBanner', { default: 'Hero banner' })}
              hint={t('heroHint', {
                default: 'Branding · 1920×1080 recommended · JPG/PNG/WebP/AVIF · ≤5 MB.',
              })}
              kind="hero"
              slug={academy.slug}
              currentUrl={academy.heroImageUrl}
              onChanged={() => void load()}
            />
            <AcademyImageField
              label={t('logo', { default: 'Logo / mark' })}
              hint={t('logoHint', {
                default: 'Square PNG/WebP with a transparent background · ≤5 MB.',
              })}
              kind="logo"
              slug={academy.slug}
              currentUrl={academy.logoUrl}
              onChanged={() => void load()}
            />
            <AcademyImageField
              label={t('socialImage', { default: 'Social preview image' })}
              hint={t('socialHint', {
                default: 'og:image · 1200×630 recommended · JPG/PNG/WebP · ≤5 MB.',
              })}
              kind="seo"
              slug={academy.slug}
              currentUrl={academy.seoImageUrl}
              onChanged={() => void load()}
            />
          </div>
        </FormSection>

        <FormSection
          title={t('seo', { default: 'SEO' })}
          icon={Search}
          description={t('seoDesc', {
            default: 'Overrides for search results. Blank falls back to the title and description above.',
          })}
        >
          <div className="grid gap-4 sm:grid-cols-2">
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
              rows={2}
              value={form.seoDescription ?? ''}
              onChange={(e) => setForm({ ...form, seoDescription: e.target.value })}
              placeholder={t('seoDescriptionPlaceholder', {
                default: 'Meta description for search & social unfurls',
              })}
            />
          </div>
        </FormSection>

        <FormSection
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
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-xs transition hover:bg-primary"
                >
                  <Plus className="size-4" />
                  {t('assignFirst', { default: 'Assign the first course' })}
                </button>
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {academy.courses.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-muted/40"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
                    {c.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.thumbnailUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <GraduationCap className="size-4 text-muted-foreground" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p dir="auto" className="truncate text-13 font-semibold text-foreground">
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
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-xs transition hover:bg-muted"
                    >
                      <ExternalLink className="size-3.5" />
                      {t('openStudio', { default: 'Open Studio' })}
                    </a>
                    <button
                      type="button"
                      onClick={() => void removeCourse(c.slug)}
                      aria-label={t('removeCourse', { title: c.title, default: 'Remove {title} from this academy' })}
                      title={t('removeCourse', { title: c.title, default: 'Remove {title} from this academy' })}
                      className="flex size-8 items-center justify-center rounded-lg border border-border text-destructive transition hover:bg-destructive/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </FormSection>
      </div>

      {/* Course picker */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={t('pickerTitle', { title: academy.title, default: 'Assign courses to {title}' })}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPickerOpen(false);
          }}
        >
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <h3 className="text-sm font-bold text-foreground">
                {t('pickerTitle', { title: academy.title, default: 'Assign courses to {title}' })}
              </h3>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                aria-label={tCommon('close', { default: 'Close' })}
                className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="border-b border-border px-5 py-3">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2 transition focus-within:border-primary/60 focus-within:bg-background focus-within:ring-4 focus-within:ring-primary/10">
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
            <div className="max-h-80 overflow-y-auto">
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
                        'flex cursor-pointer items-center gap-3 border-b border-border px-5 py-3 transition last:border-0',
                        already ? 'opacity-50' : 'hover:bg-muted/50',
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
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/30 px-5 py-3">
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
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
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-xs transition hover:bg-primary disabled:opacity-50"
              >
                {assigning ? t('assigning', { default: 'Assigning…' }) : t('assign', { default: 'Assign' })}
              </button>
            </div>
          </div>
        </div>
      )}
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
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <header className="flex items-center gap-2 border-b border-border bg-muted/30 px-5 py-3.5">
        <Palette className="size-4 shrink-0 text-primary" />
        <h2 className="text-13 font-semibold text-foreground">
          {t('preview', { default: 'Live preview' })}
        </h2>
        <span className="ms-auto font-mono text-2xs uppercase tracking-wide text-muted-foreground">
          {accent}
        </span>
      </header>
      <div className="p-5">
        <div className="relative overflow-hidden rounded-xl border border-border">
          {/* Hero image when uploaded, otherwise an accent wash so the colour
              choice is still legible. */}
          {heroImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroImageUrl} alt="" className="h-36 w-full object-cover" />
          ) : (
            <div
              className="h-36 w-full"
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
              <p dir="auto" className="truncate text-sm font-bold text-white">
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
      const res = await fetch(`/api/proxy/admin/academies/${slug}/images`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, image: dataUrl, filename: file.name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? t('uploadFailedStatus', { default: 'Upload failed' }));
      }
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
      const res = await fetch(`/api/proxy/admin/academies/${slug}/images/${kind}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? t('removeFailedStatus', { default: 'Remove failed' }));
      }
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
      <span className="text-xs font-semibold text-foreground">{label}</span>
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
          'group relative flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed border-border-strong bg-muted/30 px-3 py-4 text-center transition',
          'hover:border-primary/50 hover:bg-primary/5',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          drag && 'border-primary bg-primary/10',
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
            <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition group-hover:border-primary/40 group-hover:text-primary">
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
            className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:border-destructive/40 hover:bg-destructive/8 hover:text-destructive disabled:opacity-50"
          >
            {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}
