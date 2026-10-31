import type { ConsoleModeBarProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';

/** Bar below the viewport that holds the view-mode buttons. */
export function ConsoleModeBarBlock({ props, puck }: BlockComponentProps<ConsoleModeBarProps>) {
  const { controllerLabel, className } = props;
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 px-1.5 pb-1 pt-2.5 text-xs text-muted-foreground',
        className,
      )}
      style={layoutStyle(props)}
    >
      <div className="flex items-center gap-2 flex-wrap">
        {puck.renderSlot('content', { className: 'flex items-center gap-2 flex-wrap' })}
      </div>
      {controllerLabel ? (
        <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:inline-block">
          {controllerLabel}
        </span>
      ) : null}
    </div>
  );
}
