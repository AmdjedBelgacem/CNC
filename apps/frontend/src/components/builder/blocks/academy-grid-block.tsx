import type { AcademyGridProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index'; /** Header row plus a grid of academy cards. */
export function AcademyGridBlock({ props, puck }: BlockComponentProps<AcademyGridProps>) {
  const {
    className,
    headerMarginBottom = 64,
    cardsColumns = 'md:grid-cols-3',
    cardsGap = 'gap-8',
  } = props;
  const id = (props as { id?: string }).id;
  return (
    <section
      id={id}
      className={cn('px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto', className)}
      style={layoutStyle(props)}
    >
      {' '}
      <div
        className="flex flex-col md:flex-row justify-between items-end"
        style={{ marginBottom: headerMarginBottom }}
      >
        {' '}
        {puck.renderSlot('header')}{' '}
      </div>{' '}
      <div className={cn('grid grid-cols-1', cardsColumns, cardsGap)}>
        {puck.renderSlot('cards')}
      </div>{' '}
    </section>
  );
}
