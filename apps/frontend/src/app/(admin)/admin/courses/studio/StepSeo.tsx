'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Languages, Link2, Loader2, Search, Share2, Upload } from 'lucide-react';
import type { ContentLocale } from '@titan/shared';
import { FormSection, TextField, TextAreaField } from '@/components/admin/admin-form';
import type { CourseStudioData } from './types';
import * as api from './api';
import { toast } from '@/components/ui/toast';

function readFileAsDataUrl(file: File, errorMessage = 'Could not read file'): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(errorMessage));
    reader.readAsDataURL(file);
  });
}

function valueFor(course: CourseStudioData, locale: ContentLocale, field: 'seoTitle' | 'seoDescription' | 'seoKeywords') {
  if (locale === 'en') return course[field] ?? '';
  return course.translations?.[locale]?.[field] ?? '';
}

export function StepLocalization({
  course,
  update,
  locale,
}: {
  course: CourseStudioData;
  update: (patch: Partial<CourseStudioData>) => void;
  locale: ContentLocale;
}) {
  const [ogUploading, setOgUploading] = useState(false);
  const [ogDrag, setOgDrag] = useState(false);
  const t = useTranslations('courses');
  const tMedia = useTranslations('media');
  const inputRef = useRef<HTMLInputElement>(null);
  const seoTitle = valueFor(course, locale, 'seoTitle');
  const seoDescription = valueFor(course, locale, 'seoDescription');
  const seoKeywords = valueFor(course, locale, 'seoKeywords');

  const updateLocalized = (field: 'seoTitle' | 'seoDescription' | 'seoKeywords', value: string) => {
    if (locale === 'en') {
      update({ [field]: value || null });
      return;
    }
    const current = course.translations?.[locale] ?? {};
    update({
      translations: {
        ...(course.translations ?? {}),
        [locale]: { ...current, [field]: value || null },
      },
    });
  };

  const handleOgFile = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ type: 'err', title: tMedia('notAnImage', { default: 'Not an image' }), description: tMedia('chooseImageFile', { default: 'Please choose an image file.' }) });
      return;
    }
    setOgUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file, tMedia('couldNotReadFile', { default: 'Could not read file' }));
      const result = await api.uploadFile(dataUrl, 'og', file.name);
      update({ ogImageUrl: result.url });
      toast({ type: 'ok', title: tMedia('imageUploaded', { default: 'Image uploaded' }) });
    } catch (error) {
      toast({ type: 'err', title: tMedia('uploadFailed', { default: 'Upload failed' }), description: error instanceof Error ? error.message : tMedia('tryAgain', { default: 'Please try again.' }) });
    } finally {
      setOgUploading(false);
    }
  };

  return (
    <div className="space-y-6" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">{t('studio.languageAvailability', { default: 'Language availability' })}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('studio.localeFieldsHint', { default: 'Public responses include the resolved locale and any fallback fields.' })}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['en', 'ar'] as ContentLocale[]).map((item) => {
              const available = item === 'en' || Boolean(course.translations?.[item] && Object.keys(course.translations[item] ?? {}).length);
              const active = item === locale;
              return (
                <span key={item} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${active ? 'border-primary bg-primary/10 text-primary' : available ? 'border-success/30 bg-success/10 text-success' : 'border-border bg-muted text-muted-foreground'}`}>
                  {available && <Check className="size-3.5" />}
                  {item === 'ar' ? 'العربية' : 'English'}
                  {!available && t('studio.fallbackSuffix', { default: ' · fallback' })}
                </span>
              );
            })}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
          <Languages className="size-4 text-primary" />
          {locale === 'ar' ? t('studio.arabicFieldsNote', { default: 'Arabic fields are saved as translations; empty fields fall back to English.' }) : t('studio.englishFieldsNote', { default: 'English is the source language. Use the header toggle to edit Arabic.' })}
        </div>
      </div>

      <FormSection
        title={t('studio.searchSection', { default: 'Search appearance' })}
        icon={Search}
        description={t('studio.searchSectionDesc', {
          default: 'Optional overrides. Anything left blank falls back to the course title and description.',
        })}
      >
        <div className="space-y-4">
          <TextField
            label={t('studio.seoTitle', { default: 'SEO title' })}
            dir="auto"
            value={seoTitle}
            onChange={(event) => updateLocalized('seoTitle', event.target.value)}
            placeholder={t('studio.seoTitlePlaceholder', { default: 'Appears in search results and browser tabs' })}
          />
          <TextAreaField
            label={t('studio.seoDescription', { default: 'SEO description' })}
            dir="auto"
            rows={3}
            value={seoDescription}
            onChange={(event) => updateLocalized('seoDescription', event.target.value)}
            placeholder={t('studio.seoDescriptionPlaceholder', { default: 'A concise summary for search engines' })}
            error={
              seoDescription.length > 160
                ? t('studio.seoTooLong', {
                    count: seoDescription.length - 160,
                    default: '{count} characters over the 160-character limit. Search engines will truncate it.',
                  })
                : undefined
            }
            hint={t('studio.seoDescHint', {
              count: seoDescription.length,
              default: '{count} of 160 characters used.',
            })}
          />
          <TextField
            label={t('studio.keywords', { default: 'Keywords' })}
            dir="auto"
            value={seoKeywords}
            onChange={(event) => updateLocalized('seoKeywords', event.target.value)}
            placeholder={t('studio.keywordsPlaceholder', { default: 'cnc, machining, manufacturing' })}
          />
        </div>
      </FormSection>

      <FormSection
        title={t('studio.socialSection', { default: 'Social preview' })}
        icon={Share2}
        description={t('studio.socialSectionDesc', {
          default: 'Shown when the course link is pasted into social apps and chat.',
        })}
      >
      <div className="space-y-1.5">
        <span className="text-xs font-semibold text-foreground">{t('studio.ogImage', { default: 'Social preview image (OG)' })}</span>
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => { event.preventDefault(); setOgDrag(true); }}
          onDragLeave={() => setOgDrag(false)}
          onDrop={(event) => { event.preventDefault(); setOgDrag(false); void handleOgFile(event.dataTransfer.files?.[0]); }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-4 py-5 text-center text-xs transition ${ogDrag ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/50'}`}
        >
          {ogUploading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : <Upload className="size-4 text-muted-foreground/70" />}
          <p className="font-sans text-muted-foreground">{ogDrag ? tMedia('dropToUpload', { default: 'Drop to upload' }) : tMedia('dropImageHint', { default: 'Drag & drop an image, or click to upload' })}</p>
        </div>
        <input ref={inputRef} id="studio-og-image" type="file" accept="image/*" className="hidden" onChange={(event) => { void handleOgFile(event.target.files?.[0]); event.target.value = ''; }} />
        {course.ogImageUrl && (
          <div className="mt-3 flex items-center justify-between gap-2">
            <img src={course.ogImageUrl} alt="" className="h-28 w-44 rounded-xl object-cover shadow-sm" />
            <button type="button" onClick={() => update({ ogImageUrl: null })} className="shrink-0 rounded-md px-2.5 py-1 font-sans text-xs font-medium text-destructive transition hover:bg-destructive/10">{tMedia('remove', { default: 'Remove' })}</button>
          </div>
        )}
      </div>
      </FormSection>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-xs">
        <Link2 className="size-4 shrink-0 text-primary" />
        {t('studio.finalUrl', { default: 'Final URL' })}
        <bdi dir="ltr" className="font-mono text-foreground">
          /courses/{course.slug || 'slug'}
        </bdi>
      </div>
    </div>
  );
}

export const StepSeo = StepLocalization;
