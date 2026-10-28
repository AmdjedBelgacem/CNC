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
        'card-grid-item relative rounded-lg border border-border bg-card p-6 shadow-xs',
        className,
      )}
      style={layoutStyle(props)}
    >
      <span
        className="card-grid-index absolute end-5 top-5 font-mono text-xs font-bold tracking-[0.1em] text-border-strong tabular-nums"
        aria-hidden
      />
      <div className="mb-4 flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon name={icon} className="size-5" />
      </div>
      <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">{title}</h3>
      {body ? (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
      ) : null}
    </div>
  );
}
