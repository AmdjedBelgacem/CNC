'use client';
import type { ClosingCtaProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';
import { ClosingCtaActionLink } from './closing-cta-action-block';
import { Reveal } from '@/components/ui/motion';

/** Paper closing band with copy column + primary/secondary CTAs. */
export function ClosingCtaBlock({ props, puck }: BlockComponentProps<ClosingCtaProps>) {
  const {
    id,
    className,
    eyebrow,
    title,
    body,
    primaryLabel,
    primaryHref,
    primaryIcon,
    secondaryLabel,
    secondaryHref,
    secondaryIcon,
    borderTop = false,
  } = props;

  const slotActions = puck.getSlotData?.('actions') ?? [];
  const hasSlotActions = slotActions.length > 0;

  return (
    <section
      id={id}
      className={cn(
        'px-margin-mobile md:px-margin-desktop py-16 md:py-24',
        borderTop && 'border-t border-border',
        className,
      )}
      style={layoutStyle(props)}
    >
      <Reveal className="relative max-w-container-max mx-auto flex flex-col items-start justify-between gap-8 overflow-hidden rounded-3xl border border-border/70 bg-card px-6 py-10 shadow-sm sm:px-10 md:flex-row md:items-center md:px-14 md:py-14">
        <div aria-hidden className="pointer-events-none absolute inset-0 ambient-wash opacity-80" />
        <div className="relative max-w-xl">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h2 className="mt-3 text-balance font-display text-3xl font-medium tracking-[-0.022em] text-foreground md:text-4xl">
            {title}
          </h2>
          {body ? <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">{body}</p> : null}
        </div>
        <div className="relative flex flex-wrap gap-3">
          {hasSlotActions ? (
            puck.renderSlot('actions')
          ) : (
            <>
              {primaryLabel && primaryHref ? (
                <ClosingCtaActionLink
                  label={primaryLabel}
                  href={primaryHref}
                  variant="primary"
                  icon={primaryIcon}
                />
              ) : null}
              {secondaryLabel && secondaryHref ? (
                <ClosingCtaActionLink
                  label={secondaryLabel}
                  href={secondaryHref}
                  variant="secondary"
                  icon={secondaryIcon}
                />
              ) : null}
            </>
          )}
        </div>
      </Reveal>
    </section>
  );
}
