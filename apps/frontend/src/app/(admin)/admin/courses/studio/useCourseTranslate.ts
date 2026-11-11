'use client';

import { useTranslations } from 'next-intl';
import { COURSE_BASICS_FIELDS, COURSE_SEO_FIELDS } from '@titan/shared';
import { useTranslateDraft, type TranslateScope } from '@/components/admin/translation';
import type { CourseStudioData } from './types';

type Update = (patch: Partial<CourseStudioData>) => void;

export interface CopyTranslate {
  busy: boolean;
  run: (scope?: TranslateScope) => Promise<unknown>;
  coverage: ReturnType<ReturnType<typeof useTranslateDraft>['coverageFor']>;
}

/**
 * The AI "draft from English" passes for the course's own copy: the basics
 * (title, subtitle, description) and the search fields.
 *
 * They live in one place so the Basics and Search steps, the Arabic step and the
 * publish sheet all share them. `latest` reads the course at apply time rather
 * than at render time: when both passes run back to back, the second must merge
 * into what the first wrote, not into the course as it was before either ran.
 */
export function useCourseCopyTranslate(
  course: CourseStudioData | null,
  update: Update,
  latest: () => CourseStudioData | null,
): { basics: CopyTranslate; seo: CopyTranslate } {
  const tTranslate = useTranslations('admin.translate');
  const confirmOverwrite = () => window.confirm(tTranslate('overwriteConfirm'));

  const basics = useTranslateDraft({
    entity: 'course copy',
    descriptors: COURSE_BASICS_FIELDS,
    groups: [
      {
        key: 'course',
        fields: {
          Title: course?.title ?? '',
          Subtitle: course?.subtitle ?? '',
          Description: course?.description ?? '',
        },
      },
    ],
    onApply: (_key, translations) => {
      const current = latest();
      if (!current) return;
      const ar = current.translations?.ar ?? {};
      // `?? ar.x` rather than `?? english`: a field the model skipped keeps the Arabic an
      // editor already reviewed instead of being reset to English.
      update({
        translations: {
          ...(current.translations ?? {}),
          ar: {
            ...ar,
            title: translations.Title ?? ar.title ?? '',
            subtitle: translations.Subtitle ?? ar.subtitle ?? '',
            description: translations.Description ?? ar.description ?? '',
          },
        },
      });
    },
    confirmOverwrite,
  });

  const seo = useTranslateDraft({
    entity: 'course SEO metadata',
    descriptors: COURSE_SEO_FIELDS,
    groups: [
      {
        key: 'seo',
        fields: {
          'SEO title': course?.seoTitle ?? '',
          'SEO description': course?.seoDescription ?? '',
          'SEO keywords': course?.seoKeywords ?? '',
        },
      },
    ],
    onApply: (_key, translations) => {
      const current = latest();
      if (!current) return;
      const ar = current.translations?.ar ?? {};
      update({
        translations: {
          ...(current.translations ?? {}),
          ar: {
            ...ar,
            seoTitle: translations['SEO title'] ?? ar.seoTitle ?? null,
            seoDescription: translations['SEO description'] ?? ar.seoDescription ?? null,
            seoKeywords: translations['SEO keywords'] ?? ar.seoKeywords ?? null,
          },
        },
      });
    },
    confirmOverwrite,
  });

  return {
    basics: {
      busy: basics.busy,
      run: basics.run,
      coverage: course ? basics.coverageFor(course, course.translations?.ar) : null,
    },
    seo: {
      busy: seo.busy,
      run: seo.run,
      coverage: course ? seo.coverageFor(course, course.translations?.ar) : null,
    },
  };
}
