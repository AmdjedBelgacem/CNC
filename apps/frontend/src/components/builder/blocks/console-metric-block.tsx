import type { ConsoleMetricProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import { Icon } from '@/components/ui/icon';
import type { BlockComponentProps } from './index';
import { CONSOLE_METRIC_POSITION } from './console-shared';

/** Metric badge that overlaps the console corner. */
export function ConsoleMetricBlock({ props, puck }: BlockComponentProps<ConsoleMetricProps>) {
  const { icon = 'speed', label, value, tag, placement = 'bottom-left', className } = props;
  if (!value && !puck?.isEditing) return null;

  return (
    <div
      className={cn(
        'absolute liquid-glass p-4 rounded-xl shadow-xl hidden md:flex items-center gap-3 z-30 !pointer-events-auto',
        CONSOLE_METRIC_POSITION[placement] ?? CONSOLE_METRIC_POSITION['bottom-left'],
        className,
      )}
      style={layoutStyle(props)}
    >
      <div className="size-10 rounded-lg bg-success/10 text-success flex items-center justify-center">
        <Icon name={icon} className="size-5" />
      </div>
      <div dir="ltr">
        <div className="text-xs text-text-muted font-medium">{label}</div>
        <div className="text-lg font-bold text-text-primary font-mono">
          {value || '0%'}
          {tag ? (
            <span className="text-success text-xs font-sans font-semibold ms-1">{tag}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
