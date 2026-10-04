'use client';
import Link from 'next/link';
import type { CatalogHeroProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';
import { Icon } from '@/components/ui/icon';

function CtaLink({
  label,
  href,
  variant = 'primary',
  icon,
}: {
  label: string;
  href: string;
  variant?: 'primary' | 'secondary';
  icon?: string;
}) {
  const isPrimary = variant === 'primary';
  const external = href.startsWith('#') || href.startsWith('http');
  const cls = isPrimary
    ? 'inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-6 font-medium text-primary-foreground shadow-sm transition hover:opacity-90'
    : 'inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-card px-6 font-medium text-foreground transition hover:bg-surface-sunken';
  const content = (
    <>
      {icon ? <Icon name={icon} className="size-4" /> : null}
      {label}
    </>
  );
  if (external) {
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

/** Catalog hero: blueprint grid, badge row, accent H1, stats strip, CTAs. */
export function CatalogHeroBlock({ props }: BlockComponentProps<CatalogHeroProps>) {
  const {
    id,
    className,
    eyebrow,
    eyebrowIcon,
    metaLine,
    title,
    titleAccent,
    subtitle,
    stats,
    primaryCta,
    secondaryCta,
    borderBottom = true,
  } = props;

  return (
    <section
      id={id}
      className={cn(
        'relative overflow-hidden',
        borderBottom && 'border-b border-border',
        className,
      )}
      style={layoutStyle(props)}
    >
      <div className="absolute inset-0 blueprint-grid opacity-60" aria-hidden />
      <div
        className="absolute -top-28 end-10 size-72 rounded-full bg-primary/10 blur-3xl"
        aria-hidden
      />
      <div className="relative px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto pt-16 pb-12 md:pt-24 md:pb-16">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-sm border border-border bg-card px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-primary shadow-xs">
            {eyebrowIcon ? (
              <Icon name={eyebrowIcon} className="size-3.5" />
            ) : (
              <span className="size-1.5 rounded-full bg-primary" />
            )}
            {eyebrow}
          </span>
          {metaLine ? (
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
              {metaLine}
            </span>
          ) : null}
        </div>

        <h1 className="mt-6 max-w-3xl font-display text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl md:text-6xl">
          {title}
          {titleAccent ? <span className="block text-primary">{titleAccent}</span> : null}
        </h1>
        {subtitle ? (
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
            {subtitle}
          </p>
        ) : null}

        {stats && stats.length > 0 ? (
          <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="bg-card px-4 py-3.5">
                <dt className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {s.label}
                </dt>
                <dd className="mt-1 font-display text-xl font-bold tracking-tight text-foreground tabular-nums">
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        {primaryCta || secondaryCta ? (
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {primaryCta ? (
              <CtaLink
                label={primaryCta.label}
                href={primaryCta.href}
                variant={primaryCta.variant ?? 'primary'}
                icon={primaryCta.icon}
              />
            ) : null}
            {secondaryCta ? (
              <CtaLink
                label={secondaryCta.label}
                href={secondaryCta.href}
                variant={secondaryCta.variant ?? 'secondary'}
                icon={secondaryCta.icon}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
