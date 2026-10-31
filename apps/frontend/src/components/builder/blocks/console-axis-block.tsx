import type { ConsoleAxisProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';

/** One axis label / value cell. */
export function ConsoleAxisBlock({ props, puck }: BlockComponentProps<ConsoleAxisProps>) {
  const { label, value, tone = 'normal', className } = props;
  if (!value && !puck?.isEditing) return null;
  const accent = tone === 'accent';
  return (
    <div
      className={cn(
        'flex-1 min-w-0 rounded-md border bg-background/70 p-1 sm:p-1.5',
        accent ? 'border-primary/40 bg-primary/[0.06]' : 'border-border/70',
        className,
      )}
      style={layoutStyle(props)}
    >
      <span
        className={cn(
          'block truncate text-[9px] sm:text-[10px]',
          accent ? 'text-primary' : 'text-muted-foreground',
        )}
      >
        {label}
      </span>
      <span className="block truncate text-[11px] font-semibold text-foreground tabular-nums sm:text-xs">
        {value || '0.000'}
      </span>
    </div>
  );
}
