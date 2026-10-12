'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  harvestLessonBlocks,
  toFieldMap,
  applyBlockTranslations,
  LESSON_FIELDS,
  SERIES_FIELDS,
  type HarvestedField,
  type TranslationCoverage,
} from '@titan/shared';
import {
  TranslateAction,
  TranslationCoveragePanel,
  TranslationReviewDialog,
  buildReviewItems,
  useTranslateDraft,
  type TranslateGroup,
} from '@/components/admin/translation';
import type { Lesson, Section } from './types';

/**
 * Translate every section and lesson in a course from one place.
 *
 * The alternative — a button per lesson inside the drawer — is how a twelve-lesson course ends up
 * with three translated lessons and nine English ones nobody notices, because the only signal that
 * anything was missing is opening each drawer in turn. Here coverage is aggregated for the whole
 * course, and one pass fills every gap.
 */

export interface CourseLessonsTranslationProps {
  sections: Section[];
  /** Replaces the matching lesson in the studio draft. */
  onUpdateLesson: (id: string, patch: Partial<Lesson>) => void;
  onUpdateSection: (id: string, patch: Partial<Section>) => void;
}

interface Harvested {
  sections: Array<{ id: string; fields: Record<string, string> }>;
  lessons: Array<{ lesson: Lesson; fields: HarvestedField[] }>;
}

function harvestCourse(sections: Section[]): Harvested {
  return {
    sections: sections
      .map((section) => ({
        id: section.id,
        fields: {
          'Section title': section.title ?? '',
          'Section description': section.description ?? '',
        },
      }))
      .filter((entry) => Object.values(entry.fields).some((value) => value.trim())),
    lessons: sections
      .flatMap((section) => section.lessons ?? [])
      .map((lesson) => ({
        lesson,
        fields: harvestLessonBlocks(lesson.contentBlocks?.blocks),
      }))
      .filter((entry) => entry.fields.length > 0 || entry.lesson.title),
  };
}

export function CourseLessonsTranslation({
  sections,
  onUpdateLesson,
  onUpdateSection,
}: CourseLessonsTranslationProps) {
  const t = useTranslations('admin.translate');
  const [reviewKey, setReviewKey] = useState<string | null>(null);
  const tLessons = useTranslations('courses');

  const harvested = useMemo(() => harvestCourse(sections), [sections]);

  const groups = useMemo<TranslateGroup[]>(() => {
    const out: TranslateGroup[] = [];
    for (const section of harvested.sections) {
      out.push({ key: `section:${section.id}`, fields: section.fields });
    }
    for (const entry of harvested.lessons) {
      const fields: Record<string, string> = {
        'Lesson title': entry.lesson.title ?? '',
        'Lesson description': entry.lesson.description ?? '',
      };
      Object.assign(fields, toFieldMap(entry.fields));
      out.push({ key: `lesson:${entry.lesson.id}`, fields });
    }
    return out;
  }, [harvested]);

  const { busy, run } = useTranslateDraft({
    entity: 'course lessons',
    groups,
    onApply: (groupKey, translations) => {
      if (groupKey.startsWith('section:')) {
        const id = groupKey.slice('section:'.length);
        const current = sections.find((s) => s.id === id);
        onUpdateSection(id, {
          translations: {
            ...(current?.translations ?? {}),
            ar: {
              ...(current?.translations?.ar ?? {}),
              title: translations['Section title'] ?? current?.translations?.ar?.title,
              description: translations['Section description'] ?? current?.translations?.ar?.description,
            },
          },
        });
        return;
      }

      const lessonId = groupKey.slice('lesson:'.length);
      const entry = harvested.lessons.find((e) => e.lesson.id === lessonId);
      if (!entry) return;
      const lesson = entry.lesson;
      const blocks = lesson.contentBlocks?.blocks;
      onUpdateLesson(lessonId, {
        translations: {
          ...(lesson.translations ?? {}),
          ar: {
            ...(lesson.translations?.ar ?? {}),
            title: translations['Lesson title'] ?? lesson.translations?.ar?.title,
            description:
              translations['Lesson description'] ??
              lesson.translations?.ar?.description ??
              undefined,
          },
        },
        // Only touch blocks when there are any; a lesson with none must not gain an empty document.
        ...(blocks && blocks.length > 0
          ? {
              contentBlocks: {
                schemaVersion: 1,
                blocks: blocks.map((block) => {
                  const blockFields = entry.fields.filter((field) => field.key.startsWith(`${block.id}:`));
                  if (blockFields.length === 0) return block;
                  // Strip the `blockId:` prefix the model was given, so paths match the block content.
                  const stripped: HarvestedField[] = blockFields.map((field) => ({
                    ...field,
                    key: field.key.slice(block.id.length + 1),
                  }));
                  return {
                    ...block,
                    content: applyBlockTranslations(block.content, stripped, translations),
                  };
                }),
              },
            }
          : {}),
      });
    },
    confirmOverwrite: () => window.confirm(t('overwriteConfirm')),
  });

  /**
   * Coverage is counted per lesson and section rather than across the course, because that is the
   * unit an editor reviews. A single course-wide "47/112" number says nothing about whether the
   * lesson someone is looking at is finished.
   */
  const coverage = useMemo<TranslationCoverage>(() => {
    const missing: string[] = [];
    const present: string[] = [];
    for (const section of harvested.sections) {
      const current = sections.find((s) => s.id === section.id)?.translations?.ar;
      for (const item of buildReviewItems(
        { title: section.fields['Section title'], description: section.fields['Section description'] },
        current,
        SERIES_FIELDS,
      )) {
        (item.translation ? present : missing).push(item.label);
      }
    }
    for (const entry of harvested.lessons) {
      for (const item of buildReviewItems(
        { title: entry.lesson.title, description: entry.lesson.description ?? '' },
        entry.lesson.translations?.ar,
        LESSON_FIELDS,
      )) {
        (item.translation ? present : missing).push(item.label);
      }
    }
    return { total: present.length + missing.length, translated: present.length, missing, present };
  }, [harvested, sections]);

  const reviewEntry = reviewKey?.startsWith('lesson:')
    ? harvested.lessons.find((e) => e.lesson.id === reviewKey.slice('lesson:'.length))
    : undefined;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{tLessons('studio.lessonsTranslation', { default: 'Lessons and content' })}</h3>
          <p className="text-xs text-muted-foreground">
            {tLessons('studio.lessonsTranslationHint', {
              default: 'Fills Arabic for every section, lesson and content block in one pass.',
            })}
          </p>
        </div>
        <TranslateAction coverage={coverage} busy={busy} onTranslate={(scope) => void run(scope)} />
      </div>
      <TranslationCoveragePanel coverage={coverage} />
      {reviewEntry && (
        <TranslationReviewDialog
          open={Boolean(reviewKey)}
          onOpenChange={(open) => setReviewKey(open ? reviewKey : null)}
          entityLabel={reviewEntry.lesson.title}
          items={buildReviewItems(
            { title: reviewEntry.lesson.title, description: reviewEntry.lesson.description ?? '' },
            reviewEntry.lesson.translations?.ar,
            LESSON_FIELDS,
          )}
        />
      )}
    </div>
  );
}
