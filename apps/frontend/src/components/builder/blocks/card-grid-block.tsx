'use client';
import type { CardGridProps } from '@titan/shared';
import { isNodeArray } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';
import { Icon } from '@/components/ui/icon';
import { Reveal } from '@/components/ui/motion';

/** Numbered/icon card grid — steps, promises, formats, house rules. */
export function CardGridBlock({ props, puck }: BlockComponentProps<CardGridProps>) {
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

  const slotCards = puck.getSlotData?.('cards') ?? [];
  const hasSlotCards = slotCards.length > 0;
  const legacyItems = Array.isArray(items) && !isNodeArray(items) ? items : [];

  return (
    <section
      id={id}
      className={cn(
        'px-margin-mobile md:px-margin-desktop',
        band === 'sunken' && 'border-y border-border/70 bg-surface-sunken/50',
        className,
      )}
      style={layoutStyle(props)}
    >
      <div className="max-w-container-max mx-auto py-20 md:py-28">
        <Reveal className="mb-10 max-w-2xl md:mb-12">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h2 className="mt-3 text-balance font-display text-3xl font-medium tracking-[-0.022em] text-foreground md:text-[2.5rem] md:leading-[1.1]">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
              {subtitle}
            </p>
          ) : null}
        </Reveal>

        <div
          role="list"
          className={cn('grid gap-5 md:gap-6', columns, showNumbers && 'card-grid-numbered')}
        >
          {hasSlotCards
            ? puck.renderSlot('cards')
            : legacyItems.length > 0
              ? legacyItems.map((item, index) => {
                  const num = String(index + 1).padStart(2, '0');
                  return (
                    <div
                      key={`${item.title}-${index}`}
                      role="listitem"
                      className="card-hover relative rounded-2xl border border-border/70 bg-card p-6 shadow-xs md:p-7"
                    >
                      {showNumbers ? (
                        <span className="absolute end-6 top-6 font-display text-sm font-medium text-muted-foreground/50 tabular-nums">
                          {num}
                        </span>
                      ) : null}
                      <div className="mb-5 flex size-11 items-center justify-center rounded-xl bg-primary/[0.08] text-primary ring-1 ring-inset ring-primary/10">
                        <Icon name={item.icon} className="size-5" />
                      </div>
                      <h3 className="font-display text-xl font-medium tracking-[-0.015em] text-foreground">
                        {item.title}
                      </h3>
                      {item.body ? (
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          {item.body}
                        </p>
                      ) : null}
                    </div>
                  );
                })
              : puck.renderSlot('cards')}
        </div>

        {note ? (
          <p className="mt-8 inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-4 py-2.5 text-sm text-muted-foreground shadow-xs">
            <Icon name="verified_user" className="size-4 shrink-0 text-primary" />
            {note}
          </p>
        ) : null}
      </div>
    </section>
  );
}
