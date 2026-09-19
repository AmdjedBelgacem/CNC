import type { AvatarStackProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index'; /** Overlapping avatar circles with a "+N" pill (mockup academy cards). */
export function AvatarStackBlock({ props }: BlockComponentProps<AvatarStackProps>) {
  const { count = '+80', size = 32, plainCircles = 2, className } = props;
  const plainColors = ['bg-slate-200', 'bg-slate-300'];
  return (
    <div className={cn('flex -space-x-2', className)} style={layoutStyle(props)}>
      {' '}
      {Array.from({ length: plainCircles }).map((_, i) => (
        <div
          key={i}
          className={cn('rounded-full border-2 border-white', plainColors[i % plainColors.length])}
          style={{ width: size, height: size }}
        ></div>
      ))}{' '}
      <div
        className="rounded-full border-2 border-white bg-primary flex items-center justify-center text-[10px] text-white font-bold"
        style={{ width: size, height: size }}
      >
        {' '}
        {count}{' '}
      </div>{' '}
    </div>
  );
}
