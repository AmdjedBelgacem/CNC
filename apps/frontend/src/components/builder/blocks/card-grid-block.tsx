'use client';
import type { CardGridProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';
import { Icon } from '@/components/ui/icon';

/** Numbered/icon card grid — steps, promises, formats, house rules. */
export function CardGridBlock({ props }: BlockComponentProps<CardGridProps>) {
  const {
    id,
    className,
    eyebrow,
    title,
    subtitle,
    items = [],
    showNumbers = true,
    columns = 'md:grid-cols-3',
    band = 'none',
    note,
  } = props;

  const Wrapper = showNumbers ? 'ol' : 'ul';

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
      <div className="max-w-container-max mx-auto py-16 md:py-20">
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

        <Wrapper className={cn('grid gap-4', columns)}>
          {items.map((item, index) => {
            const num = String(index + 1).padStart(2, '0');
            return (
              <li
                key={`${item.title}-${index}`}
                className="relative rounded-lg border border-border bg-card p-6 shadow-xs"
              >
                {showNumbers ? (
                  <span className="absolute end-5 top-5 font-mono text-xs font-bold tracking-[0.1em] text-border-strong tabular-nums">
                    {num}
                  </span>
                ) : null}
                <div className="mb-4 flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon name={item.icon} className="size-5" />
                </div>
                <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">
                  {item.title}
                </h3>
                {item.body ? (
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                ) : null}
              </li>
            );
          })}
        </Wrapper>

        {note ? (
          <p className="mt-6 inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-xs">
            <Icon name="verified_user" className="size-4 shrink-0 text-primary" />
            {note}
          </p>
        ) : null}
      </div>
    </section>
  );
}
