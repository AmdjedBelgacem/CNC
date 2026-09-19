import type { CardProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';
const CARD_PADDING: Record<string, string> = { none: '', sm: 'p-4', md: 'p-6', lg: 'p-8' };
const CARD_BG: Record<string, string> = {
  transparent: '',
  muted: 'bg-surface-container-low',
  glass: 'bg-white border border-gray-200',
  gradient: 'bg-gradient-to-br from-primary to-accent',
  'gradient-muted': 'bg-gradient-to-br from-surface-container-low to-surface-container-lowest',
};
const CARD_SHADOW: Record<string, string> = {
  none: '',
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
  xl: 'shadow-sm',
  glow: 'shadow-[0_0_44px_-12px_rgba(37,99,235,0.55)]',
};
const CARD_RADIUS: Record<string, string> = {
  none: '',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  full: 'rounded-full',
};
export function CardBlock({ props, puck }: BlockComponentProps<CardProps>) {
  const {
    padding = 'md',
    bg = 'transparent',
    radius = 'lg',
    border = true,
    align = 'left',
    shadow = 'none',
    hover = false,
    accent = false,
    accentColor = 'bg-primary',
    className,
  } = props;
  return (
    <div
      className={cn(
        CARD_PADDING[padding],
        CARD_BG[bg],
        CARD_RADIUS[radius],
        CARD_SHADOW[shadow],
        border && 'border border-glass-border',
        align === 'center' && 'text-center',
        align === 'right' && 'text-right',
        hover && ' transition-all duration-300',
        accent && 'relative overflow-hidden group',
        className,
      )}
      style={layoutStyle(props)}
    >
      {' '}
      {accent && (
        <div
          className={cn(
            'absolute top-0 left-0 w-1 h-full opacity-0 group-hover:opacity-100 transition-opacity',
            accentColor,
          )}
        ></div>
      )}{' '}
      <div className={accent ? 'relative' : undefined}>{puck.renderSlot('content')}</div>{' '}
    </div>
  );
}
