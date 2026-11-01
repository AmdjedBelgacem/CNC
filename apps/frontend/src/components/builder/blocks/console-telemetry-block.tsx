import type { ConsoleTelemetryProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';
import { CONSOLE_DARK_GLASS } from './console-shared';

/** One label / value / tag telemetry readout. */
export function ConsoleTelemetryBlock({ props, puck }: BlockComponentProps<ConsoleTelemetryProps>) {
  const { label, value, tag, tagTone = 'success', className } = props;
  if (!value && !puck?.isEditing) return null;
  return (
    <div
      className={cn(
        CONSOLE_DARK_GLASS,
        // On phones the badge shares the top edge with the audit card, so it has to wrap
        // its label / value / tag instead of forcing a single very wide line.
        'flex min-w-0 max-w-full flex-wrap items-center gap-x-1.5 gap-y-1 rounded-xl px-2.5 py-1.5 font-mono text-[10px] sm:gap-3 sm:px-3 sm:py-2 sm:text-xs',
        className,
      )}
      style={layoutStyle(props)}
    >
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-xs font-semibold tabular-nums sm:text-sm">{value || 'Value'}</span>
      {tag ? (
        tagTone === 'muted' ? (
          <span className="text-[9px] text-muted-foreground sm:text-[10px]">{tag}</span>
        ) : (
          <span className="rounded-full bg-success/10 px-1.5 py-0.5 text-[9px] font-medium text-success sm:text-[10px]">
            {tag}
          </span>
        )
      ) : null}
    </div>
  );
}
