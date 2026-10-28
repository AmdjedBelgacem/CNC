'use client';
import type { ClosingCtaProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';
import { ClosingCtaActionLink } from './closing-cta-action-block';

/** Dark overlay closing band with copy column + primary/secondary CTAs. */
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
        'bg-overlay px-margin-mobile md:px-margin-desktop py-16 text-white md:py-20',
        borderTop && 'border-t border-border',
        className,
      )}
      style={layoutStyle(props)}
    >
      <div className="max-w-container-max mx-auto flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
        <div className="max-w-xl">
          {eyebrow ? (
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl">{title}</h2>
          {body ? <p className="mt-3 text-white/70">{body}</p> : null}
        </div>
        <div className="flex flex-wrap gap-3">
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
      </div>
    </section>
  );
}
