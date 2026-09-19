import type { FeatureItemProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index'; /** Icon tile beside a title + description. */
export function FeatureItemBlock({ props, puck }: BlockComponentProps<FeatureItemProps>) {
  const { className, gap = 'gap-5' } = props;
  return (
    <div className={cn('flex', gap, className)} style={layoutStyle(props)}>
      {' '}
      {puck.renderSlot('content')}{' '}
    </div>
  );
}
