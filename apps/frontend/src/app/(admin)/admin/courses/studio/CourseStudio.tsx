'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { DEFAULT_CURRENCY, isCurrencyCode } from '@titan/shared';
import type { ContentLocale, LessonContentDocument } from '@titan/shared';
import { StudioHeader, type StudioSaveStatus } from './StudioHeader';
import { SummaryPanel } from './SummaryPanel';
import { StepBasics } from './StepBasics';
import { StepMedia } from './StepMedia';
import { StepPricing } from './StepPricing';
import { StepLocalization } from './StepSeo';
import { StepPublish } from './StepPublish';
import { StudioPreview } from './StudioPreview';
import { CurriculumBuilder } from './CurriculumBuilder';
import { LessonDrawer } from './LessonDrawer';
import { allStepsDone, stepStates } from './completeness';
import { slugify } from './slugify';
import { toast } from '@/components/ui/toast';
import type { CourseStudioData, Lesson, Section } from './types';
import * as api from './api';

const STEP_KEYS = ['basics', 'curriculum', 'media', 'pricing', 'localization', 'publish'] as const;
type StepKey = (typeof STEP_KEYS)[number];

function isStepKey(value: string | null): value is StepKey {
  return !!value && (STEP_KEYS as readonly string[]).includes(value);
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
  const router = useRouter();
  const t = useTranslations('courses');
  const tCommon = useTranslations('common');
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
  const [locale, setLocale] = useState<ContentLocale>('en');
  const [saveStatus, setSaveStatus] = useState<StudioSaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [publishReasons, setPublishReasons] = useState<string[]>([]);
  const [publishCheckLoading, setPublishCheckLoading] = useState(false);
  const [publishCheckOk, setPublishCheckOk] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [drawerLesson, setDrawerLesson] = useState<Lesson | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
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
      if (data.locale) setLocale(data.locale);
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
      const value = new URLSearchParams(window.location.search).get('step');
      if (isStepKey(value)) setStepState(value);
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
      setLastSavedAt(Date.now());
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
      setLastSavedAt(Date.now());
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
        return { ...section, translations: { ...(section.translations ?? {}), [sectionLocale]: { ...(section.translations?.[sectionLocale] ?? {}), title: title.trim() || undefined } } };
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

  const patchLesson = useCallback(async (patch: Partial<Lesson>) => {
    const selected = drawerLesson;
    if (!selected) return;
    const current = courseRef.current;
    if (!current) return;
    const next = { ...current, series: current.series.map((section) => ({ ...section, lessons: section.lessons.map((lesson) => lesson.id === selected.id ? { ...lesson, ...patch } : lesson) })) };
    courseRef.current = next;
    setCourse(next);
    setDrawerLesson((lesson) => lesson ? { ...lesson, ...patch } : lesson);
    try {
      await api.updateLesson(selected.id, patch);
      setSaveStatus('saved');
      setLastSavedAt(Date.now());
    } catch (saveError) {
      toast({ type: 'err', title: t('studio.saveLessonFailed', { default: 'Save lesson failed' }), description: saveError instanceof Error ? saveError.message : undefined });
    }
  }, [drawerLesson, t]);

  const updateLessonLocal = useCallback((id: string, patch: Partial<Lesson>) => {
    const current = courseRef.current;
    if (!current) return;
    const next = { ...current, series: current.series.map((section) => ({ ...section, lessons: section.lessons.map((lesson) => lesson.id === id ? { ...lesson, ...patch } : lesson) })) };
    courseRef.current = next;
    setCourse(next);
    setDrawerLesson((lesson) => lesson?.id === id ? { ...lesson, ...patch } : lesson);
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
    const selected = drawerLesson;
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
  }, [drawerLesson, load, t]);

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

  const openLesson = useCallback((lesson: Lesson) => {
    setDrawerLesson(lesson);
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
      const next = { ...course, isPublished: true, isArchived: false, publishedAt: updated.publishedAt };
      courseRef.current = next;
      setCourse(next);
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
    try {
      const updated = await api.unpublishCourse(course.slug);
      const next = { ...course, isPublished: false, publishedAt: updated.publishedAt ?? null };
      courseRef.current = next;
      setCourse(next);
      toast({ type: 'ok', title: t('studio.courseUnpublished', { default: 'Course unpublished' }) });
    } catch (unpublishError) {
      toast({ type: 'err', title: t('studio.unpublishFailed', { default: 'Unpublish failed' }), description: unpublishError instanceof Error ? unpublishError.message : undefined });
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="size-7 animate-spin text-muted-foreground" /></div>;
  }
  if (error || !course) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <AlertTriangle className="size-8 text-warning" />
        <p className="font-sans text-base text-foreground">{error || t('studio.courseNotFound', { default: 'Course not found' })}</p>
        <div className="flex flex-wrap items-center justify-center gap-2"><button type="button" onClick={() => void load()} className="rounded-lg bg-primary px-4 py-2 font-sans text-sm font-medium text-primary-foreground">{tCommon('retry', { default: 'Retry' })}</button><button type="button" onClick={() => router.push('/admin/courses')} className="rounded-lg border border-border px-4 py-2 font-sans text-sm font-medium text-muted-foreground">{t('studio.backToCourses', { default: 'Back to courses' })}</button></div>
      </div>
    );
  }

  const stepContent = [
    <StepBasics key="basics" course={course} update={update} locale={locale} />,
    <CurriculumBuilder key="curriculum" sections={course.series} locale={locale} onReorder={handleReorder} onAddSection={() => void addSection(t('studio.newSection', { default: 'New section' }))} onRenameSection={renameSection} onDeleteSection={(id) => void deleteSection(id)} onAddLesson={(id) => void addLesson(id)} onOpenLesson={openLesson} onDeleteLesson={(id) => void deleteLesson(id)} onDuplicateLesson={(id) => void duplicateLesson(id)} />,
    <StepMedia key="media" course={course} update={update} />,
    <StepPricing key="pricing" course={course} update={update} />,
    <StepLocalization key="localization" course={course} update={update} locale={locale} />,
    <StepPublish key="publish" course={course} steps={steps} reasons={publishReasons} warnings={warnings} canPublish={canPublish} saving={publishing || publishCheckLoading} onPublish={() => void publish()} onRetryCheck={() => void syncPublish()} onPreviewCourse={() => openStudioPreview(firstLesson)} onToggleAutoIssue={(next) => update({ autoIssueCertificate: next })} />,
  ];

  return (
    <div className="min-h-screen bg-background" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <StudioHeader
        courseTitle={course.title}
        steps={steps}
        step={step}
        setStep={(next) => setStep(next as StepKey)}
        locale={locale}
        onLocaleChange={setLocale}
        canPublish={canPublish}
        isPublished={course.isPublished}
        saveStatus={saveStatus}
        saveError={saveError}
        publishing={publishing}
        publishReasons={publishReasons}
        onBack={() => router.push('/admin/courses')}
        onSave={() => void saveNow()}
        onRetrySave={() => void saveNow()}
        onPublish={() => void publish()}
        onUnpublish={() => void unpublish()}
        onPreviewCourse={() => openStudioPreview(firstLesson)}
        onPreviewLesson={() => {
          if (!firstLesson) {
            toast({ type: 'err', title: t('studio.addLessonBeforePreview', { default: 'Add a lesson before previewing' }) });
            return;
          }
          openStudioPreview(firstLesson);
        }}
      />
      <main className="mx-auto w-full max-w-[1480px] px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="min-w-0 rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
            {stepContent[STEP_KEYS.indexOf(step)]}
          </section>
          <aside className="min-w-0 lg:sticky lg:top-44 lg:self-start">
            <SummaryPanel course={course} steps={steps} saving={saveStatus === 'saving'} lastSavedAt={lastSavedAt} publishReasons={publishReasons} warnings={warnings} onJump={(index) => setStep(STEP_KEYS[index] ?? 'basics')} />
          </aside>
        </div>
      </main>
      <StudioPreview open={previewOpen} course={course} lesson={previewLesson} locale={locale} onClose={() => setPreviewOpen(false)} onSelectLesson={setPreviewLesson} />
      <LessonDrawer
        open={drawerOpen}
        lesson={drawerLesson}
        sections={course.series}
        locale={locale}
        onClose={() => setDrawerOpen(false)}
        onSave={patchLesson}
        onMoveSection={(sectionId) => void moveLessonToSection(sectionId)}
        onDelete={() => { if (drawerLesson) { setDrawerOpen(false); void deleteLesson(drawerLesson.id); } }}
        onDuplicate={() => { if (drawerLesson) void duplicateLesson(drawerLesson.id); }}
        onContentBlocksChange={(contentBlocks: LessonContentDocument) => {
          if (!drawerLesson) return;
          pendingBlockDocsRef.current[drawerLesson.id] = contentBlocks;
          updateLessonLocal(drawerLesson.id, { contentBlocks });
        }}
      />
    </div>
  );
}
