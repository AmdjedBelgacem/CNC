import Link from 'next/link';
import type { ProgramCardProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import { isInternalHref } from '@/lib/builder/href';
import type { BlockComponentProps } from './index';
import { Icon } from '@/components/ui/icon';

/** Level pill tones (top-left of the card media). */
const LEVEL_TONE: Record<string, string> = {
  primary: 'bg-primary text-on-primary',
  secondary: 'bg-secondary text-secondary-foreground',
  accent: 'bg-accent text-accent-foreground',
};

/** Instructor initials tile tones follow the level tone. */
const TILE_TONE: Record<string, string> = {
  primary: 'bg-primary/10 text-primary',
  secondary: 'bg-secondary/10 text-secondary',
  accent: 'bg-accent/10 text-accent',
};

/**
 * Program/course card (mockup learning-paths grid): media with level pill and
 * duration chip, meta row, title, description, mono tag chips, and an
 * instructor + syllabus footer row.
 */
export function ProgramCardBlock({ props }: BlockComponentProps<ProgramCardProps>) {
  const {
    className,
    imageUrl,
    imageAlt = '',
    level,
    levelTone = 'primary',
    duration,
    metaIcon,
    metaLabel,
    title = '',
    description,
    tags,
    instructorInitials,
    instructorName,
    ctaLabel = 'View Syllabus',
    href,
  } = props;
  const tagList = (tags ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const card = (
    <article
      className={cn(
        'liquid-glass rounded-2xl overflow-hidden flex flex-col justify-between hover:shadow-xl transition-all duration-300 group h-full',
        className,
      )}
      style={layoutStyle(props)}
    >
      <div>
        {/* Media */}
        <div className="relative h-56 w-full overflow-hidden bg-surface-container-low">
          {/* Intentional blueprint backdrop: visible if the remote image fails. */}
          <div className="absolute inset-0 blueprint-grid" aria-hidden="true"></div>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={imageAlt || title}
              loading="lazy"
              decoding="async"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : null}
          {level ? (
            <div className="absolute top-4 start-4">
              <span
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-bold shadow-md',
                  LEVEL_TONE[levelTone ?? 'primary'],
                )}
              >
                {level}
              </span>
            </div>
          ) : null}
          {duration ? (
            <div className="absolute bottom-3 end-3 bg-overlay/85 backdrop-blur-md text-white text-xs px-2.5 py-1 rounded font-mono">
              {duration}
            </div>
          ) : null}
        </div>
        {/* Body */}
        <div className="p-6">
          {metaLabel ? (
            <div className="flex items-center gap-2 text-xs font-semibold text-text-muted mb-2">
              {metaIcon ? <Icon name={metaIcon} className="size-4 text-primary" /> : null}
              <span>{metaLabel}</span>
            </div>
          ) : null}
          <h3 className="font-headline-md text-xl font-bold text-text-primary mb-3 leading-snug">
            {title}
          </h3>
          {description ? (
            <p className="text-text-secondary text-sm leading-relaxed mb-6">{description}</p>
          ) : null}
          {tagList.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tagList.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded bg-surface-container-low text-text-secondary text-xs font-mono"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {/* Footer */}
      <div className="mx-6 mb-6 mt-2 pt-4 border-t border-glass-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {instructorInitials ? (
            <div
              className={cn(
                'size-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0',
                TILE_TONE[levelTone ?? 'primary'],
              )}
            >
              {instructorInitials}
            </div>
          ) : null}
          {instructorName ? (
            <span className="text-xs font-medium text-text-muted truncate">
              Lead: {instructorName}
            </span>
          ) : null}
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-bold text-primary shrink-0 group-hover:underline">
          {ctaLabel}
          <Icon name="chevron_right" className="size-4" />
        </span>
      </div>
    </article>
  );
  if (href && isInternalHref(href)) {
    return (
      <Link href={href} className="block h-full">
        {card}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className="block h-full">
        {card}
      </a>
    );
  }
  return card;
}
