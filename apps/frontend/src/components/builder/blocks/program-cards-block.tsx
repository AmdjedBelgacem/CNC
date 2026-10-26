import type { ProgramCardProps, ProgramCardsProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';
import { ProgramCardBlock } from './program-card-block';
import { useBuilderLivePreview } from '@/components/builder/live-preview-context';
import { useTranslations } from 'next-intl';
import { getImageSrc } from '@/lib/images';
import type { CourseListItem } from '@/lib/courses';

type Translate = ReturnType<typeof useTranslations>;

function courseLevel(
  difficulty: number,
  t: Translate,
): { level: string; levelTone: 'primary' | 'secondary' | 'accent' } {
  if (difficulty <= 1) return { level: t('levelBeginner'), levelTone: 'primary' };
  if (difficulty <= 3) return { level: t('levelIntermediate'), levelTone: 'secondary' };
  return { level: t('levelAdvanced'), levelTone: 'accent' };
}

function courseToCardProps(course: CourseListItem, t: Translate): ProgramCardProps {
  const { level, levelTone } = courseLevel(course.difficulty, t);
  const tags = course.metadata?.tags?.filter(Boolean).join(', ') || undefined;
  return {
    id: `course-card-${course.id}`,
    level,
    levelTone,
    duration: course.estimatedHours ? t('durationHours', { hours: course.estimatedHours }) : undefined,
    metaLabel: course.academy?.title || t('publishedCourse'),
    title: course.title,
    description: course.description || course.subtitle || undefined,
    tags,
    imageUrl: getImageSrc(course.thumbnailUrl, 'course'),
    imageAlt: course.title,
    ctaLabel: t('viewCourse'),
    href: `/courses/${course.slug}`,
  };
}

/** Section header row plus the program-card grid (mockup learning paths). */
export function ProgramCardsBlock({ props, puck }: BlockComponentProps<ProgramCardsProps>) {
  const {
    id,
    className,
    headerMarginBottom = 64,
    columnsLg = 'lg:grid-cols-3',
    cardsGap = 'gap-8',
  } = props;
  const t = useTranslations('ui.homeBuilder');
  const preview = useBuilderLivePreview();
  const editing = Boolean(puck?.isEditing);
  const live = editing ? preview : null;
  const noopPuck = { renderSlot: () => null, getSlotData: () => [] };

  return (
    <section
      id={id}
      className={cn('px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto', className)}
      style={layoutStyle(props)}
    >
      <div style={{ marginBottom: headerMarginBottom }}>{puck.renderSlot('header')}</div>
      <div className={cn('grid grid-cols-1', columnsLg, cardsGap)}>
        {live ? (
          live.loading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-[430px] animate-pulse rounded-2xl border border-border bg-surface-sunken"
                aria-hidden
              />
            ))
          ) : live.courses.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
              <p className="font-semibold text-foreground">No published courses</p>
              <p className="mt-1 text-sm text-muted-foreground">
                This section is hidden on the live site until a course is published.
              </p>
            </div>
          ) : (
            live.courses.map((course) => (
              <ProgramCardBlock
                key={course.id}
                props={courseToCardProps(course, t)}
                puck={noopPuck}
              />
            ))
          )
        ) : (
          puck.renderSlot('cards')
        )}
      </div>
    </section>
  );
}
