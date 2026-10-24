import type { ConsoleAxisDrawerProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import { Icon } from '@/components/ui/icon';
import type { BlockComponentProps } from './index';
import { CONSOLE_DARK_GLASS } from './console-shared';

const PLACEMENT: Record<string, string> = {
  bottom: 'bottom-4 inset-x-4',
  top: 'top-4 inset-x-4',
};

/** Bottom drawer that groups the kinematic axis readouts. */
export function ConsoleAxisDrawerBlock({
  props,
  puck,
}: BlockComponentProps<ConsoleAxisDrawerProps>) {
  const { title, vibration, placement = 'bottom', className } = props;
  const hasChildren = (puck.getSlotData?.('content')?.length ?? 0) > 0;
  if (!hasChildren && !puck?.isEditing) return null;

  return (
    <div
      className={cn(
        CONSOLE_DARK_GLASS,
        'absolute p-3.5 rounded-xl z-20 !pointer-events-auto',
        PLACEMENT[placement] ?? PLACEMENT.bottom,
        className,
      )}
      style={layoutStyle(props)}
    >
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon name="tune" className="size-3.5 text-white/70 shrink-0" />
          <span className="text-xs font-mono font-medium text-white/90 truncate">{title}</span>
        </div>
        {vibration ? (
          <span className="text-[11px] font-mono text-success shrink-0 hidden sm:inline">
            {vibration}
          </span>
        ) : null}
      </div>
      <div className="flex gap-2 text-center font-mono">
        {puck.renderSlot('content', { className: 'flex flex-1 gap-2' })}
      </div>
    </div>
  );
}
