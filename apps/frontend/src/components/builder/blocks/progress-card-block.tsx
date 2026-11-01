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
        'rounded-3xl border border-border/70 bg-card p-6 text-card-foreground shadow-lg sm:p-8 md:scale-110',
        className,
      )}
      style={layoutStyle(props)}
    >
      {' '}
      <div className="flex items-center gap-4 mb-6">
        {' '}
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 ring-1 ring-inset ring-primary/15">
          {' '}
          <Icon name={resolveIconName(icon)} className="text-primary" />{' '}
        </div>{' '}
        <div>
          {' '}
          <div className="font-display text-lg font-medium text-card-foreground">{title}</div>{' '}
          <div className="text-xs font-medium text-muted-foreground">
            {subtitle}
          </div>{' '}
        </div>{' '}
      </div>{' '}
      <div className="mb-2 flex justify-between text-xs font-medium text-muted-foreground">
        {' '}
        <span>{label}</span> <span className="font-mono tabular-nums text-foreground">{value}</span>{' '}
      </div>{' '}
      <div className={cn('w-full bg-muted rounded-full overflow-hidden', barHeight)}>
        {' '}
        <div className="h-full bg-primary rounded-full" style={{ width: `${percent}%` }}></div>{' '}
      </div>{' '}
      {ticks && (
        <div className="flex gap-2 mt-3">
          {' '}
          <div className="h-1 bg-primary/25 rounded-full flex-1"></div>{' '}
          <div className="h-1 bg-primary/25 rounded-full flex-1"></div>{' '}
          <div className="h-1 bg-primary/25 rounded-full flex-1"></div>{' '}
        </div>
      )}{' '}
    </div>
  );
}
