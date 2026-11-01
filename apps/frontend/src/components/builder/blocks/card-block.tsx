import type { CardProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';
const CARD_PADDING: Record<string, string> = { none: '', sm: 'p-4', md: 'p-6', lg: 'p-8' };
const CARD_BG: Record<string, string> = {
  transparent: '',
  muted: 'bg-surface-container-low',
  glass: 'bg-card border border-border/70 shadow-xs',
  gradient: 'bg-primary text-primary-foreground',
  'gradient-muted': 'bg-surface-container-low',
};
const CARD_SHADOW: Record<string, string> = {
  none: '',
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
  xl: 'shadow-xl',
  glow: 'shadow-lg ring-1 ring-primary/10',
};
const CARD_RADIUS: Record<string, string> = {
  none: '',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  '3xl': 'rounded-3xl',
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
        border && 'border border-border/70',
        align === 'center' && 'text-center',
        align === 'right' && 'text-right',
        hover && 'card-hover',
        accent && 'relative overflow-hidden group',
        className,
      )}
      style={layoutStyle(props)}
    >
      {' '}
      {accent && (
        <div
          className={cn(
            'absolute inset-y-4 start-0 w-[3px] rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100',
            accentColor,
          )}
        ></div>
      )}{' '}
      <div className={accent ? 'relative' : undefined}>{puck.renderSlot('content')}</div>{' '}
    </div>
  );
}
