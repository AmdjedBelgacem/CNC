'use client';
import Link from 'next/link';
import type { ClosingCtaProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';
import { Icon } from '@/components/ui/icon';

function Cta(
  label: string,
  href: string,
  primary: boolean,
  icon?: string,
) {
  const cls = primary
    ? 'inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-6 font-medium text-primary-foreground transition hover:opacity-90'
    : 'inline-flex h-11 items-center justify-center gap-2 rounded-md border border-white/20 px-6 font-medium text-white transition hover:bg-white/10';
  const content = (
    <>
      {icon ? <Icon name={icon} className="size-4" /> : null}
      {label}
    </>
  );
  if (href.startsWith('#') || href.startsWith('http')) {
    return (
      <a href={href} className={cls}>
        {content}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {content}
    </Link>
  );
}

/** Dark overlay closing band with copy column + primary/secondary CTAs. */
export function ClosingCtaBlock({ props }: BlockComponentProps<ClosingCtaProps>) {
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
          {primaryLabel && primaryHref
            ? Cta(primaryLabel, primaryHref, true, primaryIcon)
            : null}
          {secondaryLabel && secondaryHref
            ? Cta(secondaryLabel, secondaryHref, false, secondaryIcon)
            : null}
        </div>
      </div>
    </section>
  );
}
