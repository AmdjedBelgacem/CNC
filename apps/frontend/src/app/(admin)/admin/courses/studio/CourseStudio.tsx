'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertTriangle } from 'lucide-react';
import { StudioHeader } from './StudioHeader';
import { SummaryPanel } from './SummaryPanel';
import { StepBasics } from './StepBasics';
import { StepMedia } from './StepMedia';
import { StepPricing } from './StepPricing';
import { StepSeo } from './StepSeo';
import { CurriculumBuilder } from './CurriculumBuilder';
import { LessonDrawer } from './LessonDrawer';
import { stepStates, allStepsDone } from './completeness';
import { GLASS } from './glass';
import { slugify } from './slugify';
import { toast } from '@/components/ui/toast';
import type { CourseStudioData, Lesson, Section } from './types';
import * as api from './api';
function scalarPatch(c: CourseStudioData): Record<string, unknown> {
  return {
    title: c.title,
    academyId: c.academyId,
    subtitle: c.subtitle,
    description: c.description,
    thumbnailUrl: c.thumbnailUrl,
    difficulty: c.difficulty,
    estimatedHours: c.estimatedHours,
    priceCents: c.priceCents,
    currency: c.currency,
    accessMode: c.accessMode,
    trailerUrl: c.trailerUrl,
    seoTitle: c.seoTitle,
    seoDescription: c.seoDescription,
    seoKeywords: c.seoKeywords,
    ogImageUrl: c.ogImageUrl,
    autoIssueCertificate: c.autoIssueCertificate,
    metadata: c.metadata ?? {},
  };
}
export function CourseStudio({ slug }: { slug: string }) {
  const router = useRouter();
  const [course, setCourse] = useState<CourseStudioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [drawerLesson, setDrawerLesson] = useState<Lesson | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [publishReasons, setPublishReasons] = useState<string[]>([]);
  const pendingRef = useRef<Record<string, unknown>>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renameTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getStudio(slug);
      setCourse(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load course');
    } finally {
      setLoading(false);
    }
  }, [slug]);
  useEffect(() => {
    load();
  }, [load]);
  const steps = useMemo(() => (course ? stepStates(course) : []), [course]);
  const canPublish = course ? allStepsDone(steps) : false;
  const syncPublish = useCallback(async () => {
    try {
      const res = await api.checkPublish(slug);
      setPublishReasons(res.reasons);
    } catch {
      /* keep last known reasons */
    }
  }, [slug]); // Re-check publish readiness after edits settle so the checklist stays authoritative.
  useEffect(() => {
    if (!course) return;
    const t = setTimeout(() => void syncPublish(), 800);
    return () => clearTimeout(t);
  }, [course, syncPublish]); // ---- autosave of scalar (non-curriculum) fields ----
  const flush = useCallback(async () => {
    if (!pendingRef.current || !course) return;
    const patch = pendingRef.current;
    pendingRef.current = null;
    const curSlug = course.slug;
    setSaving(true);
    try {
      await api.saveCourse(curSlug, patch);
      setLastSavedAt(Date.now());
    } catch (e: any) {
      toast({ type: 'err', title: 'Autosave failed', description: e?.message });
    } finally {
      setSaving(false);
    }
  }, [course]);
  const update = useCallback(
    (patch: Partial<CourseStudioData>) => {
      setCourse((c) => (c ? { ...c, ...patch } : c));
      pendingRef.current = { ...(pendingRef.current ?? {}), ...patch };
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void flush();
      }, 700);
    },
    [flush],
  );
  const saveNow = useCallback(async () => {
    if (!course) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    pendingRef.current = null;
    setSaving(true);
    try {
      await api.saveCourse(course.slug, scalarPatch(course));
      setLastSavedAt(Date.now());
      toast({ type: 'ok', title: 'Saved' });
    } catch (e: any) {
      toast({ type: 'err', title: 'Save failed', description: e?.message });
    } finally {
      setSaving(false);
    }
  }, [course]); // ---- curriculum handlers (optimistic) ----
  const addSection = useCallback(
    async (title: string) => {
      if (!course) return;
      const cid = course.id;
      const tmpId = 'tmp-' + Math.random().toString(36).slice(2);
      const tmpSlug = slugify(title || 'section');
      const optimistic: Section = {
        id: tmpId,
        courseId: cid,
        slug: tmpSlug,
        title,
        description: null,
        thumbnailUrl: null,
        sortOrder: course.series.length,
        isPublished: false,
        isArchived: false,
        lessons: [],
      };
      setCourse((c) => (c ? { ...c, series: [...c.series, optimistic] } : c));
      try {
        const created = await api.createSeries(cid, tmpSlug, title);
        setCourse((c) =>
          c ? { ...c, series: c.series.map((s) => (s.id === tmpId ? created : s)) } : c,
        );
      } catch (e: any) {
        setCourse((c) => (c ? { ...c, series: c.series.filter((s) => s.id !== tmpId) } : c));
        toast({ type: 'err', title: 'Add section failed', description: e?.message });
      }
    },
    [course],
  );
  const renameSection = useCallback(async (id: string, title: string) => {
    setCourse((c) =>
      c ? { ...c, series: c.series.map((s) => (s.id === id ? { ...s, title } : s)) } : c,
    );
    if (renameTimeoutRef.current[id]) clearTimeout(renameTimeoutRef.current[id]);
    renameTimeoutRef.current[id] = setTimeout(async () => {
      try {
        await api.updateSeries(id, { title });
      } catch (e: any) {
        toast({ type: 'err', title: 'Rename failed', description: e?.message });
      }
    }, 500);
  }, []);
  const deleteSection = useCallback(
    async (id: string) => {
      if (!course) return;
      const backup = course.series;
      setCourse((c) => (c ? { ...c, series: c.series.filter((s) => s.id !== id) } : c));
      try {
        await api.deleteSeries(id);
        toast({ type: 'ok', title: 'Section deleted' });
      } catch (e: any) {
        setCourse((c) => (c ? { ...c, series: backup } : c));
        toast({ type: 'err', title: 'Delete failed', description: e?.message });
      }
    },
    [course],
  );
  const addLesson = useCallback(
    async (sectionId: string) => {
      if (!course) return;
      const tmpId = 'tmp-' + Math.random().toString(36).slice(2);
      const tmpSlug = slugify('new-lesson');
      const optimistic: Lesson = {
        id: tmpId,
        seriesId: sectionId,
        slug: tmpSlug,
        title: 'New lesson',
        description: null,
        videoUrl: null,
        thumbnailUrl: null,
        videoMeta: null,
        videoDuration: null,
        content: null,
        attachments: null,
        difficulty: 1,
        isPublished: false,
        isArchived: false,
        sortOrder: 0,
        freePreview: false,
      };
      setCourse((c) => ({
        ...c!,
        series: c!.series.map((s) =>
          s.id === sectionId ? { ...s, lessons: [...s.lessons, optimistic] } : s,
        ),
      }));
      try {
        const created = await api.createLesson(sectionId, tmpSlug, 'New lesson');
        setCourse((c) => ({
          ...c!,
          series: c!.series.map((s) =>
            s.id === sectionId
              ? { ...s, lessons: s.lessons.map((l) => (l.id === tmpId ? created : l)) }
              : s,
          ),
        }));
      } catch (e: any) {
        setCourse((c) => ({
          ...c!,
          series: c!.series.map((s) =>
            s.id === sectionId ? { ...s, lessons: s.lessons.filter((l) => l.id !== tmpId) } : s,
          ),
        }));
        toast({ type: 'err', title: 'Add lesson failed', description: e?.message });
      }
    },
    [course],
  );
  const openLesson = useCallback((lesson: Lesson) => {
    setDrawerLesson(lesson);
    setDrawerOpen(true);
  }, []);
  const patchLesson = useCallback(
    async (patch: Partial<Lesson>) => {
      if (!drawerLesson) return;
      const id = drawerLesson.id;
      setCourse((c) => ({
        ...c!,
        series: c!.series.map((s) => ({
          ...s,
          lessons: s.lessons.map((l) => (l.id === id ? { ...l, ...patch } : l)),
        })),
      }));
      try {
        await api.updateLesson(id, patch);
      } catch (e: any) {
        toast({ type: 'err', title: 'Save lesson failed', description: e?.message });
      }
    },
    [drawerLesson],
  );
  const moveLessonToSection = useCallback(
    async (toSectionId: string) => {
      if (!drawerLesson || !course) return;
      const id = drawerLesson.id;
      const next = course.series.map((s) => {
        if (s.id === toSectionId) {
          const moving = s.lessons.find((l) => l.id === id);
          if (moving) {
            return {
              ...s,
              lessons: [
                ...s.lessons.filter((l) => l.id !== id),
                { ...moving, seriesId: toSectionId },
              ],
            };
          }
        }
        return { ...s, lessons: s.lessons.filter((l) => l.id !== id) };
      });
      setCourse((c) => (c ? { ...c, series: next } : c));
      setDrawerOpen(false);
      await persistReorder(next);
    },
    [drawerLesson, course],
  );
  const deleteLesson = useCallback(
    async (id: string) => {
      if (!course) return;
      const backup = course.series;
      setCourse((c) => ({
        ...c!,
        series: c!.series.map((s) => ({ ...s, lessons: s.lessons.filter((l) => l.id !== id) })),
      }));
      try {
        await api.deleteLesson(id);
        toast({ type: 'ok', title: 'Lesson deleted' });
      } catch (e: any) {
        setCourse((c) => (c ? { ...c, series: backup } : c));
        toast({ type: 'err', title: 'Delete failed', description: e?.message });
      }
    },
    [course],
  );
  const duplicateLesson = useCallback(
    async (id: string) => {
      if (!course) return;
      const src = course.series.flatMap((s) => s.lessons).find((l) => l.id === id);
      if (!src) return;
      const sectionId = src.seriesId;
      const tmpId = 'tmp-' + Math.random().toString(36).slice(2);
      const optimistic: Lesson = {
        ...src,
        id: tmpId,
        title: src.title + ' (copy)',
        slug: src.slug + '-copy',
        freePreview: false,
      };
      setCourse((c) => ({
        ...c!,
        series: c!.series.map((s) =>
          s.id === sectionId ? { ...s, lessons: [...s.lessons, optimistic] } : s,
        ),
      }));
      try {
        const created = await api.duplicateLesson(id);
        setCourse((c) => ({
          ...c!,
          series: c!.series.map((s) =>
            s.id === sectionId
              ? { ...s, lessons: s.lessons.map((l) => (l.id === tmpId ? created : l)) }
              : s,
          ),
        }));
      } catch (e: any) {
        setCourse((c) => ({
          ...c!,
          series: c!.series.map((s) =>
            s.id === sectionId ? { ...s, lessons: s.lessons.filter((l) => l.id !== tmpId) } : s,
          ),
        }));
        toast({ type: 'err', title: 'Duplicate failed', description: e?.message });
      }
    },
    [course],
  );
  const persistReorder = useCallback(
    async (sections: Section[]) => {
      const payload = {
        series: sections.map((s) => ({ id: s.id, sortOrder: s.sortOrder })),
        lessons: sections.flatMap((s) =>
          s.lessons.map((l) => ({ id: l.id, seriesId: s.id, sortOrder: l.sortOrder })),
        ),
      };
      try {
        await api.reorderCurriculum(course!.slug, payload);
      } catch (e: any) {
        toast({ type: 'err', title: 'Reorder failed', description: e?.message });
        void load();
      }
    },
    [course, load],
  );
  const handleReorder = useCallback(
    (sections: Section[]) => {
      setCourse((c) => (c ? { ...c, series: sections } : c));
      void persistReorder(sections);
    },
    [persistReorder],
  );
  const onPublish = useCallback(async () => {
    if (!course) return;
    try {
      const updated = await api.publishCourse(course.slug);
      setCourse((c) =>
        c ? { ...c, isPublished: true, isArchived: false, publishedAt: updated.publishedAt } : c,
      );
      toast({ type: 'ok', title: 'Course published' });
    } catch (e: any) {
      void syncPublish();
      toast({ type: 'err', title: 'Publish blocked', description: e?.message });
    }
  }, [course, syncPublish]);
  const onUnpublish = useCallback(async () => {
    if (!course) return;
    try {
      await api.unpublishCourse(course.slug);
      setCourse((c) => (c ? { ...c, isPublished: false } : c));
      toast({ type: 'ok', title: 'Course unpublished' });
    } catch (e: any) {
      toast({ type: 'err', title: 'Unpublish failed', description: e?.message });
    }
  }, [course]);
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        {' '}
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />{' '}
      </div>
    );
  }
  if (error || !course) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        {' '}
        <AlertTriangle className="h-8 w-8 text-amber-500" />{' '}
        <p className="font-sans text-base text-foreground">{error || 'Course not found'}</p>{' '}
        <button
          type="button"
          onClick={() => router.push('/admin/courses')}
          className="rounded-lg bg-accent px-4 py-2 font-sans text-sm font-medium text-white"
        >
          {' '}
          Back to courses{' '}
        </button>{' '}
      </div>
    );
  }
  const stepContent = [
    <StepBasics key="basics" course={course} update={update} />,
    <CurriculumBuilder
      key="curriculum"
      sections={course.series}
      onReorder={handleReorder}
      onAddSection={() => void addSection('New section')}
      onRenameSection={(id, t) => void renameSection(id, t)}
      onDeleteSection={(id) => void deleteSection(id)}
      onAddLesson={(sid) => void addLesson(sid)}
      onOpenLesson={openLesson}
      onDeleteLesson={(id) => void deleteLesson(id)}
      onDuplicateLesson={(id) => void duplicateLesson(id)}
    />,
    <StepMedia key="media" course={course} update={update} />,
    <StepPricing key="pricing" course={course} update={update} />,
    <StepSeo key="seo" course={course} update={update} />,
  ];
  return (
    <div
      className="min-h-screen bg-background"
      style={{
        backgroundImage:
          'radial-gradient(at 0% 0%, hsla(253,16%,7%,0.02) 0, transparent 50%), radial-gradient(at 50% 0%, hsla(225,39%,30%,0.03) 0, transparent 50%), radial-gradient(at 100% 0%, hsla(339,49%,30%,0.02) 0, transparent 50%)',
      }}
    >
      {' '}
      <StudioHeader
        steps={steps}
        step={step}
        setStep={setStep}
        canPublish={canPublish}
        isPublished={course.isPublished}
        saving={saving}
        publishReasons={publishReasons}
        onBack={() => router.push('/admin/courses')}
        onSave={() => void saveNow()}
        onPublish={() => void onPublish()}
        onUnpublish={() => void onUnpublish()}
      />{' '}
      <div className="mx-auto max-w-6xl px-6 py-8 lg:px-10">
        {' '}
        <div className={GLASS + ' rounded-xl p-4 mb-6 flex items-center justify-between gap-4'}>
          {' '}
          <div>
            {' '}
            <h3 className="font-medium">Auto-issue certificate</h3>{' '}
            <p className="text-sm text-muted-foreground">
              Automatically issue a certificate when a learner completes all lessons.
            </p>{' '}
          </div>{' '}
          <button
            type="button"
            onClick={() => update({ autoIssueCertificate: !(course.autoIssueCertificate ?? true) })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${(course.autoIssueCertificate ?? true) ? 'bg-primary' : 'bg-muted'}`}
            aria-pressed={course.autoIssueCertificate ?? true}
            title={
              (course.autoIssueCertificate ?? true) ? 'Auto-issue enabled' : 'Auto-issue disabled'
            }
          >
            {' '}
            <span
              className={`inline-block h-4 w-4 transform rounded-md bg-white transition-transform ${(course.autoIssueCertificate ?? true) ? 'translate-x-6' : 'translate-x-1'}`}
            />{' '}
          </button>{' '}
        </div>{' '}
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {' '}
          <div className={GLASS + ' rounded-xl p-6'}>{stepContent[step]}</div>{' '}
          <div className="lg:sticky lg:top-32 lg:self-start">
            {' '}
            <SummaryPanel
              course={course}
              steps={steps}
              saving={saving}
              lastSavedAt={lastSavedAt}
              publishReasons={publishReasons}
              onJump={(i) => setStep(i)}
            />{' '}
          </div>{' '}
        </div>{' '}
      </div>{' '}
      <LessonDrawer
        open={drawerOpen}
        lesson={drawerLesson}
        sections={course.series}
        onClose={() => setDrawerOpen(false)}
        onSave={patchLesson}
        onMoveSection={(sid) => void moveLessonToSection(sid)}
        onDelete={() => {
          if (drawerLesson) {
            setDrawerOpen(false);
            void deleteLesson(drawerLesson.id);
          }
        }}
        onDuplicate={() => {
          if (drawerLesson) void duplicateLesson(drawerLesson.id);
        }}
      />{' '}
    </div>
  );
}
