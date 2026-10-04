import Link from 'next/link';
import type { LinkProps } from '@titan/shared';
import { resolveIconName } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import { isInternalHref } from '@/lib/builder/href';
import type { BlockComponentProps } from './index'; /** Plain text anchor (footer links) or a circular icon anchor (social links). */
import { Icon } from '@/components/ui/icon';
export function LinkBlock({ props }: BlockComponentProps<LinkProps>) {
  const { label = '', href = '#', icon, className } = props;
  const iconOnly = !!icon && !label;
  const classes = cn(
    iconOnly
      ? 'w-10 h-10 rounded-full border border-glass-border flex items-center justify-center text-text-muted hover:text-primary transition-colors'
      : 'font-body-md text-text-muted hover:text-primary transition-colors opacity-80',
    className,
  );
  const style = layoutStyle(props);
  const inner = iconOnly ? (
    <Icon name={resolveIconName(icon)} className="text-lg" />
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
