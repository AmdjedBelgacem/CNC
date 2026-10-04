import type { ProgressCardProps } from '@titan/shared';
import { resolveIconName } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index'; /** Certification progress card (CTA banner), per the mockup. */
import { Icon } from '@/components/ui/icon';
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
        'bg-card border border-border p-6 sm:p-8 rounded-3xl border border-border shadow-sm md:scale-110',
        className,
      )}
      style={layoutStyle(props)}
    >
      {' '}
      <div className="flex items-center gap-4 mb-6">
        {' '}
        <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
          {' '}
          <Icon name={resolveIconName(icon)} className="text-white" />{' '}
        </div>{' '}
        <div>
          {' '}
          <div className="text-white font-bold text-base">{title}</div>{' '}
          <div className="text-white/60 text-2xs uppercase tracking-[0.2em] font-bold">
            {subtitle}
          </div>{' '}
        </div>{' '}
      </div>{' '}
      <div className="flex justify-between text-2xs text-white/80 uppercase tracking-[0.2em] font-bold mb-2">
        {' '}
        <span>{label}</span> <span>{value}</span>{' '}
      </div>{' '}
      <div className={cn('w-full bg-card rounded-full overflow-hidden', barHeight)}>
        {' '}
        <div className="h-full bg-card rounded-full" style={{ width: `${percent}%` }}></div>{' '}
      </div>{' '}
      {ticks && (
        <div className="flex gap-2 mt-3">
          {' '}
          <div className="h-1 bg-card rounded-full flex-1"></div>{' '}
          <div className="h-1 bg-card rounded-full flex-1"></div>{' '}
          <div className="h-1 bg-card rounded-full flex-1"></div>{' '}
        </div>
      )}{' '}
    </div>
  );
}
