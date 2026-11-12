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
    'group inline-flex items-center justify-center rounded-lg bg-primary px-10 py-4 text-sm font-medium text-primary-foreground shadow-sm transition-[background-color,box-shadow,transform] duration-200 hover:bg-primary/90 hover:shadow-md active:scale-[0.98] min-w-[150px] sm:min-w-[180px]',
  glass:
    'group inline-flex items-center justify-center rounded-lg border border-border bg-card px-10 py-4 text-sm font-medium text-foreground shadow-xs transition-[background-color,border-color,transform] duration-200 hover:border-border-strong hover:bg-muted/50 active:scale-[0.98] min-w-[150px] sm:min-w-[180px]',
  white:
    'group inline-flex items-center justify-center rounded-lg bg-card px-10 py-4 text-sm font-medium text-foreground shadow-sm transition-[background-color,transform] duration-200 hover:bg-card/90 active:scale-[0.98] min-w-[150px] sm:min-w-[180px]',
  'white-outline':
    'group inline-flex items-center justify-center rounded-lg border border-border bg-card px-10 py-4 text-sm font-medium text-card-foreground transition-colors duration-200 hover:bg-muted/50 min-w-[150px] sm:min-w-[180px]',
  pill: 'group flex items-center rounded-full border border-primary/25 px-5 py-2.5 text-sm font-medium text-primary transition-colors duration-200 hover:bg-primary/[0.06]',
  'nav-cta':
    'inline-flex items-center rounded-lg bg-primary px-4 py-2 text-13 font-medium text-primary-foreground shadow-xs transition-[background-color,transform] duration-200 hover:bg-primary/90 active:scale-[0.97]',
  link: 'group inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline',
  enroll:
    'inline-flex items-center gap-1 text-sm font-medium text-primary transition-transform duration-200 group-hover:translate-x-0.5',
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
  sm: 'px-4 py-2.5',
  md: 'px-6 py-3',
  lg: 'px-8 py-3.5',
};
export function ButtonBlock({ props, puck }: BlockComponentProps<ButtonProps>) {
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
  // An href of exactly "#" is a placeholder someone left in (the seeded FAQ ended with a "Contact
  // Technical Support" button that went nowhere). Visitors get nothing rather than a control that
  // looks clickable and does nothing; the editor still shows it so it can be given a destination.
  if (typeof href === 'string' && href.trim() === '#' && !puck?.isEditing) return null;
  const sizeClass = SIZED.has(variant) ? (SIZES[size] ?? SIZES.md) : '';
  const variantClass = (BTN_VARIANTS[variant] ?? BTN_VARIANTS.primary).replace(
    'px-10 py-4',
    sizeClass,
  );
  const rootClass = cn(variantClass, width === 'full' && 'w-full', className);
  // Exact colours sit over the variant's own, so a copied design keeps its palette.
  const { bgColor, textColor, borderColor } = props;
  const style = {
    ...layoutStyle(props),
    ...(bgColor ? { backgroundColor: bgColor, backgroundImage: 'none' } : {}),
    ...(textColor ? { color: textColor } : {}),
    ...(borderColor ? { borderColor, borderWidth: 1, borderStyle: 'solid' as const } : {}),
  };
  const resolvedIcon = icon ? resolveIconName(icon) : null;
  const iconEl = resolvedIcon ? (
    <Icon
      name={resolvedIcon}
      className={cn(
        COMPACT.has(variant) ? 'size-3.5' : 'size-4',
        COMPACT.has(variant) ? '' : iconPosition === 'left' ? 'me-2' : 'ms-2',
        // Trailing arrows nudge toward the destination on hover.
        iconPosition !== 'left' &&
          'transition-transform duration-200 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5',
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
      <Link href={href} className={rootClass} style={style}>
        {' '}
        {inner}{' '}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={rootClass} style={style}>
        {' '}
        {inner}{' '}
      </a>
    );
  } // In the mockup, enroll/link labels are decorative `<span>`s (e.g. inside a // card that is itself a link) — never nest anchors or buttons inside one.
if (variant === 'enroll' || variant === 'link') {
    return (
      <span className={rootClass} style={style}>
        {' '}
        {inner}{' '}
      </span>
    );
  }
  return (
    <button type="button" className={rootClass} style={style}>
      {' '}
      {inner}{' '}
    </button>
  );
}
