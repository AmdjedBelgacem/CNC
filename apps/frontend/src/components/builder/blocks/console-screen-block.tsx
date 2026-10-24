import type { CSSProperties } from 'react';
import type { ConsoleScreenProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';

/** Viewport container for the console image and its telemetry overlays. */
export function ConsoleScreenBlock({ props, puck }: BlockComponentProps<ConsoleScreenProps>) {
  const { height = 440, mobileHeight = 380, blueprint = true, className } = props;
  const style = {
    ...layoutStyle(props),
    '--console-screen-height': `${height}px`,
    '--console-screen-height-mobile': `${mobileHeight}px`,
  } as CSSProperties;

  return (
    <div
      className={cn(
        'relative rounded-lg overflow-hidden group bg-surface-sunken',
        'h-[var(--console-screen-height-mobile)] sm:h-[var(--console-screen-height)]',
        className,
      )}
      style={style}
    >
      {blueprint ? <div className="absolute inset-0 blueprint-grid" aria-hidden="true" /> : null}
      {puck.renderSlot('media', {
        className: 'absolute inset-0 z-0 [&>div]:!static',
      })}
      {puck.renderSlot('overlays', { className: '[&>div]:!static' })}
    </div>
  );
}
