'use client';

import { useEffect, useState } from 'react';
import { isSampleTestimonial, type TestimonialCardProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';
import { Icon } from '@/components/ui/icon';

/** Review card: star rating, italic quote, reviewer identity row. */
export function TestimonialCardBlock({ props, puck }: BlockComponentProps<TestimonialCardProps>) {
  const { className, quote = '', name = '', role, avatarUrl, rating = 5 } = props;
  const stars = Math.max(0, Math.min(5, rating ?? 5));
  const [avatarFailed, setAvatarFailed] = useState(false);
  useEffect(() => setAvatarFailed(false), [avatarUrl]);
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?';
  return (
    <figure
      className={cn(
        'card-hover relative flex h-full flex-col justify-between gap-6 rounded-2xl border border-border/70 bg-card p-8 shadow-xs',
        className,
      )}
      style={layoutStyle(props)}
    >
      {puck?.isEditing && isSampleTestimonial(quote) && (
        // Sample quotes never reach visitors; say so here so the canvas is not mistaken for
        // what the live page shows.
        <span className="absolute end-3 top-3 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
          Sample · hidden on the live site
        </span>
      )}
      <div>
        {stars > 0 ? (
          <div className="flex items-center gap-1 text-warning mb-4" aria-label={`${stars} out of 5 stars`}>
            {Array.from({ length: stars }).map((_, i) => (
              <Icon key={i} name="star" className="size-4 fill-current" />
            ))}
          </div>
        ) : null}
        <blockquote className="font-display text-lg leading-relaxed text-foreground/90">
          &ldquo;{quote}&rdquo;
        </blockquote>
      </div>
      <figcaption className="flex items-center gap-4 border-t border-border/70 pt-5">
        <div className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-medium text-primary ring-1 ring-border/70">
          <span aria-hidden="true">{initials}</span>
          {avatarUrl && !avatarFailed ? (
            <img
              src={avatarUrl}
              alt={name}
              loading="lazy"
              decoding="async"
              onError={() => setAvatarFailed(true)}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : null}
        </div>
        <div className="min-w-0">
          <div className="font-medium text-foreground">{name}</div>
          {role ? <div className="text-xs text-muted-foreground mt-0.5">{role}</div> : null}
        </div>
      </figcaption>
    </figure>
  );
}
