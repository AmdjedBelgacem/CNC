import Link from 'next/link';
import type { NavLinkProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import { isInternalHref } from '@/lib/builder/href';
import type { BlockComponentProps } from './index'; /** Small uppercase navbar link; the first/active link is primary-coloured. */
export function NavLinkBlock({ props }: BlockComponentProps<NavLinkProps>) {
  const { label = '', href = '#', active, className } = props;
  const classes = cn(
    'inline-flex items-center font-label-sm text-[11px] font-bold tracking-[0.1em]',
    active ? 'text-primary' : 'text-text-muted hover:text-primary transition-colors',
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
