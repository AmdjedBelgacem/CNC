import type { CardGridItemProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';
import { Icon } from '@/components/ui/icon';

/** One card inside a Card Grid. Numbering comes from the parent's CSS counter. */
export function CardGridItemBlock({ props }: BlockComponentProps<CardGridItemProps>) {
  const { title, body, icon, className } = props;
  return (
    <div
      role="listitem"
      className={cn(
        'card-grid-item card-hover relative rounded-2xl border border-border/70 bg-card p-6 shadow-xs md:p-7',
        className,
      )}
      style={layoutStyle(props)}
    >
      <span
        className="card-grid-index absolute end-6 top-6 font-display text-sm font-medium text-muted-foreground/50 tabular-nums"
        aria-hidden
      />
      <div className="mb-5 flex size-11 items-center justify-center rounded-xl bg-primary/[0.08] text-primary ring-1 ring-inset ring-primary/10">
        <Icon name={icon} className="size-5" />
      </div>
      <h3 className="font-display text-xl font-medium tracking-[-0.015em] text-foreground">{title}</h3>
      {body ? (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
      ) : null}
    </div>
  );
}
