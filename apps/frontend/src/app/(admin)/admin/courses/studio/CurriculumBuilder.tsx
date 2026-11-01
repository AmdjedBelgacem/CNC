'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Plus,
  Pencil,
  Trash2,
  Copy,
  Video,
  Clock,
  Eye,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import type { ContentLocale } from '@titan/shared';
import { m } from 'framer-motion';
import { cn } from '@/lib/utils';
import { spring } from '@/lib/motion';
import { GLASS } from './glass';
import type { Lesson, Section } from './types';
import { CourseLessonsTranslation } from './CourseLessonsTranslation';
/**
 * Framer `layout` and dnd-kit both write `transform`. They live on different
 * elements here (Framer on an outer shell, dnd-kit on the sortable node), and
 * Framer layout is switched off while a drag is in flight — and for a beat
 * after the drop — so the two never animate the same move twice. Layout
 * animation is reserved for structural changes: add, delete, duplicate, and
 * moves made from the lesson drawer.
 */
interface CurriculumMotion {
  /** True from drag start until shortly after drop. */
  dragging: boolean;
  /** False during the first paint, so existing rows don't animate in. */
  ready: boolean;
}
const CurriculumMotionContext = createContext<CurriculumMotion>({ dragging: false, ready: false });

function renumber(sections: Section[]) {
  sections.forEach((s, i) => {
    s.sortOrder = i;
    (s.lessons ?? []).forEach((l, j) => {
      l.sortOrder = j;
    });
  });
}
function SectionCard({
  section,
  locale,
  onRename,
  onDelete,
  onAddLesson,
  onOpenLesson,
  onDeleteLesson,
  onDuplicateLesson,
}: {
  section: Section;
  locale: ContentLocale;
  onRename: (id: string, title: string, locale: ContentLocale) => void;
  onDelete: (id: string) => void;
  onAddLesson: (sectionId: string) => void;
  onOpenLesson: (lesson: Lesson) => void;
  onDeleteLesson: (id: string) => void;
  onDuplicateLesson: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: 'sec:' + section.id,
  });
  const t = useTranslations('courses');
  const style = { transform: CSS.Transform.toString(transform), transition };
  const lessons = section.lessons ?? [];
  const displayTitle = locale === 'en' ? section.title : section.translations?.[locale]?.title || section.title;
  const motionState = useContext(CurriculumMotionContext);
  return (
    <m.div
      id={'curriculum-section-' + section.id}
      layout={motionState.dragging ? false : 'position'}
      initial={motionState.ready && !motionState.dragging ? { opacity: 0, y: 10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ layout: spring.layout, default: spring.smooth }}
      className="scroll-mt-48"
    >
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        GLASS,
        'group/section rounded-xl p-4 transition-[box-shadow,border-color,opacity] focus-within:border-border-strong sm:p-5',
        isDragging ? 'z-10 opacity-70 shadow-lg ring-1 ring-primary/20' : 'hover:shadow-sm',
      )}
    >
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          className="-ms-1 flex size-7 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground/60 transition hover:bg-muted hover:text-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
          aria-label={t('studio.dragSection', { default: 'Drag section' })}
        >
          <GripVertical className="size-4" />
        </button>
        <input
          value={displayTitle}
          onChange={(e) => onRename(section.id, e.target.value, locale)}
          placeholder={t('studio.sectionTitle', { default: 'Section title' })}
          className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 font-display text-lg font-medium tracking-[-0.015em] text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 hover:bg-muted/40 focus:bg-muted/40"
        />
        <span className="hidden shrink-0 px-1 text-xs text-muted-foreground tabular-nums sm:inline">
          {t('studio.lessonCount', { count: lessons.length, default: '{count, plural, one {# lesson} other {# lessons}}' })}
        </span>
        <button
          type="button"
          onClick={() => onAddLesson(section.id)}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-border/80 bg-card px-2.5 py-1.5 font-sans text-xs font-medium text-foreground shadow-xs transition hover:border-border-strong hover:bg-muted/60 active:scale-[0.97]"
        >
          <Plus className="size-3.5" /> {t('lesson', { default: 'Lesson' })}
        </button>
        <button
          type="button"
          onClick={() => onDelete(section.id)}
          aria-label={t('studio.deleteSection', { default: 'Delete section' })}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground/70 transition hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <SortableContext
        items={section.lessons.map((l) => 'les:' + l.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="mt-3 space-y-1.5 border-s border-border/60 ps-3 sm:ms-3">
          {section.lessons.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center">
              <Video className="size-5 text-muted-foreground/50" />
              <p className="max-w-xs font-sans text-sm text-muted-foreground">
                {t('studio.noLessonsYet', { default: 'No lessons yet — add your first lesson or drag one here.' })}
              </p>
              <button
                type="button"
                onClick={() => onAddLesson(section.id)}
                className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 font-sans text-xs font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90 active:scale-[0.97]"
              >
                <Plus className="size-3.5" /> {t('studio.addLesson', { default: 'Add lesson' })}
              </button>
            </div>
          )}
          {lessons.map((l) => (
            <LessonRow
              key={l.id}
              lesson={l}
              locale={locale}
              onOpen={onOpenLesson}
              onDelete={onDeleteLesson}
              onDuplicate={onDuplicateLesson}
            />
          ))}
        </div>
      </SortableContext>
    </div>
    </m.div>
  );
}
function LessonRow({
  lesson,
  locale,
  onOpen,
  onDelete,
  onDuplicate,
}: {
  lesson: Lesson;
  locale: ContentLocale;
  onOpen: (l: Lesson) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: 'les:' + lesson.id,
  });
  const t = useTranslations('courses');
  const tCommon = useTranslations('common');
  const style = { transform: CSS.Transform.toString(transform), transition };
  const displayTitle = locale === 'en' ? lesson.title : lesson.translations?.[locale]?.title || lesson.title;
  const motionState = useContext(CurriculumMotionContext);
  return (
    <m.div
      layout={motionState.dragging ? false : 'position'}
      initial={motionState.ready && !motionState.dragging ? { opacity: 0, y: 6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ layout: spring.layout, default: spring.smooth }}
    >
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group/lesson flex items-center gap-3 rounded-lg border border-transparent bg-card px-2 py-2 transition-[background-color,border-color,box-shadow,opacity]',
        isDragging
          ? 'relative z-10 border-border/80 opacity-80 shadow-lg ring-1 ring-primary/20'
          : 'hover:border-border/70 hover:bg-muted/40',
      )}
    >
      <button
        type="button"
        className="flex size-6 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground/50 transition hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label={t('studio.dragLesson', { default: 'Drag lesson' })}
      >
        <GripVertical className="size-4" />
      </button>
      {lesson.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={lesson.thumbnailUrl}
          alt=""
          className="h-8 w-14 shrink-0 rounded-md border border-border/70 bg-muted object-cover"
        />
      ) : (
        <span className="flex h-8 w-14 shrink-0 items-center justify-center rounded-md bg-muted font-display text-sm font-medium text-muted-foreground/60">
          {(lesson.title?.[0] || '?').toUpperCase()}
        </span>
      )}
      <button
        type="button"
        onClick={() => onOpen(lesson)}
        tabIndex={-1}
        className="min-w-0 flex-1 truncate text-start font-sans text-sm font-medium text-foreground"
      >
        {displayTitle}
      </button>
      {lesson.freePreview && (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 font-sans text-2xs font-medium text-success">
          <Eye className="size-3" /> {tCommon('preview', { default: 'Preview' })}
        </span>
      )}
      {lesson.videoDuration ? (
        <span className="flex shrink-0 items-center gap-1 font-sans text-xs tabular-nums text-muted-foreground">
          <Clock className="size-3.5" /> {t('studio.durationMinutes', { count: Math.round(lesson.videoDuration / 60), default: '{count, plural, one {#m} other {#m}}' })}
        </span>
      ) : null}
      <div className="flex shrink-0 items-center gap-0.5 opacity-70 transition-opacity group-focus-within/lesson:opacity-100 group-hover/lesson:opacity-100">
        <button
          type="button"
          onClick={() => onOpen(lesson)}
          aria-label={t('studio.editLesson', { default: 'Edit lesson' })}
          className="rounded-md p-1.5 text-muted-foreground transition hover:bg-card hover:text-foreground hover:shadow-xs"
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onDuplicate(lesson.id)}
          aria-label={t('studio.duplicateLesson', { default: 'Duplicate lesson' })}
          className="rounded-md p-1.5 text-muted-foreground transition hover:bg-card hover:text-foreground hover:shadow-xs"
        >
          <Copy className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(lesson.id)}
          aria-label={t('studio.deleteLesson', { default: 'Delete lesson' })}
          className="rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
    </m.div>
  );
}
export function CurriculumBuilder({
  sections,
  locale,
  onReorder,
  onAddSection,
  onRenameSection,
  onDeleteSection,
  onAddLesson,
  onOpenLesson,
  onDeleteLesson,
  onDuplicateLesson,
  onUpdateLesson,
  onUpdateSection,
}: {
  sections: Section[];
  locale: ContentLocale;
  onReorder: (sections: Section[]) => void;
  onAddSection: () => void;
  onRenameSection: (id: string, title: string, locale: ContentLocale) => void;
  onDeleteSection: (id: string) => void;
  onAddLesson: (sectionId: string) => void;
  onOpenLesson: (lesson: Lesson) => void;
  onDeleteLesson: (id: string) => void;
  onDuplicateLesson: (id: string) => void;
  onUpdateLesson: (id: string, patch: Partial<Lesson>) => void;
  onUpdateSection: (id: string, patch: Partial<Section>) => void;
}) {
  const [items, setItems] = useState<Section[]>(sections);
  const t = useTranslations('courses');
  const dragging = useRef(false);
  // Mirrors `dragging` for render: gates Framer layout so it never replays a dnd-kit move.
  const [dndActive, setDndActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [focusedSection, setFocusedSection] = useState<string | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));
    return () => {
      cancelAnimationFrame(frame);
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, []);
  const endDragMotion = () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => setDndActive(false), 260);
  };
  const jumpToSection = (id: string) => {
    setFocusedSection(id);
    document.getElementById('curriculum-section-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const handleRename = (id: string, title: string, sectionLocale: ContentLocale) => {
    setItems((prev) => prev.map((s) => {
      if (s.id !== id) return s;
      if (sectionLocale === 'en') return { ...s, title };
      return { ...s, translations: { ...(s.translations ?? {}), [sectionLocale]: { ...(s.translations?.[sectionLocale] ?? {}), title: title.trim() || undefined } } };
    }));
    onRenameSection(id, title, sectionLocale);
  };
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  useEffect(() => {
    if (!dragging.current) setItems(sections);
  }, [sections]);
  const findContainer = (id: string): string | undefined => {
    if (id.startsWith('sec:')) return id.slice(4);
    if (id.startsWith('les:')) {
      const lesId = id.slice(4);
      return items.find((s) => s.lessons.some((l) => l.id === lesId))?.id;
    }
    return undefined;
  };
  const onDragStart = (_e: DragStartEvent) => {
    dragging.current = true;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    setDndActive(true);
  };
  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (!activeId.startsWith('les:')) return;
    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);
    if (!activeContainer || !overContainer || activeContainer === overContainer) return;
    setItems((prev) => {
      const next = prev.map((s) => ({ ...s, lessons: [...(s.lessons ?? [])] }));
      const from = next.find((s) => s.id === activeContainer);
      const to = next.find((s) => s.id === overContainer);
      if (!from || !to) return prev;
      const aIdx = from.lessons.findIndex((l) => l.id === activeId.slice(4));
      if (aIdx < 0) return prev;
      const moved = from.lessons.splice(aIdx, 1)[0];
      if (!moved) return prev;
      const movedLesson: Lesson = { ...moved, seriesId: to.id };
      let insertIdx = to.lessons.length;
      if (overId.startsWith('les:')) {
        const oi = to.lessons.findIndex((l) => l.id === overId.slice(4));
        insertIdx = oi >= 0 ? oi : to.lessons.length;
      }
      to.lessons.splice(insertIdx, 0, movedLesson);
      renumber(next);
      return next;
    });
  };
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    dragging.current = false;
    endDragMotion();
    if (!over) {
      setItems(sections);
      return;
    }
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId.startsWith('sec:')) {
      const from = items.findIndex((s) => 'sec:' + s.id === activeId);
      const to = items.findIndex((s) => 'sec:' + s.id === overId);
      if (from !== -1 && to !== -1 && from !== to) {
        const next = arrayMove(items, from, to);
        renumber(next);
        setItems(next);
        onReorder(next);
      }
      return;
    }
    const container = findContainer(activeId);
    if (!container) return;
    const sec = items.find((s) => s.id === container);
    if (!sec) return;
    const oldIdx = sec.lessons.findIndex((l) => l.id === activeId.slice(4));
    const newIdx = sec.lessons.findIndex(
      (l) => l.id === (overId.startsWith('les:') ? overId.slice(4) : overId),
    );
    if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
      const next = items.map((s) =>
        s.id === container ? { ...s, lessons: arrayMove(s.lessons, oldIdx, newIdx) } : s,
      );
      renumber(next);
      setItems(next);
      onReorder(next);
    } else {
      onReorder(items);
    }
  };
  const activeOutline = focusedSection && items.some((s) => s.id === focusedSection) ? focusedSection : items[0]?.id ?? null;
  return (
    <CurriculumMotionContext.Provider value={{ dragging: dndActive, ready }}>
    <div className="space-y-6">
      {/* English is the translation source, so the bulk action only appears on that tab. */}
      {locale === 'en' && (
        <CourseLessonsTranslation
          sections={sections}
          onUpdateLesson={onUpdateLesson}
          onUpdateSection={onUpdateSection}
        />
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-medium tracking-[-0.018em] text-foreground">{t('curriculum', { default: 'Curriculum' })}</h2>
          <p className="mt-1 font-sans text-sm text-muted-foreground">
            {t('studio.sectionCount', { count: items.length, default: '{count, plural, one {# section} other {# sections}}' })}
            {' · '}
            {t('studio.reorderHint', { default: 'drag to reorder sections and lessons' })}
          </p>
        </div>
        <button
          type="button"
          onClick={onAddSection}
          className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 py-2 font-sans text-sm font-medium text-foreground shadow-xs transition hover:border-border-strong hover:bg-muted/60 active:scale-[0.98]"
        >
          <Plus className="size-4" /> {t('studio.addSection', { default: 'Add section' })}
        </button>
      </div>
      {items.length === 0 ? (
        <m.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring.gentle}
          className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center"
        >
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <BookOpen className="size-6" />
          </div>
          <p className="mt-4 font-display text-xl font-medium tracking-[-0.015em] text-foreground">
            {t('studio.buildCurriculum', { default: 'Build your curriculum' })}
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-pretty font-sans text-sm text-muted-foreground">
            {t('studio.buildCurriculumHint', { default: 'Group your lessons into sections. Drag to reorder sections and move lessons between them at any time.' })}
          </p>
          <button
            type="button"
            onClick={onAddSection}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 font-sans text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 active:scale-[0.98]"
          >
            <Plus className="size-4" /> {t('studio.addFirstSection', { default: 'Add your first section' })}
          </button>
          <div className="mt-4 flex items-center justify-center gap-1.5 font-sans text-xs text-muted-foreground/80">
            <Sparkles className="size-3.5" /> {t('studio.sectionsTip', { default: 'Tip: keep sections short and focused' })}
          </div>
        </m.div>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[200px_minmax(0,1fr)]">
          <nav aria-label={t('curriculum', { default: 'Curriculum' })} className="hidden xl:sticky xl:top-48 xl:block">
            <ol className="space-y-0.5 border-s border-border/70">
              {items.map((s, index) => {
                const active = s.id === activeOutline;
                const title = (locale === 'en' ? s.title : s.translations?.[locale]?.title || s.title) || t('studio.sectionTitle', { default: 'Section title' });
                return (
                  <m.li key={s.id} layout="position" transition={spring.layout} className="relative">
                    {active && (
                      <m.span layoutId="curriculum-outline-indicator" transition={spring.smooth} className="absolute -start-px inset-y-1 w-0.5 rounded-full bg-primary" aria-hidden />
                    )}
                    <button
                      type="button"
                      onClick={() => jumpToSection(s.id)}
                      aria-current={active ? 'true' : undefined}
                      className={cn(
                        'flex w-full items-baseline gap-2 rounded-e-md py-1.5 pe-2 ps-3.5 text-start text-sm transition-colors',
                        active ? 'text-foreground' : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                      )}
                    >
                      <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground/70">{String(index + 1).padStart(2, '0')}</span>
                      <span dir="auto" className={cn('min-w-0 flex-1 truncate', active && 'font-medium')}>{title}</span>
                      <span className="shrink-0 text-2xs tabular-nums text-muted-foreground/70">{s.lessons.length}</span>
                    </button>
                  </m.li>
                );
              })}
            </ol>
          </nav>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            onDragCancel={endDragMotion}
          >
            <SortableContext
              items={items.map((s) => 'sec:' + s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="min-w-0 space-y-4" onFocusCapture={(e) => { const host = (e.target as HTMLElement).closest('[id^="curriculum-section-"]'); if (host) setFocusedSection(host.id.slice('curriculum-section-'.length)); }}>
                {items.map((s) => (
                  <SectionCard
                    key={s.id}
                    section={s}
                    locale={locale}
                    onRename={handleRename}
                    onDelete={onDeleteSection}
                    onAddLesson={onAddLesson}
                    onOpenLesson={onOpenLesson}
                    onDeleteLesson={onDeleteLesson}
                    onDuplicateLesson={onDuplicateLesson}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
    </CurriculumMotionContext.Provider>
  );
}
