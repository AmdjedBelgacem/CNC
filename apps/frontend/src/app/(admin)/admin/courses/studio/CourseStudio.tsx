'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AlertCircle, AlertTriangle, Eye, Loader2, Save } from 'lucide-react';
import { DEFAULT_CURRENCY, isCurrencyCode } from '@titan/shared';
import type { ContentLocale, LessonContentDocument } from '@titan/shared';
import { AdminCommandBar } from '@/components/admin/admin-chrome';
import { useFormGuard } from '@/components/admin/form-page';
import {
  AsideCard,
  CheckList,
  EditorHeader,
  EditorLayout,
  EditorRail,
  LanguageModeProvider,
  SaveStateLine,
  useLanguageMode,
  useSaveState,
  type EditorCheck,
  type RailSection,
  type SaveState,
} from '@/components/admin/editor/editor-kit';
import { PublishSheet } from '@/components/admin/editor/publish-sheet';
import { difficultyFallback, difficultyKey } from '@/lib/difficulty';
import { CourseCardPreview } from './SummaryPanel';
import { StepBasics } from './StepBasics';
import { StepMedia } from './StepMedia';
import { StepPricing } from './StepPricing';
import { StepLocalization } from './StepSeo';
import { StepLive } from './StepLive';
import { StepArabic } from './StepArabic';
import { StepPublish } from './StepPublish';
import { StudioPreview } from './StudioPreview';
import { CurriculumBuilder } from './CurriculumBuilder';
import { LessonDrawer } from './LessonDrawer';
import { LessonInspector, type LessonDrawerTab } from './LessonInspector';
import { allStepsDone, arabicCoverage, reasonToSection, stepHint, stepLabel, stepStates } from './completeness';
import { useCourseCopyTranslate } from './useCourseTranslate';
import { slugify } from './slugify';
import { toast } from '@/components/ui/toast';
import { Crossfade, Reveal } from '@/components/ui/motion';
import type { CourseStudioData, Lesson, Section } from './types';
import * as api from './api';

/** Rail order. `publish` was the old name of `certificate`; old links still land there. */
const STEP_KEYS = ['basics', 'curriculum', 'media', 'pricing', 'live', 'arabic', 'localization', 'certificate'] as const;
type StepKey = (typeof STEP_KEYS)[number];

function readStepKey(value: string | null): StepKey | null {
  if (value === 'publish') return 'certificate';
  return value && (STEP_KEYS as readonly string[]).includes(value) ? (value as StepKey) : null;
}

/** Whether the aside sits beside the form (the editor layout's `2xl`), so a lesson can dock there. */
function useWideLayout() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 96rem)');
    const sync = () => setWide(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  return wide;
}

function scalarPatch(course: CourseStudioData): Record<string, unknown> {
  return {
    title: course.title,
    academyId: course.academyId,
    subtitle: course.subtitle,
    description: course.description,
    thumbnailUrl: course.thumbnailUrl,
    difficulty: course.difficulty,
    estimatedHours: course.estimatedHours,
    priceCents: course.priceCents,
    currency: isCurrencyCode(course.currency) ? course.currency : DEFAULT_CURRENCY,
    accessMode: course.accessMode,
    trailerUrl: course.trailerUrl,
    seoTitle: course.seoTitle,
    seoDescription: course.seoDescription,
    seoKeywords: course.seoKeywords,
    ogImageUrl: course.ogImageUrl,
    autoIssueCertificate: course.autoIssueCertificate,
    metadata: course.metadata ?? {},
    translations: course.translations ?? {},
  };
}

export function CourseStudio({ slug }: { slug: string }) {
  return (
    <LanguageModeProvider>
      <CourseStudioEditor slug={slug} />
    </LanguageModeProvider>
  );
}

function CourseStudioEditor({ slug }: { slug: string }) {
  const router = useRouter();
  const tk = useTranslations('admin.editorKit');
  const { mode } = useLanguageMode();
  /**
   * The language that single-language controls edit (series titles, the lesson
   * drawer, the preview). Side-by-side fields show both; these follow Arabic
   * only when the editor chose Arabic alone.
   */
  const locale: ContentLocale = mode === 'ar' ? 'ar' : 'en';
  const wide = useWideLayout();
  const t = useTranslations('courses');
  const tCommon = useTranslations('common');
  const tDifficulty = useTranslations('admin');
  const courseRef = useRef<CourseStudioData | null>(null);
  const pendingRef = useRef<Record<string, unknown> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renameTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const versionRef = useRef(0);
  const pendingBlockDocsRef = useRef<Record<string, LessonContentDocument>>({});
  const [course, setCourse] = useState<CourseStudioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStepState] = useState<StepKey>('basics');
  const [saveStatus, setSaveStatus] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [publishReasons, setPublishReasons] = useState<string[]>([]);
  const [publishCheckLoading, setPublishCheckLoading] = useState(false);
  const [publishCheckOk, setPublishCheckOk] = useState(false);
  const [publishing, setPublishing] = useState(false);
  /** The lesson selected in the outline: docked in the inspector, or open in the drawer. */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<LessonDrawerTab>('details');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLesson, setPreviewLesson] = useState<Lesson | null>(null);

  const setStep = useCallback((next: StepKey) => {
    setStepState(next);
    const query = new URLSearchParams(window.location.search);
    query.set('step', next);
    router.replace(`${window.location.pathname}?${query.toString()}`, { scroll: false });
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getStudio(slug);
      courseRef.current = data;
      pendingBlockDocsRef.current = {};
      setCourse(data);
      setSaveStatus('idle');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('studio.loadFailed', { default: 'Failed to load course' }));
    } finally {
      setLoading(false);
    }
  }, [slug, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const readStep = () => {
      const value = readStepKey(new URLSearchParams(window.location.search).get('step'));
      if (value) setStepState(value);
    };
    readStep();
    window.addEventListener('popstate', readStep);
    return () => window.removeEventListener('popstate', readStep);
  }, []);

  const steps = useMemo(() => (course ? stepStates(course) : []), [course]);
  const warnings = useMemo(() => {
    if (!course) return [];
    const result: string[] = [];
    if (!course.translations?.ar || Object.keys(course.translations.ar).length === 0) result.push(t('studio.warningNoArabic', { default: 'Arabic content is not added yet; Arabic visitors will use English fallback fields.' }));
    if (!course.trailerUrl) result.push(t('studio.warningTrailer', { default: 'A trailer video is optional, but can improve course-page conversion.' }));
    const lessons = course.series.flatMap((section) => section.lessons);
    if (lessons.length > 0 && lessons.every((lesson) => !lesson.contentBlocks?.blocks?.length)) result.push(t('studio.warningLegacyContent', { default: 'Lessons still use legacy video/text content. Add blocks for richer, translatable learning experiences.' }));
    if (lessons.length > 0 && !lessons.some((lesson) => lesson.freePreview)) result.push(t('studio.warningNoFreePreview', { default: 'Consider marking one lesson as a free preview for visitors.' }));
    return result;
  }, [course, t]);
  const canPublish = Boolean(course && publishCheckOk && allStepsDone(steps));

  const syncPublish = useCallback(async () => {
    setPublishCheckLoading(true);
    try {
      const result = await api.checkPublish(slug);
      setPublishReasons(result.reasons);
      setPublishCheckOk(result.ok);
    } catch (checkError) {
      setPublishReasons(checkError instanceof Error ? [checkError.message] : [t('studio.checkFailed', { default: 'Could not check publish readiness' })]);
      setPublishCheckOk(false);
    } finally {
      setPublishCheckLoading(false);
    }
  }, [slug, t]);

  useEffect(() => {
    if (!course) return;
    const timer = setTimeout(() => void syncPublish(), 700);
    return () => clearTimeout(timer);
  }, [course, syncPublish]);

  const flushBlockDocuments = useCallback(async (): Promise<boolean> => {
    const entries = Object.entries(pendingBlockDocsRef.current);
    if (entries.length === 0) return true;
    setSaveStatus('saving');
    try {
      for (const [lessonId, document] of entries) {
        try {
          await api.replaceLessonBlocks(lessonId, document);
        } catch {
          await api.updateLesson(lessonId, { contentBlocks: document });
        }
      }
      pendingBlockDocsRef.current = {};
      setSaveStatus('saved');
      return true;
    } catch (error) {
      setSaveStatus('error');
      setSaveError(error instanceof Error ? error.message : t('studio.saveBlocksFailed', { default: 'Lesson blocks could not be saved.' }));
      toast({ type: 'err', title: t('studio.blockSaveFailed', { default: 'Block save failed' }), description: error instanceof Error ? error.message : undefined });
      return false;
    }
  }, [t]);

  const flush = useCallback(async (): Promise<boolean> => {
    const patch = pendingRef.current;
    if (!patch || !courseRef.current) return true;
    pendingRef.current = null;
    const version = versionRef.current;
    setSaveStatus('saving');
    setSaveError(null);
    try {
      await api.saveCourse(courseRef.current.slug, patch);
      if (version === versionRef.current) {
        setSaveStatus('saved');
      } else {
        setSaveStatus('dirty');
      }
      return true;
    } catch (saveFailure) {
      pendingRef.current = { ...patch, ...(pendingRef.current ?? {}) };
      setSaveStatus('error');
      setSaveError(saveFailure instanceof Error ? saveFailure.message : t('studio.saveFailed', { default: 'The last save failed.' }));
      toast({ type: 'err', title: t('studio.autosaveFailed', { default: 'Autosave failed' }), description: saveFailure instanceof Error ? saveFailure.message : undefined });
      return false;
    }
  }, [t]);

  const update = useCallback((patch: Partial<CourseStudioData>) => {
    const current = courseRef.current;
    if (!current) return;
    const next = { ...current, ...patch };
    courseRef.current = next;
    setCourse(next);
    pendingRef.current = { ...(pendingRef.current ?? {}), ...patch };
    versionRef.current += 1;
    setSaveStatus('dirty');
    setSaveError(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flush(), 700);
  }, [flush]);

  const copyTranslate = useCourseCopyTranslate(course, update, () => courseRef.current);

  /** A section changed outside the outline (a translation pass); saved with the course draft as before. */
  const updateSectionLocal = useCallback((id: string, patch: Partial<Section> | ((prev: Section) => Partial<Section>)) => {
    const current = courseRef.current;
    if (!current) return;
    const next = {
      ...current,
      series: current.series.map((section) => {
        if (section.id !== id) return section;
        const resolved = typeof patch === 'function' ? patch(section) : patch;
        return { ...section, ...resolved };
      }),
    };
    courseRef.current = next;
    update(next);
  }, [update]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        void flush();
      }
    };
  }, [flush]);

  const saveNow = useCallback(async (): Promise<boolean> => {
    if (!courseRef.current) return false;
    if (timerRef.current) clearTimeout(timerRef.current);
    const pendingSaved = await flush();
    if (!pendingSaved) return false;
    const blocksSaved = await flushBlockDocuments();
    if (!blocksSaved) return false;
    setSaveStatus('saving');
    try {
      await api.saveCourse(courseRef.current.slug, scalarPatch(courseRef.current));
      pendingRef.current = null;
      setSaveStatus('saved');
      toast({ type: 'ok', title: tCommon('saved', { default: 'Saved' }) });
      return true;
    } catch (saveFailure) {
      const message = saveFailure instanceof Error ? saveFailure.message : t('studio.courseSaveFailed', { default: 'The course could not be saved.' });
      setSaveStatus('error');
      setSaveError(message);
      toast({ type: 'err', title: t('studio.saveFailed', { default: 'Save failed' }), description: message });
      return false;
    }
  }, [flush, flushBlockDocuments, t, tCommon]);

  const addSection = useCallback(async (title: string) => {
    const current = courseRef.current;
    if (!current) return;
    const tempId = `tmp-${Math.random().toString(36).slice(2)}`;
    const optimistic: Section = {
      id: tempId,
      courseId: current.id,
      slug: slugify(title || 'section'),
      title,
      description: null,
      thumbnailUrl: null,
      sortOrder: current.series.length,
      isPublished: false,
      isArchived: false,
      lessons: [],
    };
    const withSection = { ...current, series: [...current.series, optimistic] };
    courseRef.current = withSection;
    setCourse(withSection);
    try {
      const created = await api.createSeries(current.id, optimistic.slug, title);
      const replaced = { ...(courseRef.current ?? withSection), series: (courseRef.current ?? withSection).series.map((section) => section.id === tempId ? created : section) };
      courseRef.current = replaced;
      setCourse(replaced);
    } catch (createError) {
      const reverted = { ...(courseRef.current ?? withSection), series: (courseRef.current ?? withSection).series.filter((section) => section.id !== tempId) };
      courseRef.current = reverted;
      setCourse(reverted);
      toast({ type: 'err', title: t('studio.addSectionFailed', { default: 'Add section failed' }), description: createError instanceof Error ? createError.message : undefined });
    }
  }, [t]);

  const renameSection = useCallback((id: string, title: string, sectionLocale: ContentLocale = locale) => {
    const current = courseRef.current;
    if (!current) return;
    const translated = sectionLocale !== 'en';
    const next = {
      ...current,
      series: current.series.map((section) => {
        if (section.id !== id) return section;
        if (!translated) return { ...section, title };
        return { ...section, translations: { ...(section.translations ?? {}), [sectionLocale]: { ...(section.translations?.[sectionLocale] ?? {}), title: title || undefined } } };
      }),
    };
    courseRef.current = next;
    setCourse(next);
    if (renameTimeoutRef.current[id]) clearTimeout(renameTimeoutRef.current[id]);
    renameTimeoutRef.current[id] = setTimeout(async () => {
      try {
        const section = courseRef.current?.series.find((item) => item.id === id);
        await api.updateSeries(id, translated ? { translations: section?.translations ?? {} } : { title });
      } catch (renameError) {
        toast({ type: 'err', title: t('studio.renameFailed', { default: 'Rename failed' }), description: renameError instanceof Error ? renameError.message : undefined });
      }
    }, 500);
  }, [locale, t]);

  const deleteSection = useCallback(async (id: string) => {
    const current = courseRef.current;
    if (!current) return;
    const backup = current.series;
    const next = { ...current, series: current.series.filter((section) => section.id !== id) };
    courseRef.current = next;
    setCourse(next);
    try {
      await api.deleteSeries(id);
      toast({ type: 'ok', title: t('studio.sectionDeleted', { default: 'Section deleted' }) });
    } catch (deleteError) {
      const reverted = { ...current, series: backup };
      courseRef.current = reverted;
      setCourse(reverted);
      toast({ type: 'err', title: t('studio.deleteFailed', { default: 'Delete failed' }), description: deleteError instanceof Error ? deleteError.message : undefined });
    }
  }, [t]);

  const addLesson = useCallback(async (sectionId: string) => {
    const current = courseRef.current;
    if (!current) return;
    const tempId = `tmp-${Math.random().toString(36).slice(2)}`;
    const optimistic: Lesson = {
      id: tempId,
      seriesId: sectionId,
      slug: 'new-lesson',
      title: t('studio.newLesson', { default: 'New lesson' }),
      description: null,
      videoUrl: null,
      thumbnailUrl: null,
      videoMeta: null,
      videoDuration: null,
      content: null,
      contentBlocks: { schemaVersion: 1, blocks: [] },
      attachments: null,
      difficulty: 1,
      isPublished: false,
      isArchived: false,
      sortOrder: current.series.find((section) => section.id === sectionId)?.lessons.length ?? 0,
      freePreview: false,
    };
    const withLesson = { ...current, series: current.series.map((section) => section.id === sectionId ? { ...section, lessons: [...section.lessons, optimistic] } : section) };
    courseRef.current = withLesson;
    setCourse(withLesson);
    try {
      const created = await api.createLesson(sectionId, optimistic.slug, optimistic.title);
      const replaced = { ...(courseRef.current ?? withLesson), series: (courseRef.current ?? withLesson).series.map((section) => section.id === sectionId ? { ...section, lessons: section.lessons.map((lesson) => lesson.id === tempId ? { ...created, contentBlocks: created.contentBlocks ?? { schemaVersion: 1, blocks: [] } } : lesson) } : section) };
      courseRef.current = replaced;
      setCourse(replaced);
    } catch (createError) {
      const reverted = { ...(courseRef.current ?? withLesson), series: (courseRef.current ?? withLesson).series.map((section) => section.id === sectionId ? { ...section, lessons: section.lessons.filter((lesson) => lesson.id !== tempId) } : section) };
      courseRef.current = reverted;
      setCourse(reverted);
      toast({ type: 'err', title: t('studio.addLessonFailed', { default: 'Add lesson failed' }), description: createError instanceof Error ? createError.message : undefined });
    }
  }, [t]);

  const patchLessonById = useCallback(async (id: string, patch: Partial<Lesson>) => {
    const current = courseRef.current;
    if (!current || id.startsWith('tmp-')) return;
    const next = { ...current, series: current.series.map((section) => ({ ...section, lessons: section.lessons.map((lesson) => lesson.id === id ? { ...lesson, ...patch } : lesson) })) };
    courseRef.current = next;
    setCourse(next);
    try {
      await api.updateLesson(id, patch);
      setSaveStatus('saved');
    } catch (saveError) {
      toast({ type: 'err', title: t('studio.saveLessonFailed', { default: 'Save lesson failed' }), description: saveError instanceof Error ? saveError.message : undefined });
    }
  }, [t]);

  const patchLesson = useCallback(async (patch: Partial<Lesson>) => {
    if (selectedId) await patchLessonById(selectedId, patch);
  }, [patchLessonById, selectedId]);

  const updateLessonLocal = useCallback((id: string, patch: Partial<Lesson> | ((prev: Lesson) => Partial<Lesson>)) => {
    const current = courseRef.current;
    if (!current) return;
    const next = {
      ...current,
      series: current.series.map((section) => ({
        ...section,
        lessons: section.lessons.map((lesson) => {
          if (lesson.id !== id) return lesson;
          const resolved = typeof patch === 'function' ? patch(lesson) : patch;
          return { ...lesson, ...resolved };
        }),
      })),
    };
    courseRef.current = next;
    setCourse(next);
  }, []);

  const deleteLesson = useCallback(async (id: string) => {
    const current = courseRef.current;
    if (!current) return;
    delete pendingBlockDocsRef.current[id];
    const backup = current.series;
    const next = { ...current, series: current.series.map((section) => ({ ...section, lessons: section.lessons.filter((lesson) => lesson.id !== id) })) };
    courseRef.current = next;
    setCourse(next);
    try {
      await api.deleteLesson(id);
      toast({ type: 'ok', title: t('studio.lessonDeleted', { default: 'Lesson deleted' }) });
    } catch (deleteError) {
      const reverted = { ...current, series: backup };
      courseRef.current = reverted;
      setCourse(reverted);
      toast({ type: 'err', title: t('studio.deleteFailed', { default: 'Delete failed' }), description: deleteError instanceof Error ? deleteError.message : undefined });
    }
  }, [t]);

  const duplicateLesson = useCallback(async (id: string) => {
    const current = courseRef.current;
    if (!current) return;
    const source = current.series.flatMap((section) => section.lessons).find((lesson) => lesson.id === id);
    if (!source) return;
    const tempId = `tmp-${Math.random().toString(36).slice(2)}`;
    const optimistic = { ...source, id: tempId, title: `${source.title} (copy)`, slug: `${source.slug}-copy`, freePreview: false };
    const withCopy = { ...current, series: current.series.map((section) => section.id === source.seriesId ? { ...section, lessons: [...section.lessons, optimistic] } : section) };
    courseRef.current = withCopy;
    setCourse(withCopy);
    try {
      const created = await api.duplicateLesson(id);
      const replaced = { ...(courseRef.current ?? withCopy), series: (courseRef.current ?? withCopy).series.map((section) => section.id === source.seriesId ? { ...section, lessons: section.lessons.map((lesson) => lesson.id === tempId ? created : lesson) } : section) };
      courseRef.current = replaced;
      setCourse(replaced);
    } catch (duplicateError) {
      const reverted = { ...(courseRef.current ?? withCopy), series: (courseRef.current ?? withCopy).series.map((section) => section.id === source.seriesId ? { ...section, lessons: section.lessons.filter((lesson) => lesson.id !== tempId) } : section) };
      courseRef.current = reverted;
      setCourse(reverted);
      toast({ type: 'err', title: t('studio.duplicateFailed', { default: 'Duplicate failed' }), description: duplicateError instanceof Error ? duplicateError.message : undefined });
    }
  }, [t]);

  const moveLessonToSection = useCallback(async (toSectionId: string) => {
    const current = courseRef.current;
    const selected = selectedId ? { id: selectedId } : null;
    if (!current || !selected) return;
    let moving: Lesson | undefined;
    for (const section of current.series) moving = moving ?? section.lessons.find((lesson) => lesson.id === selected.id);
    if (!moving) return;
    const nextSections = current.series.map((section) => {
      const without = section.lessons.filter((lesson) => lesson.id !== selected.id);
      if (section.id !== toSectionId) return { ...section, lessons: without };
      return { ...section, lessons: [...without, { ...moving, seriesId: toSectionId }] };
    });
    const next = { ...current, series: nextSections };
    courseRef.current = next;
    setCourse(next);
    setDrawerOpen(false);
    try {
      await api.reorderCurriculum(current.slug, {
        series: nextSections.map((section) => ({ id: section.id, sortOrder: section.sortOrder })),
        lessons: nextSections.flatMap((section) => section.lessons.map((lesson) => ({ id: lesson.id, seriesId: section.id, sortOrder: lesson.sortOrder }))),
      });
    } catch (reorderError) {
      toast({ type: 'err', title: t('studio.reorderFailed', { default: 'Reorder failed' }), description: reorderError instanceof Error ? reorderError.message : undefined });
      void load();
    }
  }, [selectedId, load, t]);

  const handleReorder = useCallback((sections: Section[]) => {
    const current = courseRef.current;
    if (!current) return;
    const next = { ...current, series: sections };
    courseRef.current = next;
    setCourse(next);
    void api.reorderCurriculum(current.slug, {
      series: sections.map((section) => ({ id: section.id, sortOrder: section.sortOrder })),
      lessons: sections.flatMap((section) => section.lessons.map((lesson) => ({ id: lesson.id, seriesId: section.id, sortOrder: lesson.sortOrder }))),
    }).catch((reorderError) => {
      toast({ type: 'err', title: t('studio.reorderFailed', { default: 'Reorder failed' }), description: reorderError instanceof Error ? reorderError.message : undefined });
      void load();
    });
  }, [load, t]);

  /**
   * Select a lesson. Beside a wide outline it docks in the inspector; on a
   * narrower screen, where the aside sits under the form, it opens the drawer.
   */
  const openLesson = useCallback((lesson: Lesson) => {
    setSelectedId(lesson.id);
    if (!wide) {
      setDrawerTab('details');
      setDrawerOpen(true);
    }
  }, [wide]);

  const openFullEditor = useCallback((tab: LessonDrawerTab) => {
    setDrawerTab(tab);
    setDrawerOpen(true);
  }, []);

  const openStudioPreview = (lesson: Lesson | null) => {
    setPreviewLesson(lesson);
    setPreviewOpen(true);
  };

  const firstLesson = course?.series.flatMap((section) => section.lessons)[0] ?? null;
  const publish = async () => {
    if (!course || !canPublish) return;
    setPublishing(true);
    const saved = await saveNow();
    if (!saved) {
      setPublishing(false);
      return;
    }
    try {
      const updated = await api.publishCourse(course.slug);
      const next = { ...(courseRef.current ?? course), isPublished: true, isArchived: false, publishedAt: updated.publishedAt };
      courseRef.current = next;
      setCourse(next);
      setReviewOpen(false);
      toast({ type: 'ok', title: t('studio.coursePublished', { default: 'Course published' }) });
    } catch (publishError) {
      await syncPublish();
      toast({ type: 'err', title: t('studio.publishBlocked', { default: 'Publish blocked' }), description: publishError instanceof Error ? publishError.message : undefined });
    } finally {
      setPublishing(false);
    }
  };

  const unpublish = async () => {
    if (!course) return;
    setPublishing(true);
    try {
      const updated = await api.unpublishCourse(course.slug);
      const next = { ...(courseRef.current ?? course), isPublished: false, publishedAt: updated.publishedAt ?? null };
      courseRef.current = next;
      setCourse(next);
      setReviewOpen(false);
      toast({ type: 'ok', title: t('studio.courseUnpublished', { default: 'Course unpublished' }) });
    } catch (unpublishError) {
      toast({ type: 'err', title: t('studio.unpublishFailed', { default: 'Unpublish failed' }), description: unpublishError instanceof Error ? unpublishError.message : undefined });
    } finally {
      setPublishing(false);
    }
  };

  const draftMissingArabic = async () => {
    await copyTranslate.basics.run('missing');
    await copyTranslate.seo.run('missing');
  };

  const shownSaveState = useSaveState({
    dirty: saveStatus === 'dirty',
    saving: saveStatus === 'saving',
    failed: saveStatus === 'error',
  });
  useFormGuard({
    dirty: saveStatus === 'dirty' || saveStatus === 'error',
    saving: saveStatus === 'saving',
    onSave: () => void saveNow(),
  });

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="size-6 animate-spin text-muted-foreground/70" /></div>;
  }
  if (error || !course) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <Reveal className="flex max-w-md flex-col items-center gap-4 rounded-2xl border border-border/70 bg-card px-8 py-10 text-center shadow-sm">
          <span className="flex size-12 items-center justify-center rounded-full bg-warning/10 text-warning"><AlertTriangle className="size-6" /></span>
          <p className="text-balance font-display text-xl font-medium tracking-[-0.015em] text-foreground">{error || t('studio.courseNotFound', { default: 'Course not found' })}</p>
          <div className="flex flex-wrap items-center justify-center gap-2"><button type="button" onClick={() => void load()} className="rounded-lg bg-primary px-4 py-2 font-sans text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 active:scale-[0.98]">{tCommon('retry', { default: 'Retry' })}</button><button type="button" onClick={() => router.push('/admin/courses')} className="rounded-lg border border-border/80 bg-card px-4 py-2 font-sans text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground active:scale-[0.98]">{t('studio.backToCourses', { default: 'Back to courses' })}</button></div>
        </Reveal>
      </div>
    );
  }

  const ts = t as unknown as (key: string, values?: Record<string, string | number | Date>) => string;
  const stepOf = (key: string) => steps.find((item) => item.key === key);
  const isDone = (key: string) => Boolean(stepOf(key)?.done);
  const lessonTotal = course.series.reduce((count, section) => count + section.lessons.length, 0);
  const coverage = arabicCoverage(course);
  const coveragePct = coverage.total ? Math.round((coverage.translated / coverage.total) * 100) : 100;
  const arabicTitle = course.translations?.ar?.title?.trim();
  const shownTitle = (locale === 'ar' && arabicTitle) || course.title || t('studio.summary.untitled', { default: 'Untitled course' });

  const railSections: RailSection[] = [
    { id: 'basics', label: t('studio.rail.basics'), state: isDone('basics') ? 'done' : 'todo' },
    {
      id: 'curriculum',
      label: t('studio.rail.curriculum'),
      state: isDone('curriculum') ? 'done' : 'todo',
      meta: `${course.series.length} · ${lessonTotal}`,
    },
    { id: 'media', label: t('studio.rail.media'), state: isDone('media') ? 'done' : 'todo' },
    { id: 'pricing', label: t('studio.rail.pricing'), state: isDone('pricing') ? 'done' : 'todo' },
    { id: 'live', label: t('studio.rail.live'), state: 'idle' },
    {
      id: 'arabic',
      label: t('studio.rail.arabic'),
      state: coverage.total > 0 && coverage.translated >= coverage.total ? 'done' : 'idle',
      meta: `${coveragePct}%`,
    },
    { id: 'localization', label: t('studio.rail.localization'), state: isDone('localization') ? 'done' : 'idle' },
    { id: 'certificate', label: t('studio.rail.certificate'), state: course.autoIssueCertificate ? 'done' : 'idle' },
  ];

  /**
   * What the server refuses to publish without, plus the advice. The studio's own
   * required steps come first; the validate endpoint's reasons follow, because the
   * server is the one that decides. Advisory steps and warnings never block.
   */
  const stepChecks: EditorCheck[] = steps
    .filter((item) => item.key !== 'publish' && item.key !== 'live')
    .map((item) => ({
      label: item.done ? stepLabel(item, ts) : stepHint(item, ts) ?? stepLabel(item, ts),
      ok: item.done,
      target: item.key,
      optional: item.advisory,
    }));
  // A server reason for a section whose own step check already fails says the same
  // thing twice ("Upload a thumbnail" from both), so only the step check is shown —
  // and it becomes required, because the server refuses to publish without it even
  // where the studio calls the step advisory (search title and description).
  const reasonSections = new Set(
    course.isPublished ? [] : publishReasons.map((reason) => reasonToSection(reason)),
  );
  for (const step of stepChecks) {
    if (!step.ok && step.target && reasonSections.has(step.target)) step.optional = false;
  }
  const serverChecks: EditorCheck[] = course.isPublished
    ? []
    : publishReasons
        .map((reason) => ({ label: reason, ok: false, target: reasonToSection(reason) }))
        .filter((check) => !stepChecks.some((step) => !step.ok && step.target === check.target));
  const warningChecks: EditorCheck[] = warnings.map((warning) => ({ label: warning, ok: false, optional: true }));
  const checks = [...stepChecks, ...serverChecks];
  const sheetChecks = [...checks, ...warningChecks];
  const asideChecks: EditorCheck[] =
    coverage.total > 0
      ? [
          ...checks,
          {
            label: tk('publish.arabicCoverage', { translated: coverage.translated, total: coverage.total }),
            ok: coverage.translated >= coverage.total,
            target: 'arabic',
            optional: true,
          },
        ]
      : checks;
  const requiredChecks = checks.filter((check) => !check.optional);
  const readyCount = requiredChecks.filter((check) => check.ok).length + (publishCheckOk || course.isPublished ? 1 : 0);
  const readyTotal = stepChecks.filter((check) => !check.optional).length + 1;
  const jump = (target: string) => {
    const key = readStepKey(target);
    if (key) setStep(key);
  };

  const subtitle = [
    course.academy?.title,
    tDifficulty(difficultyKey(course.difficulty), { default: difficultyFallback(course.difficulty) }),
    course.estimatedHours ? t('studio.hoursValue', { count: course.estimatedHours }) : null,
    t('studio.lessonCount', { count: lessonTotal }),
  ]
    .filter(Boolean)
    .join(' · ');

  const selectedLesson = selectedId
    ? course.series.flatMap((section) => section.lessons).find((lesson) => lesson.id === selectedId) ?? null
    : null;
  const selectedSectionIndex = selectedLesson ? course.series.findIndex((section) => section.id === selectedLesson.seriesId) : -1;
  const selectedSection = selectedSectionIndex >= 0 ? course.series[selectedSectionIndex] : undefined;
  const selectedPosition = selectedSection && selectedLesson
    ? `${String(selectedSectionIndex + 1).padStart(2, '0')}.${String(selectedSection.lessons.findIndex((lesson) => lesson.id === selectedLesson.id) + 1).padStart(2, '0')}`
    : '';
  const showInspector = Boolean(step === 'curriculum' && wide && selectedLesson);

  const stepContent: Record<StepKey, ReactNode> = {
    basics: <StepBasics course={course} update={update} translate={copyTranslate.basics} />,
    curriculum: (
      <CurriculumBuilder
        sections={course.series}
        locale={locale}
        selectedLessonId={showInspector ? selectedId : null}
        onReorder={handleReorder}
        onAddSection={() => void addSection(t('studio.newSection', { default: 'New section' }))}
        onRenameSection={renameSection}
        onDeleteSection={(id) => void deleteSection(id)}
        onAddLesson={(id) => void addLesson(id)}
        onOpenLesson={openLesson}
        onDeleteLesson={(id) => void deleteLesson(id)}
        onDuplicateLesson={(id) => void duplicateLesson(id)}
      />
    ),
    media: <StepMedia course={course} update={update} />,
    pricing: <StepPricing course={course} update={update} />,
    live: <StepLive course={course} />,
    arabic: (
      <StepArabic
        course={course}
        basics={copyTranslate.basics}
        seo={copyTranslate.seo}
        onUpdateLesson={updateLessonLocal}
        onUpdateSection={updateSectionLocal}
      />
    ),
    localization: <StepLocalization course={course} update={update} translate={copyTranslate.seo} />,
    certificate: (
      <StepPublish
        course={course}
        reasons={publishReasons}
        warnings={warnings}
        canPublish={canPublish}
        checking={publishCheckLoading}
        onReview={() => setReviewOpen(true)}
        onRetryCheck={() => void syncPublish()}
        onPreviewCourse={() => openStudioPreview(firstLesson)}
        onToggleAutoIssue={(next) => update({ autoIssueCertificate: next })}
      />
    ),
  };

  const secondaryButton =
    'inline-flex min-h-10 items-center gap-2 rounded-full border border-border-strong bg-card px-4 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-60';

  return (
    <div className="w-full">
      <AdminCommandBar
        trail={[
          { label: t('studio.breadcrumb', { default: 'Courses' }), href: '/admin/courses' },
          { label: course.title || t('studio.summary.untitled', { default: 'Untitled course' }) },
        ]}
        live={course.isPublished ? t('studio.published', { default: 'Published' }) : false}
      />

      <EditorHeader
        status={{
          tone: course.isArchived ? 'archived' : course.isPublished ? 'live' : 'draft',
          label: course.isArchived
            ? t('studio.summary.statusArchived')
            : course.isPublished
              ? t('studio.summary.statusPublished')
              : t('studio.summary.statusDraft'),
        }}
        saveLine={<SaveStateLine state={shownSaveState} autosave onRetry={() => void saveNow()} />}
        title={<span dir="auto">{shownTitle}</span>}
        subtitle={subtitle}
        extraActions={
          <>
            <button
              type="button"
              onClick={() => void saveNow()}
              disabled={saveStatus === 'saving'}
              className={secondaryButton}
            >
              <Save className="size-4" />
              {tCommon('save', { default: 'Save' })}
            </button>
            <button type="button" onClick={() => openStudioPreview(firstLesson)} className={secondaryButton}>
              <Eye className="size-4" />
              {t('studio.previewAsLearner')}
            </button>
          </>
        }
        onReview={() => setReviewOpen(true)}
        reviewLabel={course.isPublished ? tk('reviewLive') : tk('reviewAndPublish')}
      />
      {saveStatus === 'error' && saveError && (
        <div
          role="alert"
          className="mx-auto mb-4 flex w-full max-w-[90rem] items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-13 text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 flex-1 break-words">{saveError}</span>
        </div>
      )}

      <EditorLayout
        rail={
          <EditorRail
            sections={railSections}
            active={step}
            onSelect={(id) => jump(id)}
            readiness={{ done: readyCount, total: readyTotal, note: tk('draftNote') }}
          />
        }
        aside={
          <>
            {showInspector && selectedLesson && (
              <LessonInspector
                lesson={selectedLesson}
                position={selectedPosition}
                sectionTitle={selectedSection?.title ?? ''}
                onPatch={(id, patch) => void patchLessonById(id, patch)}
                onOpenFull={openFullEditor}
                onClose={() => setSelectedId(null)}
                onDuplicate={() => void duplicateLesson(selectedLesson.id)}
                onDelete={() => {
                  setSelectedId(null);
                  void deleteLesson(selectedLesson.id);
                }}
              />
            )}
            {/* The inspector takes the card's place, so the sticky column still fits the screen. */}
            {!showInspector && (
              <AsideCard eyebrow={t('studio.courseCard')} meta={locale === 'ar' ? 'العربية' : tk('modeEnglish')}>
                <CourseCardPreview course={course} arabic={locale === 'ar'} />
              </AsideCard>
            )}
            <AsideCard
              title={tk('beforePublish')}
              meta={publishCheckLoading ? <Loader2 className="size-3.5 animate-spin" aria-label={t('studio.checkingPublish')} /> : undefined}
            >
              <CheckList checks={asideChecks} onJump={jump} />
            </AsideCard>
          </>
        }
      >
        <Crossfade value={step} className="flex min-w-0 flex-col gap-5">
          {stepContent[step]}
        </Crossfade>
      </EditorLayout>

      <PublishSheet
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        eyebrow={`${t('studio.breadcrumb', { default: 'Courses' })} · ${course.title}`}
        title={course.isPublished ? `${tk('publish.unpublish')} · ${course.title}` : course.title}
        lead={publishCheckLoading ? t('studio.checkingPublish') : undefined}
        checks={sheetChecks}
        arabic={{
          translated: coverage.translated,
          total: coverage.total,
          onDraft: () => void draftMissingArabic(),
          drafting: copyTranslate.basics.busy || copyTranslate.seo.busy,
        }}
        arabicPreview={
          <>
            <span className="text-lg text-foreground">{arabicTitle || course.title}</span>
            <span className="text-13 text-muted-foreground">{course.translations?.ar?.subtitle?.trim() || course.subtitle}</span>
          </>
        }
        isPublished={course.isPublished}
        busy={publishing}
        blocked={!canPublish}
        onPublish={() => void publish()}
        onUnpublish={() => void unpublish()}
        onJump={jump}
      />
      <StudioPreview open={previewOpen} course={course} lesson={previewLesson} locale={locale} onClose={() => setPreviewOpen(false)} onSelectLesson={setPreviewLesson} />
      <LessonDrawer
        open={drawerOpen}
        lesson={selectedLesson}
        sections={course.series}
        locale={locale}
        initialTab={drawerTab}
        onClose={() => setDrawerOpen(false)}
        onSave={patchLesson}
        onMoveSection={(sectionId) => void moveLessonToSection(sectionId)}
        onDelete={() => {
          if (selectedLesson) {
            setDrawerOpen(false);
            setSelectedId(null);
            void deleteLesson(selectedLesson.id);
          }
        }}
        onDuplicate={() => {
          if (selectedLesson) void duplicateLesson(selectedLesson.id);
        }}
        onContentBlocksChange={(contentBlocks: LessonContentDocument) => {
          if (!selectedLesson) return;
          pendingBlockDocsRef.current[selectedLesson.id] = contentBlocks;
          updateLessonLocal(selectedLesson.id, { contentBlocks });
        }}
      />
    </div>
  );
}
