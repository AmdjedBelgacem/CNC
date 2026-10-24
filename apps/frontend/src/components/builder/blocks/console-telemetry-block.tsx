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
        'px-3 py-2 rounded-lg font-mono text-xs flex items-center gap-3',
        className,
      )}
      style={layoutStyle(props)}
    >
      <span className="text-white/60">{label}</span>
      <span className="font-bold text-sm">{value || 'Value'}</span>
      {tag ? (
        tagTone === 'muted' ? (
          <span className="text-[10px] text-white/70">{tag}</span>
        ) : (
          <span className="text-[10px] bg-success/40 text-white px-1.5 py-0.5 rounded">{tag}</span>
        )
      ) : null}
    </div>
  );
}
