'use client';
import Link from 'next/link';
import type { SpotlightCardsProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';
import { Icon } from '@/components/ui/icon';

/** Spotlight path cards: tag pill, title, meta line, explore link. */
export function SpotlightCardsBlock({ props }: BlockComponentProps<SpotlightCardsProps>) {
  const {
    id,
    className,
    eyebrow,
    title,
    subtitle,
    items = [],
    columns = 'md:grid-cols-3',
    band = 'none',
  } = props;

  return (
    <section
      id={id}
      className={cn(
        'px-margin-mobile md:px-margin-desktop',
        band === 'sunken' && 'border-y border-border bg-surface-sunken/50',
        className,
      )}
      style={layoutStyle(props)}
    >
      <div className="max-w-container-max mx-auto py-16 md:py-24">
        <div className="mb-8 max-w-2xl">
          {eyebrow ? (
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            {title}
          </h2>
          {subtitle ? <p className="mt-3 text-muted-foreground">{subtitle}</p> : null}
        </div>

        <div className={cn('grid gap-4', columns)}>
          {items.map((item) => (
            <Link
              key={`${item.href}-${item.title}`}
              href={item.href}
              className="group flex flex-col rounded-lg border border-border bg-card p-6 shadow-xs transition-colors duration-200 hover:border-primary/40 hover:shadow-md"
            >
              <span className="mb-4 w-fit rounded-sm bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">
                {item.tag}
              </span>
              <h3 className="font-display text-lg font-semibold leading-snug tracking-tight text-foreground">
                {item.title}
              </h3>
              {item.meta ? (
                <p className="mt-2 font-mono text-xs text-muted-foreground">{item.meta}</p>
              ) : null}
              <span className="mt-6 inline-flex items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">
                Explore path
                <Icon name="arrow_forward" className="size-3.5 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
