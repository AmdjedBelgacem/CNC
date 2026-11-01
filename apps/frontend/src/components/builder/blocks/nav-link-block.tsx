import Link from 'next/link';
import type { NavLinkProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import { isInternalHref } from '@/lib/builder/href';
import type { BlockComponentProps } from './index'; /** Quiet navbar link; the active link reads in full ink. */
export function NavLinkBlock({ props }: BlockComponentProps<NavLinkProps>) {
  const { label = '', href = '#', active, className } = props;
  const classes = cn(
    'inline-flex items-center text-13 font-medium',
    active ? 'text-foreground' : 'text-muted-foreground transition-colors hover:text-foreground',
    className,
  );
  const style = layoutStyle(props);
  if (isInternalHref(href)) {
    return (
      <Link href={href} className={classes} style={style}>
        {' '}
        {label}{' '}
      </Link>
    );
  }
  return (
    <a href={href} className={classes} style={style}>
      {' '}
      {label}{' '}
    </a>
  );
}
