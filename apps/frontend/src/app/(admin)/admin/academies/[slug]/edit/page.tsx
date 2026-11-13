'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Archive, ArchiveRestore, ExternalLink, Trash2 } from 'lucide-react';
import { ACADEMY_FIELDS, type AcademyContentTranslation, type ContentLocale } from '@titan/shared';
import { api } from '@/lib/api-client';
import { toast } from '@/components/ui/toast';
import { AdminCommandBar, BarButton } from '@/components/admin/admin-chrome';
import { ErrorBanner } from '@/components/admin/admin-ui';
import { SaveDock, SlugField, useFormGuard } from '@/components/admin/form-page';
import { TranslateAction, useTranslateDraft } from '@/components/admin/translation';
import {
  AsideCard,
  BilingualField,
  CheckList,
  EditorHeader,
  EditorLayout,
  EditorRail,
  EditorSection,
  LanguageModeProvider,
  SaveStateLine,
  jumpTo,
  useAutosave,
  useLanguageMode,
  useSaveState,
  type EditorCheck,
  type RailSection,
} from '@/components/admin/editor/editor-kit';
import { PublishSheet } from '@/components/admin/editor/publish-sheet';
import {
  AcademyCardPreview,
  AcademyHeroEditor,
  AcademyImageTile,
  AccentColorRow,
  BRAND_CLAY,
  HEX,
  contrastWithWhite,
} from './academy-hero-editor';
import { AcademyCourses, type RosterCourse } from './academy-courses';
import { AcademyEditorSkeleton } from '@/components/skeletons/admin-route-skeletons';
import { rememberListCount } from '@/lib/admin-shape-memory';

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

/** `GET /admin/academies/:slug/validate` — what the server checks before publishing. */
interface PublishValidation {
  ok: boolean;
  reasons: string[];
  warnings: string[];
  publishedCourseCount: number;
}

const TEXT_FIELDS = ['slug', 'title', 'subtitle', 'description', 'accentColor', 'seoTitle', 'seoDescription'] as const;
type TextField = (typeof TEXT_FIELDS)[number];
const ARABIC_FIELDS = ['title', 'subtitle', 'description', 'seoTitle', 'seoDescription'] as const;
type ArabicField = (typeof ARABIC_FIELDS)[number];

type AcademyFormValue = Record<TextField, string> & { ar: Record<ArabicField, string> };

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Reasons `validateForPublish` gives that the editor already checks itself, by name. */
const KNOWN_SERVER_REASONS = new Set(['Add an academy title', 'Set an academy slug']);

/** The form value a stored academy corresponds to, used for dirty tracking. */
function baselineOf(a: AcademyDetail): AcademyFormValue {
  return {
    slug: a.slug ?? '',
    title: a.title ?? '',
    subtitle: a.subtitle ?? '',
    description: a.description ?? '',
    accentColor: a.accentColor ?? '',
    seoTitle: a.seoTitle ?? '',
    seoDescription: a.seoDescription ?? '',
    ar: Object.fromEntries(ARABIC_FIELDS.map((f) => [f, a.translations?.ar?.[f] ?? ''])) as Record<
      ArabicField,
      string
    >,
  };
}

/**
 * Only the fields that changed, blanks as null — the PATCH shape the editor has
 * always sent. Arabic goes as the whole locale block: the API stores the object it
 * is given, so sending only the changed keys would blank the rest of the Arabic.
 */
function payloadOf(
  value: AcademyFormValue,
  baseline: AcademyFormValue,
  translations: AcademyDetail['translations'],
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const key of TEXT_FIELDS) {
    if (value[key] !== baseline[key]) patch[key] = value[key] === '' ? null : value[key];
  }
  if (ARABIC_FIELDS.some((f) => value.ar[f] !== baseline.ar[f])) {
    patch.translations = {
      ...(translations ?? {}),
      ar: Object.fromEntries(ARABIC_FIELDS.map((f) => [f, value.ar[f].trim() || null])),
    };
  }
  return patch;
}

function messageOf(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

export default function AcademyEditorPage() {
  return (
    <LanguageModeProvider>
      <AcademyEditor />
    </LanguageModeProvider>
  );
}

function AcademyEditor() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const t = useTranslations('admin.academiesPage.editor');
  const tList = useTranslations('admin.academiesPage');
  const tAdmin = useTranslations('admin');
  const tEditor = useTranslations('admin.academiesEditor');
  const tNew = useTranslations('admin.academiesNew');
  const tTranslate = useTranslations('admin.translate');
  const tCommon = useTranslations('common');
  const tk = useTranslations('admin.editorKit');
  const { mode } = useLanguageMode();

  const [academy, setAcademy] = useState<AcademyDetail | null>(null);
  const [baseline, setBaseline] = useState<AcademyFormValue | null>(null);
  const [value, setValue] = useState<AcademyFormValue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [validation, setValidation] = useState<PublishValidation | null>(null);
  const [validating, setValidating] = useState(false);
  /** Blocks autosave while an image upload is in flight, so a slug change can't race it. */
  const [uploadingCount, setUploadingCount] = useState(0);
  const beginUpload = useCallback(() => setUploadingCount((n) => n + 1), []);
  const endUpload = useCallback(() => setUploadingCount((n) => Math.max(0, n - 1)), []);

  /** The form as it is now, read after an await to see whether the user kept typing. */
  const valueRef = useRef(value);
  valueRef.current = value;
  /** Guards the in-flight request, not just the button: a double ⌘S fires before React re-renders. */
  const savingRef = useRef(false);
  /** The address the record is stored under now, which a save may have just changed. */
  const storedSlugRef = useRef<string | null>(null);

  /**
   * `silent` keeps the page on screen (no skeleton) for refreshes after an action.
   * `keepForm` refreshes the record without touching in-progress edits — an image
   * upload or a roster change must not wipe unsaved text.
   */
  const load = useCallback(
    async (opts?: { silent?: boolean; keepForm?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/proxy/admin/academies/${slug}`, { credentials: 'include' });
        if (!res.ok) throw new Error(tAdmin('drawer.requestFailed', { status: res.status }));
        const data: AcademyDetail = await res.json();
        setAcademy(data);
        // The roster is the editor's one data-sized part; the loading skeleton draws this many.
        rememberListCount('edit-academy-courses', data.courses?.length ?? 0);
        storedSlugRef.current = data.slug;
        if (opts?.keepForm) return;
        const next = baselineOf(data);
        setBaseline(next);
        setValue(next);
      } catch (e) {
        setError(messageOf(e) || tEditor('loadFailed'));
      } finally {
        setLoading(false);
      }
    },
    [slug, tAdmin, tEditor],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(() => load({ silent: true, keepForm: true }), [load]);

  const set = useCallback((key: TextField, next: string) => {
    setValue((prev) => (prev ? { ...prev, [key]: next } : prev));
  }, []);
  const setAr = useCallback((key: ArabicField, next: string) => {
    setValue((prev) => (prev ? { ...prev, ar: { ...prev.ar, [key]: next } } : prev));
  }, []);

  /* ── Arabic drafting ── */
  const translateGroups = useMemo(
    () => [
      {
        key: 'academy',
        fields: {
          Title: value?.title ?? '',
          Subtitle: value?.subtitle ?? '',
          Description: value?.description ?? '',
          'SEO title': value?.seoTitle ?? '',
          'SEO description': value?.seoDescription ?? '',
        },
      },
    ],
    [value?.title, value?.subtitle, value?.description, value?.seoTitle, value?.seoDescription],
  );
  const { busy: translateBusy, run: runTranslate, coverageFor } = useTranslateDraft({
    entity: 'academy copy',
    descriptors: ACADEMY_FIELDS,
    groups: translateGroups,
    onApply: (_key, translations) => {
      setValue((prev) =>
        prev
          ? {
              ...prev,
              ar: {
                title: translations['Title'] ?? prev.ar.title,
                subtitle: translations['Subtitle'] ?? prev.ar.subtitle,
                description: translations['Description'] ?? prev.ar.description,
                seoTitle: translations['SEO title'] ?? prev.ar.seoTitle,
                seoDescription: translations['SEO description'] ?? prev.ar.seoDescription,
              },
            }
          : prev,
      );
    },
    confirmOverwrite: () => window.confirm(tTranslate('overwriteConfirm')),
  });
  const coverage = value ? coverageFor(value, value.ar) : null;
  const draftArabic = () => void runTranslate('missing');

  /* ── Validity ── */
  const titleMissing = !!value && !value.title.trim();
  const slugInvalid = !!value && !SLUG_RE.test(value.slug);
  const accentInvalid = !!value && !!value.accentColor && !HEX.test(value.accentColor);
  const invalid = titleMissing || slugInvalid || accentInvalid;

  const fingerprint = JSON.stringify(value);
  const dirty = !!baseline && fingerprint !== JSON.stringify(baseline);
  const live = !!academy?.isPublished && !academy?.isArchived;

  /** Returns false when nothing was stored, so autosave and publish can tell. */
  const save = useCallback(
    async ({ quiet = false, auto = false }: { quiet?: boolean; auto?: boolean } = {}): Promise<boolean> => {
      if (!academy || !baseline || !value || !dirty || savingRef.current) return true;
      if (invalid) {
        // Autosave waits for a valid form instead of reporting a failure on every keystroke.
        if (auto) return true;
        setAttempted(true);
        if (!quiet) {
          toast({ type: 'err', title: t('fixErrors') });
          jumpTo(titleMissing ? 'ac-title' : slugInvalid ? 'words' : 'look');
        }
        return false;
      }
      savingRef.current = true;
      setSaving(true);
      const sent = JSON.stringify(value);
      try {
        const updated = await api.patch<Partial<AcademyDetail>>(
          `/admin/academies/${academy.slug}`,
          payloadOf(value, baseline, academy.translations),
        );
        setSaveFailed(false);
        setSaveError(null);
        setAttempted(false);
        if (!quiet) toast({ type: 'ok', title: t('saved') });
        // The PATCH answers with the row and a course count, not the roster: keep ours.
        const merged: AcademyDetail = { ...academy, ...updated, courses: academy.courses };
        const next = baselineOf(merged);
        setAcademy(merged);
        storedSlugRef.current = merged.slug;
        setBaseline(next);
        // Rehydrate from the response, unless the user kept typing while the request
        // was in flight: then their newer edits stay on screen and read as unsaved.
        if (JSON.stringify(valueRef.current) === sent) setValue(next);
        // A slug change moves the record to a new URL; follow it.
        if (updated?.slug && updated.slug !== slug) router.replace(`/admin/academies/${updated.slug}/edit`);
        return true;
      } catch (e) {
        const message = messageOf(e);
        setSaveFailed(true);
        setSaveError(message ?? t('saveFailed'));
        if (!quiet) toast({ type: 'err', title: t('saveFailed'), description: message });
        return false;
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [academy, baseline, value, dirty, invalid, titleMissing, slugInvalid, slug, router, t],
  );

  // Drafts save themselves; a live academy waits for Save so visitors never see a
  // half-typed edit.
  useAutosave({
    enabled: !!academy && !live && uploadingCount === 0,
    dirty,
    saving,
    save: () => save({ quiet: true, auto: true }),
    fingerprint,
  });
  useFormGuard({ dirty: !live && dirty, saving, onSave: () => void save() });
  const saveState = useSaveState({ dirty, saving, failed: saveFailed });

  /* ── Server checks, fetched when the review sheet opens ── */
  const academySlug = academy?.slug;
  useEffect(() => {
    if (!reviewOpen || !academySlug) return;
    let cancelled = false;
    setValidating(true);
    void (async () => {
      try {
        const res = await fetch(`/api/proxy/admin/academies/${academySlug}/validate`, { credentials: 'include' });
        const data: PublishValidation | null = res.ok ? await res.json().catch(() => null) : null;
        if (!cancelled) setValidation(data);
      } catch {
        if (!cancelled) setValidation(null);
      } finally {
        if (!cancelled) setValidating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reviewOpen, academySlug]);

  const setPublished = async (publish: boolean) => {
    if (!academy) return;
    setPublishing(true);
    try {
      // Publish what is on screen, not what was last stored.
      if (dirty && !(await save({ quiet: true }))) {
        toast({ type: 'err', title: t('saveFailed') });
        return;
      }
      const target = storedSlugRef.current ?? academy.slug;
      await api.post(`/admin/academies/${target}/${publish ? 'publish' : 'unpublish'}`);
      const visible = academy.courses.filter((c) => c.isPublished && !c.isArchived).length;
      if (publish && visible === 0) {
        toast({ type: 'ok', title: t('publishedWithWarnings'), description: t('checkNoCoursesDetail') });
      } else {
        toast({ type: 'ok', title: publish ? t('published') : t('unpublished') });
      }
      setReviewOpen(false);
      if (target === slug) await refresh();
    } catch (e) {
      // The server lists why it refused; show those rather than its generic headline.
      const reasons = (e as { body?: { reasons?: unknown } }).body?.reasons;
      const description =
        Array.isArray(reasons) && reasons.length ? reasons.join(' · ') : messageOf(e);
      toast({ type: 'err', title: t('actionFailed'), description });
    } finally {
      setPublishing(false);
    }
  };

  const archiveOrRestore = async () => {
    if (!academy) return;
    const restoring = academy.isArchived;
    if (!restoring && !window.confirm(t('confirmArchive', { title: academy.title }))) return;
    setBusy(true);
    try {
      await api.post(`/admin/academies/${academy.slug}/${restoring ? 'restore' : 'archive'}`);
      toast({ type: 'ok', title: restoring ? tList('restoredToast') : tList('archivedToast') });
      await refresh();
    } catch (e) {
      toast({ type: 'err', title: t('actionFailed'), description: messageOf(e) });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!academy) return;
    if (!window.confirm(t('confirmDelete', { title: academy.title }))) return;
    setBusy(true);
    try {
      await api.delete(`/admin/academies/${academy.slug}`);
      toast({ type: 'ok', title: t('deleted') });
      router.push('/admin/academies');
    } catch (e) {
      // 409 when courses are still assigned; the server says how many.
      toast({ type: 'err', title: t('deleteFailed'), description: messageOf(e) });
      setBusy(false);
    }
  };

  if (loading) {
    return <AcademyEditorSkeleton />;
  }

  if (!academy || !value) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-balance font-display text-xl font-medium tracking-[-0.015em] text-foreground">
          {error || tEditor('notFound')}
        </p>
        <button
          type="button"
          onClick={() => router.push('/admin/academies')}
          className="inline-flex min-h-10 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90"
        >
          {tEditor('backToAcademies')}
        </button>
      </div>
    );
  }

  /* ── Derived view ── */
  const displayTitle = value.title.trim() || academy.title || t('previewPlaceholderName');
  const ar = mode === 'ar';
  const shownTitle = (ar && value.ar.title.trim()) || displayTitle;
  const shownSubtitle = (ar && value.ar.subtitle.trim()) || value.subtitle;
  const shownDescription = (ar && value.ar.description.trim()) || value.description;
  const accent = HEX.test(value.accentColor) ? value.accentColor : BRAND_CLAY;
  const contrast = contrastWithWhite(accent) ?? 0;

  const total = academy.courses.length;
  const visibleCourses = academy.courses.filter((c) => c.isPublished && !c.isArchived).length;
  const drafts = total - visibleCourses;
  const coursesCheck: EditorCheck =
    total === 0
      ? { label: t('checkNoCourses'), detail: t('checkNoCoursesDetail'), ok: false, optional: true, target: 'courses' }
      : visibleCourses === 0
        ? {
            label: t('checkNoneLive'),
            detail: t('checkDraftsDetail', { published: 0, total }),
            ok: false,
            optional: true,
            target: 'courses',
          }
        : drafts > 0
          ? {
              label: t('checkDrafts', { count: drafts }),
              detail: t('checkDraftsDetail', { published: visibleCourses, total }),
              ok: false,
              optional: true,
              target: 'courses',
            }
          : { label: t('checkCoursesLive', { count: total }), ok: true };

  /**
   * Required checks are what stops publishing: the server refuses without a title
   * and an address (`validateForPublish`), and an invalid accent cannot be saved,
   * which publishing does first. Everything else is advice.
   */
  const checks: EditorCheck[] = [
    { label: t('checkName'), ok: !titleMissing, target: 'ac-title' },
    { label: t('checkAddress'), ok: !slugInvalid, target: 'words' },
    { label: t('checkAccent'), ok: !accentInvalid, target: 'look' },
    { label: t('checkDescription'), ok: !!value.description.trim(), optional: true, target: 'ac-description' },
    { label: t('checkHero'), ok: !!academy.heroImageUrl, optional: true, target: 'look' },
    { label: t('checkLogo'), ok: !!academy.logoUrl, optional: true, target: 'look' },
    { label: t('checkContrast'), ok: contrast >= 4.5, optional: true, target: 'look' },
    coursesCheck,
  ];
  const done = checks.filter((c) => c.ok).length;
  const serverReasons = (validation?.reasons ?? []).filter((r) => !KNOWN_SERVER_REASONS.has(r));
  const sheetChecks: EditorCheck[] = [
    ...checks,
    ...serverReasons.map((reason) => ({ label: reason, ok: false })),
    ...(validating ? [{ label: t('serverChecking'), ok: false, optional: true }] : []),
  ];
  const blocked = sheetChecks.some((c) => !c.ok && !c.optional);
  const asideChecks: EditorCheck[] =
    coverage && coverage.total > 0
      ? [
          ...checks,
          {
            label: tk('publish.arabicCoverage', { translated: coverage.translated, total: coverage.total }),
            ok: coverage.translated >= coverage.total,
            optional: true,
            target: 'ac-title',
          },
        ]
      : checks;

  const missingArabic = coverage ? coverage.total - coverage.translated : 0;
  const rail: RailSection[] = [
    {
      id: 'look',
      label: t('sectionLook'),
      state: attempted && accentInvalid ? 'error' : academy.heroImageUrl ? 'done' : 'idle',
    },
    {
      id: 'words',
      label: t('sectionWords'),
      state:
        attempted && (titleMissing || slugInvalid)
          ? 'error'
          : value.title.trim() && value.description.trim() && missingArabic === 0
            ? 'done'
            : 'todo',
      meta: coverage && missingArabic > 0 ? `AR ${coverage.translated}/${coverage.total}` : undefined,
    },
    {
      id: 'courses',
      label: t('roster'),
      state: total > 0 && drafts === 0 ? 'done' : 'todo',
      meta: total,
    },
    { id: 'seo', label: tNew('seoSharing'), state: value.seoTitle.trim() ? 'done' : 'idle' },
  ];

  const statusTone = academy.isArchived ? 'archived' : academy.isPublished ? 'live' : 'draft';
  const statusLabel = academy.isArchived
    ? t('statusArchived')
    : academy.isPublished
      ? t('statusPublished')
      : t('statusDraft');

  return (
    <div className="w-full">
      <AdminCommandBar
        trail={[{ label: tAdmin('academies'), href: '/admin/academies' }, { label: academy.title }]}
        live={live ? t('live') : false}
        actions={
          <>
            <BarButton
              icon={
                academy.isArchived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />
              }
              title={academy.isArchived ? tList('actionRestore') : tList('actionArchive')}
              disabled={busy}
              onClick={() => void archiveOrRestore()}
            >
              {academy.isArchived ? tList('actionRestore') : tList('actionArchive')}
            </BarButton>
            <BarButton
              icon={<Trash2 className="size-4" />}
              title={t('delete')}
              disabled={busy}
              onClick={() => void handleDelete()}
            >
              {t('delete')}
            </BarButton>
          </>
        }
      />

      <EditorHeader
        status={{ tone: statusTone, label: statusLabel }}
        saveLine={<SaveStateLine state={saveState} autosave={!live} onRetry={() => void save()} />}
        title={displayTitle}
        subtitle={
          <span dir="ltr" className="break-all">
            barootcnc.com/academy/<span className="font-mono text-foreground">{academy.slug}</span>
            {' · '}
            {t('courseCount', { count: total })}
          </span>
        }
        previewHref={`/academy/${academy.slug}`}
        onReview={() => setReviewOpen(true)}
        reviewLabel={live ? tk('reviewLive') : tk('reviewAndPublish')}
      />
      {(error || saveError) && (
        <div className="mx-auto mb-4 flex w-full max-w-[90rem] flex-col gap-2">
          {error && <ErrorBanner message={error} onRetry={() => void refresh()} retryLabel={tCommon('retry')} />}
          {saveError && <ErrorBanner message={saveError} />}
        </div>
      )}

      <EditorLayout
        rail={
          <EditorRail
            sections={rail}
            readiness={{ done, total: checks.length, note: live ? tk('liveNote') : tk('draftNote') }}
          />
        }
        aside={
          <>
            <AsideCard eyebrow={t('cardOnAcademiesPage')} meta={ar ? 'العربية' : tk('modeEnglish')}>
              <AcademyCardPreview
                title={shownTitle}
                subtitle={shownSubtitle}
                description={shownDescription}
                imageUrl={academy.heroImageUrl || academy.logoUrl || academy.seoImageUrl}
                logoUrl={academy.logoUrl}
                accent={accent}
                courseCount={visibleCourses}
              />
              <a
                href={`/academy/${academy.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center gap-1.5 text-13 font-medium text-primary hover:underline"
              >
                {t('viewPage')}
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            </AsideCard>
            <AsideCard title={tk('beforePublish')}>
              <CheckList checks={asideChecks} />
            </AsideCard>
          </>
        }
      >
        <EditorSection id="look" title={t('sectionLook')} hint={t('sectionLookHint')}>
          <AcademyHeroEditor
            slug={academy.slug}
            heroImageUrl={academy.heroImageUrl}
            logoUrl={academy.logoUrl}
            accent={accent}
            title={shownTitle}
            subtitle={shownSubtitle}
            onChanged={refresh}
            onUploadStart={beginUpload}
            onUploadEnd={endUpload}
          />
          <AccentColorRow
            value={value.accentColor}
            onChange={(next) => set('accentColor', next)}
            error={accentInvalid ? t('accentInvalid') : undefined}
          />
        </EditorSection>

        <EditorSection
          id="words"
          title={t('sectionWords')}
          hint={t('sectionWordsHint')}
          actions={
            <TranslateAction coverage={coverage} busy={translateBusy} onTranslate={(scope) => void runTranslate(scope)} />
          }
        >
          <BilingualField
            id="ac-title"
            label={t('name')}
            required
            error={titleMissing ? tNew('titleRequired') : undefined}
            en={{ value: value.title, onChange: (next) => set('title', next), placeholder: tNew('titlePlaceholder') }}
            ar={{ value: value.ar.title, onChange: (next) => setAr('title', next) }}
            onDraftArabic={draftArabic}
            drafting={translateBusy}
          />
          <SlugField
            label={t('slug')}
            mode="edit"
            prefix="/academy/"
            value={value.slug}
            onChange={(next) => set('slug', next)}
            error={slugInvalid ? t('slugInvalid') : undefined}
          />
          <BilingualField
            id="ac-subtitle"
            label={t('subtitle')}
            hint={tNew('subtitleHint')}
            en={{ value: value.subtitle, onChange: (next) => set('subtitle', next) }}
            ar={{ value: value.ar.subtitle, onChange: (next) => setAr('subtitle', next) }}
            onDraftArabic={draftArabic}
            drafting={translateBusy}
          />
          <BilingualField
            id="ac-description"
            label={t('description')}
            multiline
            rows={5}
            en={{ value: value.description, onChange: (next) => set('description', next) }}
            ar={{ value: value.ar.description, onChange: (next) => setAr('description', next) }}
            onDraftArabic={draftArabic}
            drafting={translateBusy}
          />
        </EditorSection>

        <EditorSection id="courses" title={t('roster')} hint={t('rosterDesc')}>
          <AcademyCourses
            academySlug={academy.slug}
            academyId={academy.id}
            academyTitle={academy.title}
            courses={academy.courses}
            onChanged={refresh}
          />
        </EditorSection>

        <EditorSection id="seo" title={tNew('seoSharing')} hint={t('seoDesc')}>
          <BilingualField
            id="ac-seo-title"
            label={t('seoTitle')}
            en={{ value: value.seoTitle, onChange: (next) => set('seoTitle', next), placeholder: t('seoTitlePlaceholder') }}
            ar={{ value: value.ar.seoTitle, onChange: (next) => setAr('seoTitle', next) }}
            onDraftArabic={draftArabic}
            drafting={translateBusy}
          />
          <BilingualField
            id="ac-seo-description"
            label={t('seoDescription')}
            multiline
            rows={3}
            en={{
              value: value.seoDescription,
              onChange: (next) => set('seoDescription', next),
              placeholder: t('seoDescriptionPlaceholder'),
            }}
            ar={{ value: value.ar.seoDescription, onChange: (next) => setAr('seoDescription', next) }}
            onDraftArabic={draftArabic}
            drafting={translateBusy}
          />
          <div className="max-w-md">
            <AcademyImageTile
              slug={academy.slug}
              kind="seo"
              label={t('socialImage')}
              hint={t('socialHint')}
              currentUrl={academy.seoImageUrl}
              onChanged={refresh}
              onUploadStart={beginUpload}
              onUploadEnd={endUpload}
            />
          </div>
        </EditorSection>
      </EditorLayout>

      {live && (
        <SaveDock
          mode="edit"
          dirty={dirty}
          saving={saving}
          failed={saveFailed}
          onSave={() => void save()}
          onDiscard={baseline ? () => setValue(baseline) : undefined}
          saveLabel={t('saveChanges')}
          savingLabel={t('saving')}
        />
      )}

      <PublishSheet
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        eyebrow={`${tAdmin('academies')} · ${academy.title}`}
        title={displayTitle}
        lead={t('sheetLead')}
        checks={sheetChecks}
        arabic={
          coverage
            ? { translated: coverage.translated, total: coverage.total, onDraft: draftArabic, drafting: translateBusy }
            : undefined
        }
        arabicPreview={
          <>
            <span className="text-lg text-foreground">{value.ar.title.trim() || value.title}</span>
            <span className="text-13 text-muted-foreground">{value.ar.subtitle.trim() || value.subtitle}</span>
          </>
        }
        isPublished={live}
        busy={publishing}
        blocked={blocked}
        onPublish={() => void setPublished(true)}
        onUnpublish={() => void setPublished(false)}
      />
    </div>
  );
}
