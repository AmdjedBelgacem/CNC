import type { BadgeProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index'; /** Mockup pill treatments: glow (hero eyebrow), primary, secondary (with icon), neutral, card (level pill). */
const BADGE_VARIANTS: Record<string, string> = {
  glow: 'inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary font-label-sm text-xs font-bold uppercase tracking-[0.15em]',
  primary:
    'inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-2xs font-bold uppercase tracking-wider',
  secondary:
    'px-3 py-1 rounded-full bg-secondary/10 text-secondary text-2xs font-bold flex items-center gap-1',
  neutral:
    'inline-flex items-center gap-1 px-3 py-1 rounded-full bg-surface-container-high text-text-muted text-2xs font-bold uppercase tracking-wider',
  card: 'inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-2xs font-bold rounded uppercase tracking-[0.1em]',
};
export function BadgeBlock({ props }: BlockComponentProps<BadgeProps>) {
  const { text = '', variant = 'glow', uppercase, icon, iconSize = 12, pulse, className } = props;
  return (
    <span
      className={cn(BADGE_VARIANTS[variant], pulse && 'inline-flex items-center gap-2.5', uppercase && 'uppercase', className)}
      style={layoutStyle(props)}
    >
      {' '}
      {pulse ? (
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
        </span>
      ) : null}{' '}
      {/* Guarded on the raw prop: resolveIconName() returns 'help' for undefined,
          so an unset icon used to render a stray placeholder on every badge. */}
      {icon ? <Icon name={icon} size={iconSize} /> : null}{' '}
      <span>{text}</span>{' '}
    </span>
  );
}
