'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ProgramCardProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import { isInternalHref } from '@/lib/builder/href';
import type { BlockComponentProps } from './index';
import { Icon } from '@/components/ui/icon';

/** Level pill tones (top-left of the card media). */
const LEVEL_TONE: Record<string, string> = {
  primary: 'bg-card/90 text-primary ring-1 ring-inset ring-primary/20',
  secondary: 'bg-card/90 text-secondary ring-1 ring-inset ring-border',
  accent: 'bg-card/90 text-accent ring-1 ring-inset ring-accent/25',
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
export function ProgramCardBlock({ props, puck }: BlockComponentProps<ProgramCardProps>) {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [props.imageUrl]);
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
        'card-hover group flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xs',
        className,
      )}
      style={layoutStyle(props)}
    >
      <div>
        {/* Media */}
        <div className="relative h-52 w-full overflow-hidden bg-surface-container-low">
          {/* Intentional blueprint backdrop: visible if the remote image fails. */}
          <div className="absolute inset-0 blueprint-grid" aria-hidden="true"></div>
          {imageUrl && !imageFailed ? (
            <img
              src={imageUrl}
              alt={imageAlt || title}
              loading="lazy"
              decoding="async"
              onError={() => setImageFailed(true)}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-[1.04]"
            />
          ) : null}
          {puck?.isEditing && (!imageUrl || imageFailed) ? (
            <span className="absolute bottom-3 start-3 z-10 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-medium text-muted-foreground shadow-sm">
              {imageFailed ? 'Image failed' : 'Add image'}
            </span>
          ) : null}
          {level ? (
            <div className="absolute top-4 start-4">
              <span
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur-sm',
                  LEVEL_TONE[levelTone ?? 'primary'] ?? LEVEL_TONE.primary,
                )}
              >
                {level}
              </span>
            </div>
          ) : null}
          {duration ? (
            <div className="absolute bottom-3 end-3 rounded-full bg-card/90 px-2.5 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm tabular-nums">
              {duration}
            </div>
          ) : null}
        </div>
        {/* Body */}
        <div className="p-6">
          {metaLabel ? (
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              {metaIcon ? <Icon name={metaIcon} className="size-4 text-primary" /> : null}
              <span>{metaLabel}</span>
            </div>
          ) : null}
          <h3 className="mb-3 text-balance font-display text-xl font-medium leading-snug tracking-[-0.015em] text-foreground">
            {title}
          </h3>
          {description ? (
            <p className="mb-6 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
          {tagList.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tagList.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {/* Footer */}
      <div className="mx-6 mb-6 mt-2 flex items-center justify-between gap-3 border-t border-border/70 pt-4">
        <div className="flex items-center gap-2 min-w-0">
          {instructorInitials ? (
            <div
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium',
                TILE_TONE[levelTone ?? 'primary'] ?? TILE_TONE.primary,
              )}
            >
              {instructorInitials}
            </div>
          ) : null}
          {instructorName ? (
            <span className="truncate text-xs font-medium text-muted-foreground">
              Lead: {instructorName}
            </span>
          ) : null}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary">
          {ctaLabel}
          <Icon
            name="chevron_right"
            className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
          />
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
