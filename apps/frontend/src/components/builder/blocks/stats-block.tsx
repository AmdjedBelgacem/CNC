import type { StatsProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index'; /** Overlapping stat cards that sit on top of the hero. */
export function StatsBlock({ props, puck }: BlockComponentProps<StatsProps>) {
  const {
    className,
    overlap = 96,
    columnsMobile = 'grid-cols-1',
    columnsSm = 'sm:grid-cols-2',
    columnsLg = 'lg:grid-cols-4',
    gap = 'gap-6',
  } = props;
  return (
    <section
      className={cn(
        'px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto relative z-20',
        className,
      )}
      style={{ ...layoutStyle(props), marginTop: -overlap }}
    >
      {' '}
      <div className={cn('grid', columnsMobile, columnsSm, columnsLg, gap)}>
        {puck.renderSlot('content')}
      </div>{' '}
    </section>
  );
}
