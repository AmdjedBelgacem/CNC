import type { TwinReadoutProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';

const READOUT_TONE: Record<string, string> = {
  success: 'text-success',
  normal: 'text-foreground',
  accent: 'text-primary',
  primary: 'text-foreground',
};

/** One value cell in the digital-twin control dashboard. */
export function TwinReadoutBlock({ props }: BlockComponentProps<TwinReadoutProps>) {
  const { label, value, tone = 'normal', className } = props;
  return (
    <div
      className={cn('rounded-lg border border-border/70 bg-card p-2.5 shadow-xs', className)}
      style={layoutStyle(props)}
    >
      <span className="block font-sans text-[11px] text-muted-foreground">{label}</span>
      <span className={cn('mt-0.5 block text-xs font-semibold tabular-nums', READOUT_TONE[tone] ?? READOUT_TONE.normal)}>
        {value}
      </span>
    </div>
  );
}
