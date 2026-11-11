'use client';

import { useTranslations } from 'next-intl';
import { BookOpen, ChevronRight, PlayCircle, X } from 'lucide-react';
import type { ContentLocale, LessonContentDocument } from '@titan/shared';
import { Modal, ModalHeader } from '@/components/ui/modal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LessonBlockRenderer } from '@/components/learning/lesson-block-renderer';
import { LanguageAvailability } from '@/components/academy/language-availability';
import { AnimatePresence, m } from 'framer-motion';
import { spring } from '@/lib/motion';
import { Crossfade } from '@/components/ui/motion';
import type { CourseStudioData, Lesson } from './types';

export function StudioPreview({
  open,
  course,
  lesson,
  locale,
  onClose,
  onSelectLesson,
}: {
  open: boolean;
  course: CourseStudioData;
  lesson: Lesson | null;
  locale: ContentLocale;
  onClose: () => void;
  onSelectLesson: (lesson: Lesson) => void;
}) {
  const t = useTranslations('courses.studio.preview');
  // Same root in both branches so AnimatePresence survives the close and plays the exit.
  if (!open) return <AnimatePresence />;
  const blocks: LessonContentDocument = lesson?.contentBlocks ?? { schemaVersion: 1, blocks: [] };
  return (
    <AnimatePresence>
    <Modal
      key="studio-preview"
      width="max-w-4xl"
      onClose={onClose}
      title={t('title', { default: 'Studio preview' })}
      header={
        <ModalHeader
          loading={false}
          initials={(course.title || 'C').charAt(0).toUpperCase()}
          gradient="bg-primary/10 text-primary"
          title={course.title || t('coursePreview', { default: 'Course preview' })}
          subtitle={lesson ? `/${course.slug}/lessons/${lesson.slug}` : `/${course.slug}`}
          onClose={onClose}
        />
      }
    >
      <div className="space-y-6 bg-background p-5 sm:p-7" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-5 shadow-xs sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div><p className="eyebrow">{t('draftPreview', { default: 'Draft preview' })}</p><h2 dir="auto" className="mt-2 text-balance font-display text-2xl font-medium tracking-[-0.02em] text-foreground sm:text-3xl">{course.title || t('untitled', { default: 'Untitled course' })}</h2>{course.subtitle && <p className="mt-1 text-sm text-muted-foreground">{course.subtitle}</p>}</div>
          <LanguageAvailability availableLocales={course.availableLocales} resolvedLocale={course.resolvedLocale} fallbackFields={course.fallbackFields} />
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
          <Card className="h-fit lg:sticky lg:top-0"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 font-display text-base font-medium"><BookOpen className="size-4 text-primary" />{t('curriculum', { default: 'Curriculum' })}</CardTitle></CardHeader><CardContent className="space-y-1 pt-0">{course.series.flatMap((section) => section.lessons).map((item, index) => <button key={item.id} type="button" onClick={() => onSelectLesson(item)} aria-current={item.id === lesson?.id ? 'true' : undefined} className={`relative flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start text-xs transition-colors ${item.id === lesson?.id ? 'font-medium text-primary' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}`}>{item.id === lesson?.id && <m.span layoutId="studio-preview-lesson" transition={spring.smooth} className="absolute inset-0 rounded-lg bg-primary/10" aria-hidden />}<span className="relative w-4 font-mono tabular-nums">{index + 1}</span><span dir="auto" className="relative min-w-0 flex-1 truncate">{item.title}</span><ChevronRight className="flip-rtl relative size-3.5 shrink-0" /></button>)}</CardContent></Card>
          <Crossfade value={lesson?.id ?? 'none'} className="min-w-0 space-y-4">
            {lesson ? <>
              <div className="flex items-center gap-2"><PlayCircle className="size-5 text-primary" /><h3 dir="auto" className="font-display text-xl font-medium tracking-[-0.015em] text-foreground">{lesson.title}</h3></div>
              {lesson.description && <p className="text-sm leading-relaxed text-muted-foreground">{lesson.description}</p>}
              {blocks.blocks.length > 0 ? <LessonBlockRenderer blocks={blocks} locale={locale} videoUrl={lesson.videoUrl} preview /> : lesson.content ? <p className="whitespace-pre-line rounded-xl border border-border/70 bg-card p-4 text-sm leading-relaxed text-foreground">{lesson.content}</p> : <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{t('noBlocks', { default: 'Add lesson blocks to preview this lesson.' })}</p>}
            </> : <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{t('selectLesson', { default: 'Select a lesson from the curriculum to preview its learning experience.' })}</div>}
          </Crossfade>
        </div>
        <div className="flex justify-end border-t border-border/70 pt-4"><button type="button" onClick={onClose} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border/80 bg-card px-3 text-xs font-medium text-foreground shadow-xs transition hover:bg-muted/60 active:scale-[0.98]"><X className="size-3.5" />{t('close', { default: 'Close preview' })}</button></div>
      </div>
    </Modal>
    </AnimatePresence>
  );
}
