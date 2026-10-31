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
        // Rises in with CSS rather than JS so the hero visual is painted in the
        // first frame even before hydration.
        'relative shadow-xl ring-1 ring-black/[0.03] dark:ring-white/[0.04]',
        'motion-safe:animate-fade-in-up motion-safe:[animation-delay:120ms] motion-safe:[animation-duration:900ms] motion-safe:[animation-fill-mode:both]',
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
