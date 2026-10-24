import type { ConsoleTelemetryStackProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';
import { CONSOLE_CORNER } from './console-shared';

const GAP: Record<string, string> = {
  sm: 'gap-1.5',
  md: 'gap-2',
  lg: 'gap-3',
};

/** Corner stack that groups telemetry badges inside the console screen. */
export function ConsoleTelemetryStackBlock({
  props,
  puck,
}: BlockComponentProps<ConsoleTelemetryStackProps>) {
  const { placement = 'top-left', gap = 'md', className } = props;
  const gapClass = GAP[gap] ?? GAP.md;
  return (
    <div
      className={cn(
        'absolute z-20 flex flex-col !pointer-events-auto',
        CONSOLE_CORNER[placement] ?? CONSOLE_CORNER['top-left'],
        gapClass,
        className,
      )}
      style={layoutStyle(props)}
    >
      {puck.renderSlot('content', { className: cn('flex flex-col', gapClass) })}
    </div>
  );
}
