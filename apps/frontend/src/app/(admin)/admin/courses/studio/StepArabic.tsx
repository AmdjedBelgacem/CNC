'use client';

import { useTranslations } from 'next-intl';
import { EditorSection } from '@/components/admin/editor/editor-kit';
import { TranslateAction, TranslationCoveragePanel } from '@/components/admin/translation';
import { CourseLessonsTranslation, type CourseLessonsTranslationProps } from './CourseLessonsTranslation';
import { arabicCoverage } from './completeness';
import type { CourseStudioData } from './types';
import type { CopyTranslate } from './useCourseTranslate';

/**
 * Where the Arabic stands for the whole course, and the passes that fill it.
 *
 * The fields themselves are edited inline next to their English (Basics, Search
 * and sharing, the lesson inspector); this section is the overview and the bulk
 * "draft from English" for each part of the course.
 */
export function StepArabic({
  course,
  basics,
  seo,
  onUpdateLesson,
  onUpdateSection,
}: {
  course: CourseStudioData;
  basics: CopyTranslate;
  seo: CopyTranslate;
  onUpdateLesson: CourseLessonsTranslationProps['onUpdateLesson'];
  onUpdateSection: CourseLessonsTranslationProps['onUpdateSection'];
}) {
  const t = useTranslations('courses');
  const coverage = arabicCoverage(course);
  const pct = coverage.total ? Math.round((coverage.translated / coverage.total) * 100) : 100;

  const parts: { key: string; title: string; translate: CopyTranslate }[] = [
    { key: 'basics', title: t('studio.basicsSection', { default: 'Identity' }), translate: basics },
    { key: 'seo', title: t('studio.searchSection', { default: 'Search appearance' }), translate: seo },
  ];

  return (
    <EditorSection
      id="arabic"
      title={t('studio.arabicSection')}
      hint={t('studio.arabicCoverageValue', { pct })}
    >
      <p className="-mt-3 text-13 leading-relaxed text-muted-foreground">
        {t('studio.arabicFieldsNote', {
          default: 'Arabic fields are saved as translations; empty fields fall back to English.',
        })}
      </p>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={t('studio.arabicSection')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      {parts.map((part) => (
        <div key={part.key} className="space-y-3 rounded-xl border border-border/70 bg-muted/30 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-base font-medium tracking-[-0.015em] text-foreground">{part.title}</h3>
            {part.translate.coverage && (
              <TranslateAction
                coverage={part.translate.coverage}
                busy={part.translate.busy}
                onTranslate={(scope) => void part.translate.run(scope)}
              />
            )}
          </div>
          {part.translate.coverage && <TranslationCoveragePanel coverage={part.translate.coverage} />}
        </div>
      ))}
      <CourseLessonsTranslation
        sections={course.series}
        onUpdateLesson={onUpdateLesson}
        onUpdateSection={onUpdateSection}
      />
    </EditorSection>
  );
}
