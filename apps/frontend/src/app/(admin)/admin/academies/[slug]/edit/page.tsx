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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import {
  AdminCommandBar,
  BarButton,
  BarPrimaryButton,
  AdminPageHeader,
} from '@/components/admin/admin-chrome';
import { TableCard } from '@/components/admin/admin-ui';

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
  const [academy, setAcademy] = useState<AcademyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [form, setForm] = useState<Partial<Record<EditableField, string>>>({});
  const [publishReasons, setPublishReasons] = useState<string[]>([]);
  const [publishWarnings, setPublishWarnings] = useState<string[]>([]);
  const [rosterReload, setRosterReload] = useState(0);

  // Course picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [courseOptions, setCourseOptions] = useState<CourseOption[] | null>(null);
  const [pickerQuery, setPickerQuery] = useState('');
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
      toast({ type: 'ok', title: 'Academy saved' });
      // Slug may have been edited — stay on the (possibly new) slug.
      if (updated.slug && updated.slug !== academy.slug) {
        router.replace(`/admin/academies/${updated.slug}/edit`);
      } else {
        void load();
      }
    } catch (e: any) {
      toast({ type: 'err', title: 'Save failed', description: e?.message });
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
            title: 'Academy published with warnings',
            description: warnings.join('; '),
          });
        } else {
          toast({
            type: 'ok',
            title: action === 'publish' ? 'Academy published' : 'Academy unpublished',
          });
        }
      } catch {
        setPublishReasons([]);
        setPublishWarnings([]);
        toast({
          type: 'ok',
          title: action === 'publish' ? 'Academy published' : 'Academy unpublished',
        });
      }
      // `publishedData` holds the fresh academy row but `load()` refreshes roster + counts.
      void publishedData;
      await load();
    } catch (e: any) {
      toast({ type: 'err', title: 'Action failed', description: e?.message });
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
      toast({ type: 'ok', title: `${data.assigned} course(s) added` });
      setPickerOpen(false);
      setRosterReload((n) => n + 1);
      void load();
    } catch (e: any) {
      toast({ type: 'err', title: 'Assign failed', description: e?.message });
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
      toast({ type: 'ok', title: 'Course removed from academy' });
      setRosterReload((n) => n + 1);
      void load();
    } catch (e: any) {
      toast({ type: 'err', title: 'Remove failed', description: e?.message });
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
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
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
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.98]"
        >
          Back to academies
        </button>
      </div>
    );
  }

  const status = academy.isArchived ? 'Archived' : academy.isPublished ? 'Published' : 'Draft';
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
        trail={[{ label: 'Academies', href: '/admin/academies' }, { label: academy.title }]}
        live="Live"
        actions={
          <BarButton
            icon={
              academy.isPublished ? (
                <GlobeLock className="h-4 w-4" />
              ) : (
                <Globe className="h-4 w-4" />
              )
            }
            disabled={publishing}
            onClick={() => void togglePublish()}
          >
            {publishing ? 'Working…' : academy.isPublished ? 'Unpublish' : 'Publish'}
          </BarButton>
        }
        primary={
          <BarPrimaryButton
            icon={<Save className="h-4 w-4" strokeWidth={2.5} />}
            disabled={!dirty || saving}
            onClick={() => void save()}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </BarPrimaryButton>
        }
      />

      <div className="mx-auto w-full max-w-[1500px] space-y-6 pt-6">
        <AdminPageHeader
          title={academy.title}
          description={`/academy/${academy.slug} · ${academy.courseCount} course(s)`}
          badge={
            <span
              className={cn(
                'flex items-center gap-1.5 self-start rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm md:self-auto',
                academy.isArchived
                  ? 'border-border bg-muted text-muted-foreground'
                  : academy.isPublished
                    ? 'border-emerald-200/80 bg-emerald-50/80 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200'
                    : 'border-amber-200/80 bg-amber-50/80 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200',
              )}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  academy.isArchived
                    ? 'bg-muted-foreground'
                    : academy.isPublished
                      ? 'bg-emerald-500'
                      : 'bg-amber-500',
                )}
              />
              {status}
            </span>
          }
        />

        {publishReasons.length > 0 && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/5 px-4 py-3">
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">
              Not ready to publish:
            </p>
            <ul className="mt-1 list-inside list-disc text-sm text-red-700/90 dark:text-red-300/90">
              {publishReasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        {publishReasons.length === 0 && publishWarnings.length > 0 && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
              Published with warnings:
            </p>
            <ul className="mt-1 list-inside list-disc text-sm text-amber-700/90 dark:text-amber-300/90">
              {publishWarnings.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Basics */}
          <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Basics
            </h2>
            <Field label="Title">
              <input
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-blue-500/60 focus:ring-4 focus:ring-blue-500/10"
                value={form.title ?? ''}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </Field>
            <Field label="Slug (immutable identifier — /academy/{slug})">
              <input
                className="h-9 w-full rounded-xl border border-border bg-muted px-3 font-mono text-sm text-muted-foreground outline-none"
                value={academy.slug}
                readOnly
              />
            </Field>
            <Field label="Subtitle">
              <input
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-blue-500/60 focus:ring-4 focus:ring-blue-500/10"
                value={form.subtitle ?? ''}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              />
            </Field>
            <Field label="Description">
              <textarea
                rows={5}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-blue-500/60 focus:ring-4 focus:ring-blue-500/10"
                value={form.description ?? ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
          </section>

          {/* Branding + SEO — upload-only, no URL text inputs */}
          <section className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Branding & SEO
            </h2>

            <AcademyImageField
              label="Hero banner"
              hint="Branding · 1920×1080 recommended · JPG/PNG/WebP/AVIF · ≤5 MB. Shown on the academy landing hero. Upload only — external URLs are disabled."
              kind="hero"
              slug={academy.slug}
              currentUrl={academy.heroImageUrl}
              onChanged={load}
            />
            <AcademyImageField
              label="Logo / mark"
              hint="Branding · Square PNG/WebP with transparent background · ≤5 MB. Used in navigation and cards. Upload only."
              kind="logo"
              slug={academy.slug}
              currentUrl={academy.logoUrl}
              onChanged={load}
            />

            <Field label="Accent color (hex, e.g. #7c3aed)">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="h-9 w-12 cursor-pointer rounded-lg border border-border bg-background"
                  value={
                    /^#[0-9a-fA-F]{6}$/.test(form.accentColor ?? '') ? form.accentColor! : '#7c3aed'
                  }
                  onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                />
                <input
                  className="h-9 w-full rounded-xl border border-border bg-background px-3 font-mono text-sm outline-none transition focus:border-blue-500/60 focus:ring-4 focus:ring-blue-500/10"
                  value={form.accentColor ?? ''}
                  onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                />
              </div>
            </Field>

            <div className="h-px bg-border" />

            <Field label="SEO title">
              <input
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-blue-500/60 focus:ring-4 focus:ring-blue-500/10"
                value={form.seoTitle ?? ''}
                onChange={(e) => setForm({ ...form, seoTitle: e.target.value })}
                placeholder="Custom <title> for search results (falls back to academy title)"
              />
            </Field>
            <Field label="SEO description">
              <textarea
                rows={3}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-blue-500/60 focus:ring-4 focus:ring-blue-500/10"
                value={form.seoDescription ?? ''}
                onChange={(e) => setForm({ ...form, seoDescription: e.target.value })}
                placeholder="Meta description for search & social unfurls"
              />
            </Field>
            <AcademyImageField
              label="Social preview image (og:image)"
              hint="SEO · 1200×630 recommended · JPG/PNG/WebP · ≤5 MB. Used for link previews (Twitter, LinkedIn, etc.). Upload only."
              kind="seo"
              slug={academy.slug}
              currentUrl={academy.seoImageUrl}
              onChanged={load}
            />
          </section>
        </div>

        {/* Course roster */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              <BookOpen className="h-4 w-4" /> Courses in this academy ({academy.courseCount})
            </h2>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-[13px] font-medium text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" /> Assign courses
            </button>
          </div>
          <TableCard key={rosterReload}>
            {academy.courses.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                No courses assigned yet. Use “Assign courses” or set the academy in Course Studio’s
                Basics step.
              </div>
            ) : (
              academy.courses.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 border-b border-border px-5 py-3 transition last:border-0 hover:bg-muted/50"
                >
                  {c.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.thumbnailUrl}
                      alt=""
                      className="h-12 w-20 shrink-0 rounded-lg border border-border bg-muted object-cover"
                    />
                  ) : (
                    <span className="flex h-12 w-20 shrink-0 items-center justify-center rounded-lg bg-muted text-lg font-bold text-muted-foreground/40">
                      {c.title?.[0] || '?'}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="block truncate text-sm font-semibold">{c.title}</span>
                      <span
                        className={cn(
                          'rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize',
                          c.isArchived
                            ? 'bg-muted text-muted-foreground'
                            : c.isPublished
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100',
                        )}
                      >
                        {c.isArchived ? 'archived' : c.isPublished ? 'published' : 'draft'}
                      </span>
                      {typeof c.difficulty === 'number' ? (
                        <span className="rounded-md bg-violet-600/10 px-2 py-0.5 text-[11px] font-bold text-violet-700 dark:text-violet-300">
                          L{c.difficulty}
                        </span>
                      ) : null}
                      {typeof c.estimatedHours === 'number' ? (
                        <span className="text-[11px] tabular-nums text-muted-foreground">
                          {c.estimatedHours}h
                        </span>
                      ) : null}
                      {typeof c.sortOrder === 'number' ? (
                        <span className="font-mono text-[11px] text-muted-foreground">
                          #{c.sortOrder}
                        </span>
                      ) : null}
                    </span>
                    {c.subtitle ? (
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {c.subtitle}
                      </span>
                    ) : null}
                    <span className="block truncate font-mono text-[11px] text-muted-foreground">
                      /{c.slug}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => router.push(`/admin/courses/${c.slug}/edit`)}
                    className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted"
                  >
                    Open Studio
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeCourse(c.slug)}
                    className="rounded-lg border border-red-200 bg-white p-2 text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
                    aria-label={`Remove ${c.title} from academy`}
                    title="Remove from academy (course is not deleted)"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </TableCard>
        </section>

        {/* Course picker modal */}
        {pickerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <h3 className="text-sm font-bold">Assign courses to {academy.title}</h3>
                <button
                  type="button"
                  onClick={() => setPickerOpen(false)}
                  className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="border-b border-border px-5 py-3">
                <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2 transition focus-within:border-blue-500/60 focus-within:bg-background focus-within:ring-4 focus-within:ring-blue-500/10">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <input
                    autoFocus
                    className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
                    placeholder="Search courses by title or slug…"
                    value={pickerQuery}
                    onChange={(e) => setPickerQuery(e.target.value)}
                  />
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {courseOptions === null ? (
                  <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                    Loading courses…
                  </div>
                ) : filteredOptions.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                    No unassigned courses match. Courses already in this academy are hidden.
                  </div>
                ) : (
                  filteredOptions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      disabled={assigning}
                      onClick={() => void assignCourses([c.slug])}
                      className="flex w-full items-center gap-2 border-b border-border px-5 py-3 text-left text-sm transition hover:bg-muted/50 disabled:opacity-50"
                    >
                      <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate font-medium">{c.title}</span>
                      <span className="truncate font-mono text-[11px] text-muted-foreground">
                        /{c.slug}
                      </span>
                    </button>
                  ))
                )}
              </div>
              <div className="border-t border-border bg-muted/40 px-5 py-3 text-xs text-muted-foreground">
                Assigning moves the course into this academy. Enrollments, progress and certificates
                are never affected.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

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
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const doUpload = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({
        type: 'err',
        title: 'Not an image',
        description: 'Please choose an image file (JPG, PNG, WebP, GIF, SVG, AVIF).',
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ type: 'err', title: 'File too large', description: 'Max 5 MB per image.' });
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
        throw new Error(data?.message ?? `Upload failed (${res.status})`);
      }
      toast({ type: 'ok', title: `${label} uploaded` });
      await onChanged();
    } catch (e: any) {
      toast({ type: 'err', title: 'Upload failed', description: e?.message });
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
        throw new Error(data?.message ?? `Delete failed (${res.status})`);
      }
      toast({ type: 'ok', title: `${label} removed` });
      await onChanged();
    } catch (e: any) {
      toast({ type: 'err', title: 'Remove failed', description: e?.message });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <div
        onClick={() => inputRef.current?.click()}
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
        className={
          'relative flex cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border border-dashed px-4 py-4 text-center text-xs transition ' +
          (drag
            ? 'border-blue-500 bg-blue-500/5'
            : currentUrl
              ? 'border-emerald-300 bg-emerald-50/40 dark:border-emerald-800'
              : 'border-border bg-muted/50 hover:border-blue-500/60 hover:bg-muted')
        }
      >
        {/* Inline preview — the uploaded image is visible *inside* the upload location itself */}
        {currentUrl && !uploading ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentUrl}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.18]"
          />
        ) : null}
        {drag && !uploading ? <div className="absolute inset-0 bg-blue-500/10" /> : null}
        <div className="relative z-10 flex flex-col items-center gap-1.5">
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : currentUrl ? (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow">
              <ImageIcon className="h-3.5 w-3.5" /> Uploaded — visible here
            </span>
          ) : (
            <Upload className="h-5 w-5 text-muted-foreground/70" />
          )}
          {/* Inline preview inside the upload location itself */}
          {currentUrl && !uploading ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentUrl}
              alt=""
              className={
                'mt-1 rounded-lg border-2 border-white bg-white object-cover shadow-md ' +
                (kind === 'logo' ? 'h-20 w-20 p-1' : kind === 'seo' ? 'h-20 w-32' : 'h-24 w-48')
              }
            />
          ) : null}
          <p className="font-sans font-medium text-foreground">
            {uploading
              ? 'Uploading…'
              : drag
                ? 'Drop to upload'
                : currentUrl
                  ? 'Drag & drop or click to replace'
                  : 'Drag & drop an image, or click to upload'}
          </p>
          <p className="max-w-[36ch] font-sans text-[11px] leading-4 text-muted-foreground/70">
            {hint}
          </p>
          <p className="font-sans text-[11px] text-muted-foreground/50">
            External URLs are disabled — only uploaded files are accepted.
          </p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml,image/avif"
        className="hidden"
        onChange={(e) => {
          void doUpload(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {currentUrl ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/50 p-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentUrl}
            alt=""
            className={
              'rounded-lg border border-border bg-white object-cover ' +
              (kind === 'logo' ? 'h-16 w-16 p-1' : kind === 'seo' ? 'h-16 w-28' : 'h-20 w-36')
            }
          />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              Uploaded to server
            </span>
            <span className="block font-mono text-[10px] text-muted-foreground">
              upload · {kind} · stored tenant-scoped
            </span>
          </span>
          <button
            type="button"
            onClick={() => void doDelete()}
            disabled={deleting}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400"
          >
            {deleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Remove
          </button>
        </div>
      ) : (
        <p className="font-sans text-xs text-muted-foreground">
          No image stored — upload a file above. External URLs are disabled.
        </p>
      )}
    </div>
  );
}
