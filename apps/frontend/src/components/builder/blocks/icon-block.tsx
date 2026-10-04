import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { IconProps } from '@titan/shared';
import { resolveIconName } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import { isInternalHref } from '@/lib/builder/href';
import type { BlockComponentProps } from './index'; /** Icon tile treatments from the mockup. */
import { Icon } from '@/components/ui/icon';
const ICON_BOX: Record<string, string> = {
  none: '',
  tinted: 'w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary',
  white:
    'w-12 h-12 rounded-xl bg-card shadow-sm border border-glass-border flex items-center justify-center',
};
export function IconBlock({ props }: BlockComponentProps<IconProps>) {
  const { icon: rawIcon, size = 24, color, box = 'none', href, className } = props;
  const icon = resolveIconName(rawIcon);
  const isHex = color?.startsWith('#');
  const style: CSSProperties = {
    fontSize: size,
    ...(isHex ? { color } : {}),
    ...layoutStyle(props),
  };
  const inner = (
    <Icon
      name={icon}
      size={size}
      className={cn(ICON_BOX[box], isHex ? undefined : color, className)}
      style={style}
    />
  );
  if (href && isInternalHref(href)) {
    return (
      <Link href={href} aria-label={icon}>
        {' '}
        {inner}{' '}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} aria-label={icon}>
        {' '}
        {inner}{' '}
      </a>
    );
  }
  return inner;
}
