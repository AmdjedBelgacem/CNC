import Link from 'next/link';
import type { ButtonProps } from '@titan/shared';
import { resolveIconName } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import { isInternalHref } from '@/lib/builder/href';
import type { BlockComponentProps } from './index';
import { Icon } from '@/components/ui/icon';
type ButtonVariant =
  | 'primary'
  | 'glass'
  | 'white'
  | 'white-outline'
  | 'pill'
  | 'nav-cta'
  | 'link'
  | 'enroll'; /** Mockup button treatments, verbatim. Inline-flex roots so the buttons participate fully in * parent layout (line-box height, transforms, min-width) — matching how browsers blockify them * inside production flex containers, and how Puck's editor wrappers wrap them. */
const BTN_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'inline-flex items-center justify-center bg-primary text-on-primary px-10 py-4 rounded-xl font-label-sm text-sm font-bold hover:scale-[1.02] transition-transform shadow-lg min-w-[160px] sm:min-w-[200px]',
  glass:
    'inline-flex items-center justify-center bg-card border border-border text-primary px-10 py-4 rounded-xl font-label-sm text-sm font-bold hover:scale-[1.02] transition-transform min-w-[160px] sm:min-w-[200px]',
  white:
    'inline-flex items-center justify-center bg-card text-primary px-10 py-4 rounded-xl font-label-sm text-sm font-bold hover:scale-[1.02] transition-transform shadow-sm min-w-[160px] sm:min-w-[200px]',
  'white-outline':
    'inline-flex items-center justify-center bg-card text-card-foreground border border-border px-10 py-4 rounded-xl font-label-sm text-sm font-bold hover:bg-card transition-colors min-w-[160px] sm:min-w-[200px]',
  pill: 'group flex items-center text-primary font-label-sm text-xs font-bold uppercase tracking-wider px-6 py-3 rounded-full border border-primary/20 hover:bg-primary/5 transition-all',
  'nav-cta':
    'inline-flex items-center bg-primary text-on-primary px-6 py-2 rounded-full font-label-sm text-13 font-bold shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-95',
  link: 'inline-flex items-center text-primary font-bold font-label-sm uppercase tracking-wider hover:underline',
  enroll:
    'inline-flex items-center gap-1 text-primary font-bold font-label-sm text-xs uppercase tracking-[0.2em] group-hover:translate-x-1 transition-transform',
}; /** Compact inline labels (enroll/link) drop the margin and shrink the icon, matching the mockup. */
const COMPACT = new Set([
  'enroll',
  'pill',
]); /** Variants with standard (size-adjustable) padding. */
const SIZED = new Set([
  'primary',
  'glass',
  'white',
  'white-outline',
]); /** Size → padding treatment for the standard variants. */
const SIZES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'px-6 py-3',
  md: 'px-10 py-4',
  lg: 'px-12 py-5',
};
export function ButtonBlock({ props }: BlockComponentProps<ButtonProps>) {
  const {
    label = '',
    href,
    variant = 'primary',
    icon,
    iconPosition = 'right',
    size = 'md',
    width = 'auto',
    className,
  } = props;
  const sizeClass = SIZED.has(variant) ? SIZES[size] : '';
  const variantClass = BTN_VARIANTS[variant].replace('px-10 py-4', sizeClass);
  const rootClass = cn(variantClass, width === 'full' && 'w-full', className);
  const resolvedIcon = icon ? resolveIconName(icon) : null;
  const iconEl = resolvedIcon ? (
    <Icon
      name={resolvedIcon}
      className={cn(
        COMPACT.has(variant) ? 'size-3.5' : 'size-4',
        COMPACT.has(variant) ? '' : iconPosition === 'left' ? 'me-2' : 'ms-2',
        variant === 'pill' && 'transition-transform group-hover:translate-x-1',
      )}
    />
  ) : null;
  const inner = (
    <>
      {' '}
      {iconPosition === 'left' && iconEl} {label} {iconPosition === 'right' && iconEl}{' '}
    </>
  );
  if (href && isInternalHref(href)) {
    return (
      <Link href={href} className={rootClass} style={layoutStyle(props)}>
        {' '}
        {inner}{' '}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={rootClass} style={layoutStyle(props)}>
        {' '}
        {inner}{' '}
      </a>
    );
  } // In the mockup, enroll/link labels are decorative `<span>`s (e.g. inside a // card that is itself a link) — never nest anchors or buttons inside one.
if (variant === 'enroll' || variant === 'link') {
    return (
      <span className={rootClass} style={layoutStyle(props)}>
        {' '}
        {inner}{' '}
      </span>
    );
  }
  return (
    <button type="button" className={rootClass} style={layoutStyle(props)}>
      {' '}
      {inner}{' '}
    </button>
  );
}
