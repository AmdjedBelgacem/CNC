'use client';
import { useEffect, useRef, useState } from 'react';
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
import { cn } from '@/lib/utils';
import { GLASS } from './glass';
import type { Lesson, Section } from './types';
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
  onRename,
  onDelete,
  onAddLesson,
  onOpenLesson,
  onDeleteLesson,
  onDuplicateLesson,
}: {
  section: Section;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onAddLesson: (sectionId: string) => void;
  onOpenLesson: (lesson: Lesson) => void;
  onDeleteLesson: (id: string) => void;
  onDuplicateLesson: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: 'sec:' + section.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const lessons = section.lessons ?? [];
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(GLASS, 'rounded-xl p-4 transition', isDragging && 'opacity-60')}
    >
      {' '}
      <div className="flex items-center gap-3">
        {' '}
        <button
          type="button"
          className="cursor-grab text-muted-foreground transition hover:text-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
          aria-label="Drag section"
        >
          {' '}
          <GripVertical className="h-5 w-5" />{' '}
        </button>{' '}
        <input
          value={section.title}
          onChange={(e) => onRename(section.id, e.target.value)}
          placeholder="Section title"
          className="flex-1 bg-transparent font-display text-lg font-semibold text-foreground outline-none placeholder:text-muted-foreground/60"
        />{' '}
        <span className="rounded-md bg-transparent px-2 py-0.5 font-sans text-xs text-muted-foreground">
          {' '}
          {lessons.length} lessons{' '}
        </span>{' '}
        <button
          type="button"
          onClick={() => onAddLesson(section.id)}
          className="flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 font-sans text-xs font-medium text-white transition hover:bg-blue-700"
        >
          {' '}
          <Plus className="h-4 w-4" /> Lesson{' '}
        </button>{' '}
        <button
          type="button"
          onClick={() => onDelete(section.id)}
          aria-label="Delete section"
          className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-red-500/10 hover:text-red-600"
        >
          {' '}
          <Trash2 className="h-4 w-4" />{' '}
        </button>{' '}
      </div>{' '}
      <SortableContext
        items={section.lessons.map((l) => 'les:' + l.id)}
        strategy={verticalListSortingStrategy}
      >
        {' '}
        <div className="mt-3 space-y-2">
          {' '}
          {section.lessons.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card px-4 py-5 text-center">
              {' '}
              <Video className="h-5 w-5 text-muted-foreground/60" />{' '}
              <p className="font-sans text-sm text-muted-foreground">
                {' '}
                No lessons yet — add your first lesson or drag one here.{' '}
              </p>{' '}
              <button
                type="button"
                onClick={() => onAddLesson(section.id)}
                className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 font-sans text-xs font-medium text-white transition hover:bg-blue-700"
              >
                {' '}
                <Plus className="h-3.5 w-3.5" /> Add lesson{' '}
              </button>{' '}
            </div>
          )}{' '}
          {lessons.map((l) => (
            <LessonRow
              key={l.id}
              lesson={l}
              onOpen={onOpenLesson}
              onDelete={onDeleteLesson}
              onDuplicate={onDuplicateLesson}
            />
          ))}{' '}
        </div>{' '}
      </SortableContext>{' '}
    </div>
  );
}
function LessonRow({
  lesson,
  onOpen,
  onDelete,
  onDuplicate,
}: {
  lesson: Lesson;
  onOpen: (l: Lesson) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: 'les:' + lesson.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5',
        isDragging && 'opacity-60',
      )}
    >
      {' '}
      <button
        type="button"
        className="cursor-grab text-muted-foreground transition hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label="Drag lesson"
      >
        {' '}
        <GripVertical className="h-4 w-4" />{' '}
      </button>{' '}
      {lesson.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={lesson.thumbnailUrl}
          alt=""
          className="h-8 w-14 shrink-0 rounded-md border border-border bg-muted object-cover"
        />
      ) : (
        <span className="flex h-8 w-14 shrink-0 items-center justify-center rounded-md bg-muted font-sans text-sm font-bold text-muted-foreground/50">
          {(lesson.title?.[0] || '?').toUpperCase()}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate font-sans text-sm font-medium text-foreground">
        {lesson.title}
      </span>{' '}
      {lesson.freePreview && (
        <span className="flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 font-sans text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
          {' '}
          <Eye className="h-3 w-3" /> Preview{' '}
        </span>
      )}{' '}
      {lesson.videoDuration ? (
        <span className="flex items-center gap-1 font-sans text-xs text-muted-foreground">
          {' '}
          <Clock className="h-3 w-3" /> {Math.round(lesson.videoDuration / 60)}m{' '}
        </span>
      ) : null}{' '}
      <button
        type="button"
        onClick={() => onOpen(lesson)}
        aria-label="Edit lesson"
        className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground dark:hover:bg-[#2C2C2E]"
      >
        {' '}
        <Pencil className="h-4 w-4" />{' '}
      </button>{' '}
      <button
        type="button"
        onClick={() => onDuplicate(lesson.id)}
        aria-label="Duplicate lesson"
        className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground dark:hover:bg-[#2C2C2E]"
      >
        {' '}
        <Copy className="h-4 w-4" />{' '}
      </button>{' '}
      <button
        type="button"
        onClick={() => onDelete(lesson.id)}
        aria-label="Delete lesson"
        className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-red-500/10 hover:text-red-600"
      >
        {' '}
        <Trash2 className="h-4 w-4" />{' '}
      </button>{' '}
    </div>
  );
}
export function CurriculumBuilder({
  sections,
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
  onReorder: (sections: Section[]) => void;
  onAddSection: () => void;
  onRenameSection: (id: string, title: string) => void;
  onDeleteSection: (id: string) => void;
  onAddLesson: (sectionId: string) => void;
  onOpenLesson: (lesson: Lesson) => void;
  onDeleteLesson: (id: string) => void;
  onDuplicateLesson: (id: string) => void;
}) {
  const [items, setItems] = useState<Section[]>(sections);
  const dragging = useRef(false);
  const handleRename = (id: string, title: string) => {
    setItems((prev) => prev.map((s) => (s.id === id ? { ...s, title } : s)));
    onRenameSection(id, title);
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
  return (
    <div className="space-y-4">
      {' '}
      <div className="flex items-center justify-between">
        {' '}
        <p className="font-sans text-sm text-muted-foreground">
          {' '}
          {items.length} section{items.length === 1 ? '' : 's'} · drag to reorder sections and
          lessons{' '}
        </p>{' '}
        <button
          type="button"
          onClick={onAddSection}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-transparent px-3 py-2 font-sans text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          {' '}
          <Plus className="h-4 w-4" /> Add section{' '}
        </button>{' '}
      </div>{' '}
      {items.length === 0 ? (
        <div className={cn(GLASS, 'rounded-xl px-6 py-12 text-center')}>
          {' '}
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-accent/10 text-accent">
            {' '}
            <BookOpen className="h-7 w-7" />{' '}
          </div>{' '}
          <p className="mt-3 font-display text-lg font-semibold text-foreground">
            Build your curriculum
          </p>{' '}
          <p className="mx-auto mt-1 max-w-sm font-sans text-sm text-muted-foreground">
            {' '}
            Group your lessons into sections. Drag to reorder sections and move lessons between them
            at any time.{' '}
          </p>{' '}
          <button
            type="button"
            onClick={onAddSection}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 font-sans text-sm font-medium text-white transition hover:bg-blue-700"
          >
            {' '}
            <Plus className="h-4 w-4" /> Add your first section{' '}
          </button>{' '}
          <div className="mt-4 flex items-center justify-center gap-1.5 font-sans text-xs text-muted-foreground/70">
            {' '}
            <Sparkles className="h-3.5 w-3.5" /> Tip: keep sections short and focused{' '}
          </div>{' '}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          {' '}
          <SortableContext
            items={items.map((s) => 'sec:' + s.id)}
            strategy={verticalListSortingStrategy}
          >
            {' '}
            <div className="space-y-4">
              {' '}
              {items.map((s) => (
                <SectionCard
                  key={s.id}
                  section={s}
                  onRename={handleRename}
                  onDelete={onDeleteSection}
                  onAddLesson={onAddLesson}
                  onOpenLesson={onOpenLesson}
                  onDeleteLesson={onDeleteLesson}
                  onDuplicateLesson={onDuplicateLesson}
                />
              ))}{' '}
            </div>{' '}
          </SortableContext>{' '}
        </DndContext>
      )}{' '}
    </div>
  );
}
