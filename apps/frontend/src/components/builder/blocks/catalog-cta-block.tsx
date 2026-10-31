import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { CatalogCtaProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';
import { Icon } from '@/components/ui/icon';

/** Shared CTA link used by the catalog hero and its child button block. */
export function CatalogCtaLink({
  label,
  href,
  variant = 'primary',
  icon,
  className,
  style,
}: {
  label: string;
  href: string;
  variant?: 'primary' | 'secondary';
  icon?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const isPrimary = variant === 'primary';
  const external = href.startsWith('#') || href.startsWith('http');
  const cls = cn(
    isPrimary
      ? 'pressable inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition-[background-color,box-shadow] hover:bg-primary/90 hover:shadow-md'
      : 'pressable inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-card px-6 text-sm font-medium text-foreground shadow-xs transition-colors hover:border-border-strong hover:bg-muted/50',
    className,
  );
  const content = (
    <>
      {icon ? <Icon name={icon} className="size-4" /> : null}
      {label}
    </>
  );
  if (external) {
    return (
      <a href={href} className={cls} style={style}>
        {content}
      </a>
    );
  }
  return (
    <Link href={href} className={cls} style={style}>
      {content}
    </Link>
  );
}

/** One primary or secondary action in a catalog hero. */
export function CatalogCtaBlock({ props }: BlockComponentProps<CatalogCtaProps>) {
  const { label, href, variant = 'primary', icon, className } = props;
  return (
    <CatalogCtaLink
      label={label}
      href={href}
      variant={variant}
      icon={icon}
      className={className}
      style={layoutStyle(props)}
    />
  );
}
