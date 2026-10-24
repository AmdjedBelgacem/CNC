import type { ConsoleFrameProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';
import { CONSOLE_RADIUS } from './console-shared';

/** Glass shell around the simulator console. */
export function ConsoleFrameBlock({ props, puck }: BlockComponentProps<ConsoleFrameProps>) {
  const { radius = '2xl', padding = 8, glass = true, className } = props;
  return (
    <div
      className={cn(
        'relative shadow-xl',
        CONSOLE_RADIUS[radius] ?? CONSOLE_RADIUS['2xl'],
        glass && 'liquid-glass',
        className,
      )}
      style={{ ...layoutStyle(props), padding }}
      dir="ltr"
    >
      {puck.renderSlot('content', { className: '[&>div]:!static' })}
    </div>
  );
}
