import type { ProgressCardProps } from '@titan/shared';
import { resolveIconName } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index'; /** Certification progress card (CTA banner), per the mockup. */
export function ProgressCardBlock({ props }: BlockComponentProps<ProgressCardProps>) {
  const {
    percent = 85,
    title = 'Certification Status',
    subtitle = 'Industry Accredited',
    label = 'Core Mastery Progress',
    value = '85.4%',
    icon = 'verified',
    ticks = true,
    barHeight = 'h-3',
    className,
  } = props;
  return (
    <div
      className={cn(
        'bg-white border border-gray-200 p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm md:scale-110',
        className,
      )}
      style={layoutStyle(props)}
    >
      {' '}
      <div className="flex items-center gap-4 mb-6">
        {' '}
        <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
          {' '}
          <span className="material-symbols-outlined text-white" aria-hidden="true">
            {' '}
            {resolveIconName(icon)}{' '}
          </span>{' '}
        </div>{' '}
        <div>
          {' '}
          <div className="text-white font-bold text-[16px]">{title}</div>{' '}
          <div className="text-white/60 text-[10px] uppercase tracking-[0.2em] font-bold">
            {subtitle}
          </div>{' '}
        </div>{' '}
      </div>{' '}
      <div className="flex justify-between text-[10px] text-white/80 uppercase tracking-[0.2em] font-bold mb-2">
        {' '}
        <span>{label}</span> <span>{value}</span>{' '}
      </div>{' '}
      <div className={cn('w-full bg-white rounded-full overflow-hidden', barHeight)}>
        {' '}
        <div className="h-full bg-white rounded-full" style={{ width: `${percent}%` }}></div>{' '}
      </div>{' '}
      {ticks && (
        <div className="flex gap-2 mt-3">
          {' '}
          <div className="h-1 bg-white rounded-full flex-1"></div>{' '}
          <div className="h-1 bg-white rounded-full flex-1"></div>{' '}
          <div className="h-1 bg-white rounded-full flex-1"></div>{' '}
        </div>
      )}{' '}
    </div>
  );
}
