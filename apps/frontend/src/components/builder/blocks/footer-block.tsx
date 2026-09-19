import type { FooterProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index'; /** Four-column footer with a bottom bar. */
export function FooterBlock({ props, puck }: BlockComponentProps<FooterProps>) {
  const {
    className,
    gridGap = 'gap-12',
    columnsSm = 'sm:grid-cols-2',
    columnsLg = 'md:grid-cols-4',
    bottomGap = 'gap-8',
  } = props;
  return (
    <footer
      className={cn('bg-surface-container-lowest border-t border-glass-border', className)}
      style={layoutStyle(props)}
    >
      {' '}
      <div
        className={cn(
          'grid grid-cols-1 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto',
          columnsSm,
          columnsLg,
          gridGap,
        )}
      >
        {' '}
        {puck.renderSlot('columns')}{' '}
      </div>{' '}
      <div
        className={cn(
          'border-t border-glass-border px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto flex flex-col md:flex-row justify-between items-center',
          bottomGap,
        )}
      >
        {' '}
        {puck.renderSlot('bottom')}{' '}
      </div>{' '}
    </footer>
  );
}
