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
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { BookOpen, ChevronDown, Copy, FileText, GripVertical, ListChecks, PlayCircle, Plus, Trash2 } from 'lucide-react';
import type { ContentLocale } from '@titan/shared';
import { m } from 'framer-motion';
import { cn } from '@/lib/utils';
import { spring } from '@/lib/motion';
import { EditorSection } from '@/components/admin/editor/editor-kit';
import { lessonArabicComplete } from './completeness';
import type { Lesson, Section } from './types';

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

type Translate = (key: string, values?: Record<string, string | number>) => string;

function renumber(sections: Section[]) {
  sections.forEach((s, i) => {
    s.sortOrder = i;
    (s.lessons ?? []).forEach((l, j) => {
      l.sortOrder = j;
    });
  });
}

export type LessonKind = 'video' | 'reading' | 'quiz';

/** What a learner mostly does in the lesson, for its icon in the outline. */
export function lessonKind(lesson: Lesson): LessonKind {
  const blocks = lesson.contentBlocks?.blocks ?? [];
  if (blocks.some((block) => block.type === 'quiz')) return 'quiz';
  if (lesson.videoUrl || lesson.videoMeta || blocks.some((block) => block.type === 'video')) return 'video';
  return 'reading';
}

const KIND_ICON = { video: PlayCircle, reading: FileText, quiz: ListChecks } as const;

export function formatDuration(seconds: number, t: Translate): string {
  const minutes = Math.round(seconds / 60);
  const h = Math.floor(minutes / 60);
  const min = minutes % 60;
  return h > 0 ? t('studio.durationHM', { h, m: min }) : t('studio.durationM', { m: min });
}

function SectionCard({
  section,
  index,
  locale,
  selectedLessonId,
  onRename,
  onDelete,
  onAddLesson,
  onOpenLesson,
  onDeleteLesson,
  onDuplicateLesson,
}: {
  section: Section;
  index: number;
  locale: ContentLocale;
  selectedLessonId: string | null;
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
  const [open, setOpen] = useState(true);
  const style = { transform: CSS.Transform.toString(transform), transition };
  const lessons = section.lessons ?? [];
  const arabic = locale === 'ar';
  const displayTitle = arabic ? section.translations?.ar?.title ?? '' : section.title;
  const motionState = useContext(CurriculumMotionContext);
  const seconds = lessons.reduce((sum, lesson) => sum + (lesson.videoDuration ?? 0), 0);
  const bodyId = 'curriculum-series-body-' + section.id;
  const number = String(index + 1).padStart(2, '0');

  const confirmDelete = () => {
    if (
      lessons.length > 0 &&
      !window.confirm(
        t('studio.confirmDeleteSeries', { title: section.title || number, count: lessons.length }),
      )
    ) {
      return;
    }
    onDelete(section.id);
  };

  return (
    <m.div
      id={'curriculum-section-' + section.id}
      layout={motionState.dragging ? false : 'position'}
      initial={motionState.ready && !motionState.dragging ? { opacity: 0, y: 10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ layout: spring.layout, default: spring.smooth }}
      className="scroll-mt-24"
    >
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'rounded-2xl border border-border/70 bg-background p-2 transition-[box-shadow,border-color,opacity] focus-within:border-border-strong sm:p-3',
          isDragging ? 'relative z-10 opacity-80 shadow-lg ring-1 ring-primary/20' : '',
        )}
      >
        <div className="flex items-start gap-1 sm:gap-2">
          <button
            type="button"
            className="flex size-10 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground/70 transition hover:bg-muted hover:text-foreground active:cursor-grabbing"
            {...attributes}
            {...listeners}
            aria-label={t('studio.dragSection', { default: 'Drag section' })}
          >
            <GripVertical className="size-4" />
          </button>
          <span className="mt-2.5 shrink-0 font-mono text-xs tabular-nums text-muted-foreground" aria-hidden>
            {number}
          </span>
          <div className="min-w-0 flex-1">
            <input
              value={displayTitle}
              onChange={(e) => onRename(section.id, e.target.value, locale)}
              dir={arabic ? 'rtl' : undefined}
              lang={arabic ? 'ar' : undefined}
              aria-label={t('studio.sectionTitle', { default: 'Section title' })}
              placeholder={arabic ? section.title : t('studio.sectionTitle', { default: 'Section title' })}
              className="min-h-10 w-full min-w-0 rounded-lg bg-transparent px-1.5 font-display text-lg font-medium tracking-[-0.015em] text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 hover:bg-muted/50 focus:bg-muted/50"
            />
            <p className="px-1.5 text-xs tabular-nums text-muted-foreground">
              {t('studio.lessonCount', { count: lessons.length })}
              {seconds > 0 && ` · ${formatDuration(seconds, t)}`}
            </p>
          </div>
          <button
            type="button"
            onClick={confirmDelete}
            aria-label={t('studio.deleteSection', { default: 'Delete section' })}
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls={bodyId}
            aria-label={open ? t('studio.collapseSeries') : t('studio.expandSeries')}
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <ChevronDown className={cn('size-4 transition-transform', !open && '-rotate-90 rtl:rotate-90')} />
          </button>
        </div>
        <div id={bodyId} hidden={!open}>
          <SortableContext items={lessons.map((l) => 'les:' + l.id)} strategy={verticalListSortingStrategy}>
            <ul className="mt-2 space-y-1">
              {lessons.map((lesson) => (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  locale={locale}
                  selected={lesson.id === selectedLessonId}
                  onOpen={onOpenLesson}
                  onDelete={onDeleteLesson}
                  onDuplicate={onDuplicateLesson}
                />
              ))}
            </ul>
          </SortableContext>
          <button
            type="button"
            onClick={() => onAddLesson(section.id)}
            className="mt-1.5 flex min-h-11 w-full items-center gap-2 rounded-xl border border-dashed border-border-strong/70 px-3 text-start text-13 font-medium text-muted-foreground transition hover:border-primary/50 hover:bg-primary/5 hover:text-foreground"
          >
            <Plus className="size-4 shrink-0" />
            {lessons.length === 0
              ? t('studio.noLessonsYet', { default: 'No lessons yet — add your first lesson or drag one here.' })
              : t('studio.addLessonHere')}
          </button>
        </div>
      </div>
    </m.div>
  );
}

function LessonRow({
  lesson,
  locale,
  selected,
  onOpen,
  onDelete,
  onDuplicate,
}: {
  lesson: Lesson;
  locale: ContentLocale;
  selected: boolean;
  onOpen: (l: Lesson) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: 'les:' + lesson.id,
  });
  const t = useTranslations('courses');
  const style = { transform: CSS.Transform.toString(transform), transition };
  const arabic = locale === 'ar';
  const displayTitle = (arabic && lesson.translations?.ar?.title?.trim()) || lesson.title;
  const motionState = useContext(CurriculumMotionContext);
  const kind = lessonKind(lesson);
  const KindIcon = KIND_ICON[kind];
  const arDone = lessonArabicComplete(lesson);
  const kindLabel = t(`studio.lessonKind.${kind}`);
  return (
    <m.li
      layout={motionState.dragging ? false : 'position'}
      initial={motionState.ready && !motionState.dragging ? { opacity: 0, y: 6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ layout: spring.layout, default: spring.smooth }}
    >
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'group/lesson flex min-h-12 items-center gap-1 rounded-xl border px-1 transition-[background-color,border-color,box-shadow,opacity] sm:gap-2',
          isDragging
            ? 'relative z-10 border-border/80 bg-card opacity-90 shadow-lg ring-1 ring-primary/20'
            : selected
              ? 'border-primary/35 bg-primary/5'
              : 'border-transparent bg-card hover:border-border/70',
        )}
      >
        <button
          type="button"
          className="flex size-10 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground/60 transition hover:text-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
          aria-label={t('studio.dragLesson', { default: 'Drag lesson' })}
        >
          <GripVertical className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => onOpen(lesson)}
          aria-current={selected ? 'true' : undefined}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-lg text-start"
        >
          <KindIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="sr-only">{kindLabel}: </span>
          <span
            dir={arabic && lesson.translations?.ar?.title?.trim() ? 'rtl' : undefined}
            className="min-w-0 flex-1 truncate text-sm font-medium text-foreground"
          >
            {displayTitle}
          </span>
          {lesson.freePreview && (
            <span className="hidden shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-2xs font-medium text-accent sm:inline">
              {t('studio.freePreview', { default: 'Free preview' })}
            </span>
          )}
          {lesson.videoDuration ? (
            <span className="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:inline">
              {formatDuration(lesson.videoDuration, t)}
            </span>
          ) : null}
          <span
            className={cn(
              'shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[10.5px] font-medium tracking-wide',
              arDone ? 'bg-accent/15 text-accent' : 'bg-muted text-muted-foreground',
            )}
            title={arDone ? t('studio.arabicComplete') : t('studio.arabicMissingShort')}
          >
            AR<span className="sr-only"> {arDone ? t('studio.arabicComplete') : t('studio.arabicMissingShort')}</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => onDuplicate(lesson.id)}
          aria-label={t('studio.duplicateLesson', { default: 'Duplicate lesson' })}
          className="hidden size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground sm:flex sm:opacity-60 sm:group-focus-within/lesson:opacity-100 sm:group-hover/lesson:opacity-100"
        >
          <Copy className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(lesson.id)}
          aria-label={t('studio.deleteLesson', { default: 'Delete lesson' })}
          className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive sm:opacity-60 sm:group-focus-within/lesson:opacity-100 sm:group-hover/lesson:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </m.li>
  );
}

/**
 * The course outline: series cards holding lesson rows, both drag-to-reorder.
 *
 * Selecting a lesson hands it to the studio, which shows it in the inspector
 * beside the outline (or the full lesson drawer on a narrow screen).
 */
export function CurriculumBuilder({
  sections,
  locale,
  selectedLessonId,
  onReorder,
  onAddSection,
  onRenameSection,
  onDeleteSection,
  onAddLesson,
  onOpenLesson,
  onDeleteLesson,
  onDuplicateLesson,
}: {
  sections: Section[];
  locale: ContentLocale;
  selectedLessonId: string | null;
  onReorder: (sections: Section[]) => void;
  onAddSection: () => void;
  onRenameSection: (id: string, title: string, locale: ContentLocale) => void;
  onDeleteSection: (id: string) => void;
  onAddLesson: (sectionId: string) => void;
  onOpenLesson: (lesson: Lesson) => void;
  onDeleteLesson: (id: string) => void;
  onDuplicateLesson: (id: string) => void;
}) {
  const [items, setItems] = useState<Section[]>(sections);
  const t = useTranslations('courses');
  const dragging = useRef(false);
  // Mirrors `dragging` for render: gates Framer layout so it never replays a dnd-kit move.
  const [dndActive, setDndActive] = useState(false);
  const [ready, setReady] = useState(false);
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
  const handleRename = (id: string, title: string, sectionLocale: ContentLocale) => {
    setItems((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        if (sectionLocale === 'en') return { ...s, title };
        return {
          ...s,
          translations: {
            ...(s.translations ?? {}),
            [sectionLocale]: { ...(s.translations?.[sectionLocale] ?? {}), title: title || undefined },
          },
        };
      }),
    );
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
  const onDragStart = () => {
    dragging.current = true;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    setDndActive(true);
  };
  const onDragCancel = () => {
    dragging.current = false;
    setItems(sections);
    endDragMotion();
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
    const newIdx = sec.lessons.findIndex((l) => l.id === (overId.startsWith('les:') ? overId.slice(4) : overId));
    if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
      const next = items.map((s) => (s.id === container ? { ...s, lessons: arrayMove(s.lessons, oldIdx, newIdx) } : s));
      renumber(next);
      setItems(next);
      onReorder(next);
    } else {
      onReorder(items);
    }
  };
  const lessonTotal = items.reduce((sum, s) => sum + s.lessons.length, 0);
  const addSeriesButton = (
    <button
      type="button"
      onClick={onAddSection}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border-strong bg-card px-4 text-sm font-medium text-foreground transition hover:bg-muted"
    >
      <Plus className="size-4" /> {t('studio.addSection', { default: 'Add section' })}
    </button>
  );
  return (
    <CurriculumMotionContext.Provider value={{ dragging: dndActive, ready }}>
      <EditorSection
        id="curriculum"
        title={t('curriculum', { default: 'Curriculum' })}
        hint={
          items.length > 0
            ? `${t('studio.sectionCount', { count: items.length })} · ${t('studio.lessonCount', { count: lessonTotal })}`
            : undefined
        }
      >
        {items.length === 0 ? (
          <m.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring.gentle}
            className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center"
          >
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <BookOpen className="size-6" />
            </div>
            <p className="mt-4 font-display text-xl font-medium tracking-[-0.015em] text-foreground">
              {t('studio.buildCurriculum', { default: 'Build your curriculum' })}
            </p>
            <p className="mx-auto mt-1.5 max-w-sm text-pretty text-sm text-muted-foreground">
              {t('studio.buildCurriculumHint', {
                default: 'Group your lessons into sections. Drag to reorder sections and move lessons between them at any time.',
              })}
            </p>
            <button
              type="button"
              onClick={onAddSection}
              className="pressable mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90"
            >
              <Plus className="size-4" /> {t('studio.addFirstSection', { default: 'Add your first section' })}
            </button>
          </m.div>
        ) : (
          <>
            <p className="-mt-3 text-13 text-muted-foreground">
              {t('studio.reorderHint', { default: 'drag to reorder sections and lessons' })}
            </p>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragEnd={onDragEnd}
              onDragCancel={onDragCancel}
            >
              <SortableContext items={items.map((s) => 'sec:' + s.id)} strategy={verticalListSortingStrategy}>
                <div className="flex min-w-0 flex-col gap-3">
                  {items.map((s, index) => (
                    <SectionCard
                      key={s.id}
                      section={s}
                      index={index}
                      locale={locale}
                      selectedLessonId={selectedLessonId}
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
            <div>{addSeriesButton}</div>
          </>
        )}
      </EditorSection>
    </CurriculumMotionContext.Provider>
  );
}
