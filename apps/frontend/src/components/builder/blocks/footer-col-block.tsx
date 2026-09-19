import type { FooterColProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index'; /** A footer column: heading + links stacked with a gap. */
export function FooterColBlock({ props, puck }: BlockComponentProps<FooterColProps>) {
  const { className, gap = 'gap-4' } = props;
  return (
    <div className={cn('flex flex-col', gap, className)} style={layoutStyle(props)}>
      {' '}
      {puck.renderSlot('content')}{' '}
    </div>
  );
}
