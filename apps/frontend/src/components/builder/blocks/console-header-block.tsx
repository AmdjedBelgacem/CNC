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
        'mb-2 flex items-center justify-between rounded-xl bg-card px-3.5 py-2.5',
        className,
      )}
      style={layoutStyle(props)}
    >
      <div className="flex items-center gap-2 min-w-0">
        {showTrafficLights ? (
          <div className="flex gap-1.5 shrink-0">
            <span className="size-2.5 rounded-full bg-destructive/45" />
            <span className="size-2.5 rounded-full bg-warning/45" />
            <span className="size-2.5 rounded-full bg-success/45" />
          </div>
        ) : null}
        {fileName ? (
          <span className="ms-2 truncate font-mono text-[11px] text-muted-foreground">{fileName}</span>
        ) : null}
      </div>
      {syncLabel ? (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-0.5 font-mono text-2xs font-medium text-success">
          <span className="size-1.5 rounded-full bg-success animate-pulse" />
          {syncLabel}
        </span>
      ) : null}
    </div>
  );
}
