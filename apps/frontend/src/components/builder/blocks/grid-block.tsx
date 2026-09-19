import type { GridProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';
const GRID_COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
  6: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6',
};
const GRID_GAP: Record<string, string> = {
  sm: 'gap-4',
  md: 'gap-6',
  'md-lg': 'gap-7',
  lg: 'gap-8',
  xl: 'gap-12',
};
export function GridBlock({ props, puck }: BlockComponentProps<GridProps>) {
  const { columns = 3, gap = 'lg', className } = props;
  return (
    <div
      className={cn(
        'grid',
        GRID_COLS[columns] ?? 'grid-cols-1',
        GRID_GAP[gap] ?? 'gap-6',
        className,
      )}
      style={layoutStyle(props)}
    >
      {' '}
      {puck.renderSlot('items')}{' '}
    </div>
  );
}
