import type { StatItemProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';
const STAT_PADDING: Record<string, string> = { none: '', sm: 'p-4', md: 'p-6', lg: 'p-8' };
const STAT_BG: Record<string, string> = {
  transparent: '',
  muted: 'bg-surface-container-low',
  glass: 'bg-card border border-border',
  gradient: 'bg-primary text-primary-foreground',
  'gradient-muted': 'bg-surface-container-low',
};
const STAT_RADIUS: Record<string, string> = {
  none: '',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  '3xl': 'rounded-3xl',
  full: 'rounded-full',
}; /** A single stat card: icon tile, tag pill, number and label. */
export function StatItemBlock({ props, puck }: BlockComponentProps<StatItemProps>) {
  const {
    className,
    padding = 'lg',
    bg = 'glass',
    radius = 'xl',
    border = false,
    hover = true,
    accent = true,
    accentColor = 'bg-primary',
  } = props;
  return (
    <div
      className={cn(
        STAT_PADDING[padding],
        STAT_BG[bg],
        STAT_RADIUS[radius],
        border && 'border border-glass-border',
        hover && ' transition-all duration-300 group',
        accent && 'relative overflow-hidden',
        className,
      )}
      style={layoutStyle(props)}
    >
      {' '}
      {accent && (
        <div
          className={cn(
            'absolute top-0 start-0 w-1 h-full opacity-0 group-hover:opacity-100 transition-opacity',
            accentColor,
          )}
        ></div>
      )}{' '}
      <div className={accent ? 'relative' : undefined}>{puck.renderSlot('content')}</div>{' '}
    </div>
  );
}
