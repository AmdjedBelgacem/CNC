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
        'p-2 flex items-center justify-between gap-2 text-xs text-text-secondary',
        className,
      )}
      style={layoutStyle(props)}
    >
      <div className="flex items-center gap-2 flex-wrap">
        {puck.renderSlot('content', { className: 'flex items-center gap-2 flex-wrap' })}
      </div>
      {controllerLabel ? (
        <span className="text-[11px] text-text-muted hidden sm:inline-block shrink-0">
          {controllerLabel}
        </span>
      ) : null}
    </div>
  );
}
