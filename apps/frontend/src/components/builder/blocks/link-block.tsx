import Link from 'next/link';
import type { LinkProps } from '@titan/shared';
import { resolveIconName } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import { isInternalHref } from '@/lib/builder/href';
import type { BlockComponentProps } from './index'; /** Plain text anchor (footer links) or a circular icon anchor (social links). */
import { Icon } from '@/components/ui/icon';
import { ArrowRight } from 'lucide-react';
export function LinkBlock({ props }: BlockComponentProps<LinkProps>) {
  const { label = '', href = '#', icon, className, arrow } = props;
  const iconOnly = !!icon && !label;
  // `.link-pill` is a complete treatment (colour, size, hover); the plain-link
  // defaults would fight it.
  const isPill = !!className?.includes('link-pill');
  const classes = cn(
    iconOnly
      ? 'flex size-10 items-center justify-center rounded-full border border-border/70 text-muted-foreground transition-colors hover:border-border-strong hover:bg-muted/60 hover:text-foreground'
      : isPill
        ? undefined
        : 'font-body-md text-muted-foreground transition-colors hover:text-foreground',
    className,
  );
  const style = layoutStyle(props);
  const inner = iconOnly ? (
    <Icon name={resolveIconName(icon)} className="text-lg" />
  ) : arrow ? (
    <>
      {label}
      <ArrowRight className="flip-rtl size-3.5 transition-transform group-hover:translate-x-0.5" />
    </>
  ) : (
    label
  );
  if (isInternalHref(href)) {
    return (
      <Link href={href} className={classes} style={style}>
        {' '}
        {inner}{' '}
      </Link>
    );
  }
  return (
    <a href={href} className={classes} style={style}>
      {' '}
      {inner}{' '}
    </a>
  );
}
