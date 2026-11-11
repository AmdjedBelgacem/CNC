'use client';

import { useTranslations } from 'next-intl';
import { ImageOff } from 'lucide-react';
import { AnimatedNumber } from '@/components/ui/motion';
import { StatusPill } from '@/components/admin/admin-ui';
import { difficultyKey, difficultyTone, difficultyFallback } from '@/lib/difficulty';
import type { CourseStudioData } from './types';

/**
 * The course as a catalog card, for the editor's aside.
 *
 * The title gets a full-width line of its own and wraps instead of clipping: it
 * is the thing an editor most needs to read. `arabic` shows the card as an
 * Arabic visitor sees it, falling back to English where there is no Arabic yet.
 */
export function CourseCardPreview({ course, arabic = false }: { course: CourseStudioData; arabic?: boolean }) {
  const t = useTranslations('courses.studio.summary');
  const tDifficulty = useTranslations('admin');

  const totalLessons = course.series.reduce((count, section) => count + section.lessons.length, 0);
  const freePreviews = course.series.reduce(
    (count, section) => count + section.lessons.filter((lesson) => lesson.freePreview).length,
    0,
  );
  const ar = course.translations?.ar;
  const title = (arabic && ar?.title?.trim()) || course.title;
  const subtitle = (arabic && ar?.subtitle?.trim()) || course.subtitle;

  const price =
    course.accessMode === 'paid' && course.priceCents != null
      ? new Intl.NumberFormat(undefined, { style: 'currency', currency: course.currency || 'SAR' }).format(
          course.priceCents / 100,
        )
      : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-xl border border-border/70">
        {course.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={course.thumbnailUrl} alt="" className="aspect-video w-full object-cover" />
        ) : (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-1.5 bg-muted/50">
            <ImageOff className="size-5 text-muted-foreground/70" />
            <span className="text-2xs font-medium text-muted-foreground">{t('noImage', { default: 'No thumbnail yet' })}</span>
          </div>
        )}
        <div className="space-y-1.5 px-3.5 py-3" dir={arabic ? 'rtl' : undefined} lang={arabic ? 'ar' : undefined}>
          <p className="text-balance font-display text-lg font-medium leading-snug tracking-[-0.015em] text-foreground">
            {title || t('untitled', { default: 'Untitled course' })}
          </p>
          {subtitle && <p className="line-clamp-2 text-13 text-muted-foreground">{subtitle}</p>}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <StatusPill
              label={tDifficulty(difficultyKey(course.difficulty), { default: difficultyFallback(course.difficulty) })}
              tone={difficultyTone(course.difficulty)}
              dot={false}
            />
            <StatusPill label={t(`accessMode.${course.accessMode}`, { default: course.accessMode })} tone="blue" dot={false} />
            {price && <StatusPill label={price} tone="emerald" dot={false} />}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 divide-x divide-border/70 rounded-lg bg-muted/40 py-2.5 text-center rtl:divide-x-reverse">
        <div>
          <p className="font-display text-lg font-medium tabular-nums text-foreground">
            <AnimatedNumber value={course.series.length} animateOnChange durationSeconds={0.6} />
          </p>
          <p className="text-2xs text-muted-foreground">{t('sections', { default: 'Sections' })}</p>
        </div>
        <div>
          <p className="font-display text-lg font-medium tabular-nums text-foreground">
            <AnimatedNumber value={totalLessons} animateOnChange durationSeconds={0.6} />
          </p>
          <p className="text-2xs text-muted-foreground">{t('lessons', { default: 'Lessons' })}</p>
        </div>
        <div>
          <p className="font-display text-lg font-medium tabular-nums text-foreground">
            <AnimatedNumber value={freePreviews} animateOnChange durationSeconds={0.6} />
          </p>
          <p className="text-2xs text-muted-foreground">{t('previews', { default: 'Previews' })}</p>
        </div>
      </div>
    </div>
  );
}
