import type { ConsoleHeaderProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';

/** Window chrome above the console viewport. */
export function ConsoleHeaderBlock({ props }: BlockComponentProps<ConsoleHeaderProps>) {
  const { fileName, syncLabel, showTrafficLights = true, className } = props;
  return (
    <div
      className={cn(
        'bg-card rounded-lg p-3 mb-2 flex items-center justify-between border-b border-glass-border',
        className,
      )}
      style={layoutStyle(props)}
    >
      <div className="flex items-center gap-2 min-w-0">
        {showTrafficLights ? (
          <div className="flex gap-1.5 shrink-0">
            <span className="size-2.5 rounded-full bg-destructive/70" />
            <span className="size-2.5 rounded-full bg-warning/70" />
            <span className="size-2.5 rounded-full bg-success/70" />
          </div>
        ) : null}
        {fileName ? (
          <span className="text-xs font-mono text-text-muted ms-2 truncate">{fileName}</span>
        ) : null}
      </div>
      {syncLabel ? (
        <span className="inline-flex items-center gap-1 text-2xs font-mono px-2 py-0.5 rounded bg-success/15 text-success font-semibold shrink-0">
          <span className="size-1.5 rounded-full bg-success animate-pulse" />
          {syncLabel}
        </span>
      ) : null}
    </div>
  );
}
