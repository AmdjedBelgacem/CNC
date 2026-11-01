'use client';
import Link from 'next/link';
import type { SpotlightCardsProps } from '@titan/shared';
import { isNodeArray } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';
import { Icon } from '@/components/ui/icon';
import { Reveal } from '@/components/ui/motion';

/** Spotlight path cards: tag pill, title, meta line, explore link. */
export function SpotlightCardsBlock({ props, puck }: BlockComponentProps<SpotlightCardsProps>) {
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
      <div className="max-w-container-max mx-auto py-16 md:py-24">
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

        <div className={cn('grid gap-5 md:gap-6', columns)}>
          {hasSlotCards
            ? puck.renderSlot('cards')
            : legacyItems.length > 0
              ? legacyItems.map((item) => (
                  <Link
                    key={`${item.href}-${item.title}`}
                    href={item.href}
                    className="card-hover group flex flex-col rounded-2xl border border-border/70 bg-card p-6 shadow-xs md:p-7"
                  >
                    <span className="mb-5 w-fit rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      {item.tag}
                    </span>
                    <h3 className="text-balance font-display text-xl font-medium leading-snug tracking-[-0.015em] text-foreground">
                      {item.title}
                    </h3>
                    {item.meta ? (
                      <p className="mt-2 text-sm text-muted-foreground">{item.meta}</p>
                    ) : null}
                    <span className="mt-auto inline-flex items-center gap-1 pt-6 text-sm font-medium text-primary">
                      Explore path
                      <Icon
                        name="arrow_forward"
                        className="size-4 transition-transform duration-200 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
                      />
                    </span>
                  </Link>
                ))
              : puck.renderSlot('cards')}
        </div>
      </div>
    </section>
  );
}
