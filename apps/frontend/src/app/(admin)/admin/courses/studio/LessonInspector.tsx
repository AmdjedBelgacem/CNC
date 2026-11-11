'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Copy, ExternalLink, Film, Trash2, Upload, X } from 'lucide-react';
import { LESSON_FIELDS, type LessonBlockType } from '@titan/shared';
import { cn } from '@/lib/utils';
import { SwitchField } from '@/components/admin/admin-form';
import { BilingualField } from '@/components/admin/editor/editor-kit';
import { useTranslateDraft } from '@/components/admin/translation';
import { formatDuration } from './CurriculumBuilder';
import type { Lesson } from './types';

export type LessonDrawerTab = 'details' | 'media' | 'content' | 'files';

const BLOCK_LABEL: Record<LessonBlockType, string> = {
  video: 'blockVideo',
  rich_text: 'blockRichText',
  interactive_image: 'blockInteractiveImage',
  quiz: 'blockQuiz',
};

function formatBytes(n: number): string {
  if (!n) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let x = n;
  while (x >= 1024 && i < units.length - 1) {
    x /= 1024;
    i += 1;
  }
  return `${x.toFixed(1)} ${units[i]}`;
}

/**
 * The selected lesson, docked beside the outline.
 *
 * Covers what an editor changes while arranging a course — the title in both
 * languages, free preview, whether the video is in — and saves each change as
 * it is made. Uploads, attachments and the block content stay in the full
 * lesson editor, one click away.
 */
export function LessonInspector({
  lesson,
  position,
  sectionTitle,
  onPatch,
  onOpenFull,
  onClose,
  onDuplicate,
  onDelete,
}: {
  lesson: Lesson;
  /** "02.03": series and lesson number. */
  position: string;
  sectionTitle: string;
  onPatch: (id: string, patch: Partial<Lesson>) => void;
  onOpenFull: (tab: LessonDrawerTab) => void;
  onClose: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('courses');
  const tCommon = useTranslations('common');
  const tMedia = useTranslations('media');
  const tTranslate = useTranslations('admin.translate');
  const [titleEn, setTitleEn] = useState(lesson.title);
  const [titleAr, setTitleAr] = useState(lesson.translations?.ar?.title ?? '');
  const [deleteArmed, setDeleteArmed] = useState(false);
  const lessonRef = useRef(lesson);
  lessonRef.current = lesson;
  const pending = useRef<{ id: string; base: Lesson; en?: string; ar?: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onPatchRef = useRef(onPatch);
  onPatchRef.current = onPatch;

  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const next = pending.current;
    pending.current = null;
    if (!next) return;
    // The lesson as it is now when it is still the one shown, else as it was when the edit began.
    const current = lessonRef.current.id === next.id ? lessonRef.current : next.base;
    const patch: Partial<Lesson> = {};
    // A lesson must keep an English title; an emptied field is simply not saved.
    // Not trimmed: a save mid-sentence would otherwise eat the space just typed.
    if (next.en !== undefined && next.en.trim() && next.en !== current.title) patch.title = next.en;
    if (next.ar !== undefined) {
      patch.translations = {
        ...(current.translations ?? {}),
        ar: { ...(current.translations?.ar ?? {}), title: next.ar || undefined },
      };
    }
    if (Object.keys(patch).length) onPatchRef.current(next.id, patch);
  };

  const schedule = (field: 'en' | 'ar', value: string) => {
    if (pending.current && pending.current.id !== lesson.id) flush();
    pending.current = { ...(pending.current ?? { id: lesson.id, base: lesson }), [field]: value };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 700);
  };

  // A different lesson, or the same one changed elsewhere (the full editor, a
  // translation pass): show what is stored, unless an edit here is still waiting.
  const storedAr = lesson.translations?.ar?.title ?? '';
  useEffect(() => {
    if (pending.current?.id === lesson.id) return;
    setTitleEn(lesson.title);
    setTitleAr(storedAr);
    setDeleteArmed(false);
  }, [lesson.id, lesson.title, storedAr]);

  // Save what was typed before switching to another lesson or closing.
  useEffect(() => () => flush(), [lesson.id]);

  const translate = useTranslateDraft({
    entity: 'lesson',
    descriptors: LESSON_FIELDS,
    groups: [{ key: 'lesson', fields: { Title: lesson.title ?? '', Description: lesson.description ?? '' } }],
    onApply: (_key, translations) => {
      const current = lessonRef.current;
      const ar = current.translations?.ar ?? {};
      onPatchRef.current(current.id, {
        translations: {
          ...(current.translations ?? {}),
          ar: {
            ...ar,
            title: translations.Title ?? ar.title,
            description: translations.Description ?? ar.description ?? null,
          },
        },
      });
    },
    confirmOverwrite: () => window.confirm(tTranslate('overwriteConfirm')),
  });

  const blocks = lesson.contentBlocks?.blocks ?? [];
  const blockCounts = blocks.reduce<Partial<Record<LessonBlockType, number>>>((acc, block) => {
    acc[block.type] = (acc[block.type] ?? 0) + 1;
    return acc;
  }, {});
  const hasVideo = Boolean(lesson.videoUrl || lesson.videoMeta);

  return (
    <section
      aria-labelledby="lesson-inspector-title"
      className="flex flex-col gap-4 rounded-2xl border border-primary/25 bg-card p-4 shadow-xs"
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            {t('lesson', { default: 'Lesson' })} {position}
          </p>
          <h2 id="lesson-inspector-title" className="truncate font-display text-lg font-medium leading-snug tracking-[-0.015em] text-foreground">
            {lesson.title || t('studio.newLesson', { default: 'New lesson' })}
          </h2>
          <p className="truncate text-xs text-muted-foreground">{sectionTitle}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            flush();
            onClose();
          }}
          aria-label={tCommon('close')}
          className="-me-1.5 -mt-1 flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </header>

      <BilingualField
        stacked
        id={`inspector-title-${lesson.id}`}
        label={t('studio.live.titleLabel', { default: 'Title' })}
        required
        en={{
          value: titleEn,
          onChange: (value) => {
            setTitleEn(value);
            schedule('en', value);
          },
        }}
        ar={{
          value: titleAr,
          onChange: (value) => {
            setTitleAr(value);
            schedule('ar', value);
          },
        }}
        onDraftArabic={() => void translate.run('missing')}
        drafting={translate.busy}
        error={!titleEn.trim() ? t('studio.titleRequired', { default: 'Lesson title is required' }) : undefined}
      />

      <div className="flex flex-col gap-2">
        <h3 className="text-13 font-medium text-foreground">{t('studio.lessonVideo', { default: 'Lesson video' })}</h3>
        <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-background p-2.5">
          <span
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-lg',
              hasVideo ? 'bg-accent/15 text-accent' : 'bg-muted text-muted-foreground',
            )}
            aria-hidden
          >
            <Film className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-13 font-medium text-foreground">
              {hasVideo
                ? lesson.videoMeta?.filename || tMedia('videoUploaded', { default: 'Video uploaded' })
                : t('studio.inspectorNoVideo')}
            </p>
            {hasVideo && (lesson.videoMeta?.size || lesson.videoDuration) ? (
              <p className="text-xs tabular-nums text-muted-foreground">
                {[lesson.videoDuration ? formatDuration(lesson.videoDuration, t) : '', lesson.videoMeta ? formatBytes(lesson.videoMeta.size) : '']
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onOpenFull('media')}
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-border-strong bg-card px-3 text-xs font-medium text-foreground transition hover:bg-muted"
          >
            <Upload className="size-3.5" />
            {hasVideo ? t('studio.inspectorReplaceVideo') : t('studio.inspectorUploadVideo')}
          </button>
        </div>
      </div>

      <SwitchField
        label={t('studio.freePreview', { default: 'Free preview' })}
        description={t('studio.freePreviewHint', { default: 'Let unenrolled learners watch this lesson' })}
        checked={lesson.freePreview}
        onCheckedChange={(next) => onPatch(lesson.id, { freePreview: next })}
      />

      <div className="flex flex-col gap-2">
        <h3 className="text-13 font-medium text-foreground">{t('studio.lessonBlocks', { default: 'Lesson blocks' })}</h3>
        {blocks.length === 0 ? (
          <p className="text-13 text-muted-foreground">{t('studio.inspectorNoBlocks')}</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {(Object.keys(blockCounts) as LessonBlockType[]).map((type) => (
              <li key={type} className="rounded-full bg-muted px-2.5 py-1 text-xs text-foreground">
                {t(`studio.${BLOCK_LABEL[type]}`)} <span className="tabular-nums text-muted-foreground">× {blockCounts[type]}</span>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => {
            flush();
            onOpenFull('content');
          }}
          className="pressable mt-1 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90"
        >
          {t('studio.openFullEditor')}
          <ExternalLink className="size-4 rtl:-scale-x-100" aria-hidden />
        </button>
      </div>

      <footer className="flex flex-wrap items-center gap-1 border-t border-border/70 pt-3">
        <button
          type="button"
          onClick={onDuplicate}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-13 font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <Copy className="size-4" />
          {t('studio.duplicate', { default: 'Duplicate' })}
        </button>
        <button
          type="button"
          onClick={() => {
            if (!deleteArmed) {
              setDeleteArmed(true);
              return;
            }
            onDelete();
          }}
          onBlur={() => setDeleteArmed(false)}
          className={cn(
            'inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-13 font-medium transition',
            deleteArmed ? 'bg-destructive text-destructive-foreground' : 'text-destructive hover:bg-destructive/10',
          )}
        >
          <Trash2 className="size-4" />
          {deleteArmed ? t('studio.confirmDelete', { default: 'Confirm delete' }) : tCommon('delete', { default: 'Delete' })}
        </button>
      </footer>
    </section>
  );
}
