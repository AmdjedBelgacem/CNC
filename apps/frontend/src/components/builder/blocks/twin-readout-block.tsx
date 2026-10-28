import type { TwinReadoutProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';

const READOUT_TONE: Record<string, string> = {
  success: 'text-success',
  normal: 'text-white',
  accent: 'text-secondary-fixed',
  primary: 'text-white',
};

/** One value cell in the digital-twin control dashboard. */
export function TwinReadoutBlock({ props }: BlockComponentProps<TwinReadoutProps>) {
  const { label, value, tone = 'normal', className } = props;
  return (
    <div
      className={cn('p-2 rounded bg-white/5 border border-white/10', className)}
      style={layoutStyle(props)}
    >
      <span className="text-[10px] text-white/50 block">{label}</span>
      <span className={cn('text-xs font-bold', READOUT_TONE[tone] ?? READOUT_TONE.normal)}>
        {value}
      </span>
    </div>
  );
}
