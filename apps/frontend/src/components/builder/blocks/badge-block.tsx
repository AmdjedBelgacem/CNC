import type { BadgeProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index'; /** Mockup pill treatments: glow (hero eyebrow), primary, secondary (with icon), neutral, card (level pill). */
const BADGE_VARIANTS: Record<string, string> = {
  // Hero eyebrow: a paper pill with a clay dot — quiet, sentence-case, editorial.
  glow: 'inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/80 px-3.5 py-1.5 text-[13px] font-medium text-foreground/80 shadow-xs backdrop-blur-sm',
  primary:
    'inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary',
  secondary:
    'inline-flex items-center gap-1 rounded-full bg-secondary/10 px-2.5 py-0.5 text-xs font-medium text-secondary',
  neutral:
    'inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground',
  card: 'inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary',
};
export function BadgeBlock({ props }: BlockComponentProps<BadgeProps>) {
  const { text = '', variant = 'glow', uppercase, icon, iconSize = 12, pulse, className } = props;
  return (
    <span
      className={cn(BADGE_VARIANTS[variant] ?? BADGE_VARIANTS.glow, pulse && 'inline-flex items-center gap-2', uppercase && 'uppercase', className)}
      style={layoutStyle(props)}
    >
      {' '}
      {pulse ? (
        <span className="relative flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-40 [animation-duration:2.4s]"></span>
          <span className="relative inline-flex size-2 rounded-full bg-primary"></span>
        </span>
      ) : null}{' '}
      {/* Guarded on the raw prop: resolveIconName() returns 'help' for undefined,
          so an unset icon used to render a stray placeholder on every badge. */}
      {icon ? <Icon name={icon} size={iconSize} /> : null}{' '}
      <span>{text}</span>{' '}
    </span>
  );
}
