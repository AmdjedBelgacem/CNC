import type { ConsoleMetricProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import { Icon } from '@/components/ui/icon';
import type { BlockComponentProps } from './index';
import { CONSOLE_METRIC_POSITION } from './console-shared';
import { ConsoleFloat } from './console-motion';

/** Metric badge that overlaps the console corner. */
export function ConsoleMetricBlock({ props, puck }: BlockComponentProps<ConsoleMetricProps>) {
  const { icon = 'speed', label, value, tag, placement = 'bottom-left', className } = props;
  if (!value && !puck?.isEditing) return null;

  return (
    <div
      className={cn(
        'absolute z-30 hidden !pointer-events-auto md:block',
        CONSOLE_METRIC_POSITION[placement] ?? CONSOLE_METRIC_POSITION['bottom-left'],
        className,
      )}
      style={layoutStyle(props)}
    >
      <ConsoleFloat
        delay={0.6}
        className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/90 p-3.5 pe-5 shadow-lg backdrop-blur-md"
      >
        <div className="flex size-10 items-center justify-center rounded-xl bg-success/10 text-success">
          <Icon name={icon} className="size-5" />
        </div>
        <div dir="ltr">
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
          <div className="font-mono text-lg font-semibold tabular-nums text-foreground">
            {value || '0%'}
            {tag ? (
              <span className="ms-1.5 font-sans text-xs font-medium text-success">{tag}</span>
            ) : null}
          </div>
        </div>
      </ConsoleFloat>
    </div>
  );
}
