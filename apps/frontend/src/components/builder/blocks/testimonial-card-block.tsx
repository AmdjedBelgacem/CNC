'use client';

import { useEffect, useState } from 'react';
import type { TestimonialCardProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';
import { Icon } from '@/components/ui/icon';

/** Review card: star rating, italic quote, reviewer identity row. */
export function TestimonialCardBlock({ props }: BlockComponentProps<TestimonialCardProps>) {
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
        'liquid-glass p-8 rounded-2xl flex flex-col justify-between hover:shadow-xl transition-shadow h-full',
        className,
      )}
      style={layoutStyle(props)}
    >
      <div>
        {stars > 0 ? (
          <div className="flex items-center gap-1 text-warning mb-4" aria-label={`${stars} out of 5 stars`}>
            {Array.from({ length: stars }).map((_, i) => (
              <Icon key={i} name="star" className="size-4 fill-current" />
            ))}
          </div>
        ) : null}
        <blockquote className="text-body-md leading-relaxed italic text-foreground/80">
          &ldquo;{quote}&rdquo;
        </blockquote>
      </div>
      <figcaption className="flex items-center gap-4 pt-4 border-t border-glass-border">
        <div className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-bold text-primary shadow-sm">
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
          <div className="font-bold text-foreground">{name}</div>
          {role ? <div className="text-xs text-muted-foreground mt-0.5">{role}</div> : null}
        </div>
      </figcaption>
    </figure>
  );
}
