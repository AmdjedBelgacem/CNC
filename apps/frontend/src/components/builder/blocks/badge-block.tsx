import type { BadgeProps } from '@titan/shared';
import { resolveIconName } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index'; /** Mockup pill treatments: glow (hero eyebrow), primary, secondary (with icon), neutral, card (level pill). */
const BADGE_VARIANTS: Record<string, string> = {
  glow: 'inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary font-label-sm text-[12px] font-bold uppercase tracking-[0.15em]',
  primary:
    'inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider',
  secondary:
    'px-3 py-1 rounded-full bg-secondary/10 text-secondary text-[10px] font-bold flex items-center gap-1',
  neutral:
    'inline-flex items-center gap-1 px-3 py-1 rounded-full bg-surface-container-high text-text-muted text-[10px] font-bold uppercase tracking-wider',
  card: 'inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded uppercase tracking-[0.1em]',
};
export function BadgeBlock({ props }: BlockComponentProps<BadgeProps>) {
  const { text = '', variant = 'glow', uppercase, icon: rawIcon, iconSize = 12, className } = props;
  const icon = resolveIconName(rawIcon as string | undefined);
  return (
    <span
      className={cn(BADGE_VARIANTS[variant], uppercase && 'uppercase', className)}
      style={layoutStyle(props)}
    >
      {' '}
      {icon && (
        <span
          className="material-symbols-outlined"
          style={{ fontSize: iconSize }}
          aria-hidden="true"
        >
          {' '}
          {icon}{' '}
        </span>
      )}{' '}
      <span>{text}</span>{' '}
    </span>
  );
}
