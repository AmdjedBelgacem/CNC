import type { AvatarStackProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';
import { useBuilderLivePreview } from '@/components/builder/live-preview-context';

/** Overlapping avatar circles with a "+N" pill (mockup academy cards). */
export function AvatarStackBlock({ props, puck }: BlockComponentProps<AvatarStackProps>) {
  const { count = '+80', size = 32, plainCircles = 2, className } = props;
  const preview = useBuilderLivePreview();
  const liveCount =
    puck?.isEditing &&
    preview?.pageSlug === 'home' &&
    preview.homeMetrics &&
    (count === '+17k' || count === '+80')
      ? preview.homeMetrics.trustCount
      : count;
  const plainColors = ['bg-muted', 'bg-surface-sunken', 'bg-border', 'bg-secondary/15'];
  return (
    <div className={cn('flex -space-x-2', className)} style={layoutStyle(props)}>
      {' '}
      {Array.from({ length: plainCircles }).map((_, i) => (
        <div
          key={i}
          className={cn('rounded-full border-2 border-background shadow-xs', plainColors[i % plainColors.length])}
          style={{ width: size, height: size }}
        ></div>
      ))}{' '}
      <div
        className="flex items-center justify-center rounded-full border-2 border-background bg-primary/10 text-2xs font-semibold text-primary tabular-nums shadow-xs"
        style={{ width: size, height: size }}
      >
        {' '}
        {liveCount}{' '}
      </div>{' '}
    </div>
  );
}
