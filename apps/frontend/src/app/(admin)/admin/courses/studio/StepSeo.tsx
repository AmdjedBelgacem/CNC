'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link2, Loader2, Upload } from 'lucide-react';
import { AnimatePresence, m } from 'framer-motion';
import { BilingualField, EditorSection } from '@/components/admin/editor/editor-kit';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { CourseStudioData } from './types';
import { toast } from '@/components/ui/toast';
import { uploadFileToStorage } from '@/lib/upload';
import type { CopyTranslate } from './useCourseTranslate';

type SeoField = 'seoTitle' | 'seoDescription' | 'seoKeywords';

/**
 * Search and sharing: how the course reads in search results and link previews.
 *
 * Every field is an optional override that falls back to the course title and
 * description. English writes the course columns, Arabic `translations.ar`.
 */
export function StepLocalization({
  course,
  update,
  translate,
}: {
  course: CourseStudioData;
  update: (patch: Partial<CourseStudioData>) => void;
  translate: CopyTranslate;
}) {
  const [ogUploading, setOgUploading] = useState(false);
  const [ogDrag, setOgDrag] = useState(false);
  const t = useTranslations('courses');
  const tMedia = useTranslations('media');
  const inputRef = useRef<HTMLInputElement>(null);
  const ar = course.translations?.ar ?? {};
  const seoDescription = course.seoDescription ?? '';

  const setEnglish = (field: SeoField, value: string) => update({ [field]: value || null });
  const setArabic = (field: SeoField, value: string) => {
    const current = course.translations?.ar ?? {};
    update({
      translations: {
        ...(course.translations ?? {}),
        ar: { ...current, [field]: value || null },
      },
    });
  };
  const draft = () => void translate.run('missing');

  const handleOgFile = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({
        type: 'err',
        title: tMedia('notAnImage', { default: 'Not an image' }),
        description: tMedia('chooseImageFile', { default: 'Please choose an image file.' }),
      });
      return;
    }
    setOgUploading(true);
    try {
      const result = await uploadFileToStorage(file, 'og');
      update({ ogImageUrl: result.url });
      toast({ type: 'ok', title: tMedia('imageUploaded', { default: 'Image uploaded' }) });
    } catch (error) {
      toast({
        type: 'err',
        title: tMedia('uploadFailed', { default: 'Upload failed' }),
        description: error instanceof Error ? error.message : tMedia('tryAgain', { default: 'Please try again.' }),
      });
    } finally {
      setOgUploading(false);
    }
  };

  return (
    <>
      <EditorSection
        id="localization"
        title={t('studio.searchSection', { default: 'Search appearance' })}
        hint={t('studio.optional', { default: 'Optional' })}
      >
        <p className="-mt-3 text-13 leading-relaxed text-muted-foreground">
          {t('studio.searchSectionDesc', {
            default: 'Optional overrides. Anything left blank falls back to the course title and description.',
          })}
        </p>
        <BilingualField
          id="course-seo-title"
          label={t('studio.seoTitle', { default: 'SEO title' })}
          en={{
            value: course.seoTitle ?? '',
            onChange: (value) => setEnglish('seoTitle', value),
            placeholder: t('studio.seoTitlePlaceholder', { default: 'Appears in search results and browser tabs' }),
          }}
          ar={{ value: ar.seoTitle ?? '', onChange: (value) => setArabic('seoTitle', value) }}
          onDraftArabic={draft}
          drafting={translate.busy}
        />
        <BilingualField
          id="course-seo-description"
          label={t('studio.seoDescription', { default: 'SEO description' })}
          multiline
          rows={3}
          en={{
            value: seoDescription,
            onChange: (value) => setEnglish('seoDescription', value),
            placeholder: t('studio.seoDescriptionPlaceholder', { default: 'A concise summary for search engines' }),
          }}
          ar={{ value: ar.seoDescription ?? '', onChange: (value) => setArabic('seoDescription', value) }}
          onDraftArabic={draft}
          drafting={translate.busy}
          error={
            seoDescription.length > 160
              ? t('studio.seoTooLong', {
                  count: seoDescription.length - 160,
                  default: '{count} characters over the 160-character limit. Search engines will truncate it.',
                })
              : undefined
          }
          hint={t('studio.seoDescHint', { count: seoDescription.length, default: '{count} of 160 characters used.' })}
        />
        <BilingualField
          id="course-seo-keywords"
          label={t('studio.keywords', { default: 'Keywords' })}
          en={{
            value: course.seoKeywords ?? '',
            onChange: (value) => setEnglish('seoKeywords', value),
            placeholder: t('studio.keywordsPlaceholder', { default: 'cnc, machining, manufacturing' }),
          }}
          ar={{ value: ar.seoKeywords ?? '', onChange: (value) => setArabic('seoKeywords', value) }}
          onDraftArabic={draft}
          drafting={translate.busy}
        />
        <p className="flex min-w-0 flex-wrap items-center gap-2 text-13 text-muted-foreground">
          <Link2 className="size-4 shrink-0 text-primary" aria-hidden />
          {t('studio.finalUrl', { default: 'Final URL' })}
          <bdi dir="ltr" className="min-w-0 break-all font-mono text-foreground">
            /courses/{course.slug || 'slug'}
          </bdi>
        </p>
      </EditorSection>

      <EditorSection
        id="social"
        title={t('studio.socialSection', { default: 'Social preview' })}
        hint={t('studio.optional', { default: 'Optional' })}
      >
        <p className="-mt-3 text-13 leading-relaxed text-muted-foreground">
          {t('studio.socialSectionDesc', { default: 'Shown when the course link is pasted into social apps and chat.' })}
        </p>
        <div className="space-y-1.5">
          <span id="studio-og-label" className="text-13 font-medium text-foreground">
            {t('studio.ogImage', { default: 'Social preview image (OG)' })}
          </span>
          <button
            type="button"
            aria-describedby="studio-og-label"
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setOgDrag(true);
            }}
            onDragLeave={() => setOgDrag(false)}
            onDrop={(event) => {
              event.preventDefault();
              setOgDrag(false);
              void handleOgFile(event.dataTransfer.files?.[0]);
            }}
            className={cn(
              'flex min-h-24 w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-4 py-7 text-center text-xs transition-colors',
              ogDrag ? 'border-primary/60 bg-primary/5' : 'border-border bg-muted/20 hover:border-border-strong hover:bg-muted/40',
            )}
          >
            {ogUploading ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="size-4 text-muted-foreground/70" />
            )}
            <span className="font-sans text-muted-foreground">
              {ogDrag
                ? tMedia('dropToUpload', { default: 'Drop to upload' })
                : tMedia('dropImageHint', { default: 'Drag & drop an image, or click to upload' })}
            </span>
          </button>
          <input
            ref={inputRef}
            id="studio-og-image"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              void handleOgFile(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <AnimatePresence initial={false}>
            {course.ogImageUrl && (
              <m.div
                key="og"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                transition={spring.smooth}
                className="mt-3 flex flex-wrap items-center justify-between gap-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={course.ogImageUrl}
                  alt=""
                  className="aspect-[1.91/1] w-full max-w-60 rounded-lg border border-border/70 object-cover shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => update({ ogImageUrl: null })}
                  className="inline-flex min-h-10 shrink-0 items-center rounded-md px-3 font-sans text-xs font-medium text-destructive transition hover:bg-destructive/10"
                >
                  {tMedia('remove', { default: 'Remove' })}
                </button>
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </EditorSection>
    </>
  );
}

export const StepSeo = StepLocalization;
