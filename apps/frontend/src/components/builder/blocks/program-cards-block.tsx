import type { ProgramCardsProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';

/** Section header row plus the program-card grid (mockup learning paths). */
export function ProgramCardsBlock({ props, puck }: BlockComponentProps<ProgramCardsProps>) {
  const {
    id,
    className,
    headerMarginBottom = 64,
    columnsLg = 'lg:grid-cols-3',
    cardsGap = 'gap-8',
  } = props;
  return (
    <section
      id={id}
      className={cn('px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto', className)}
      style={layoutStyle(props)}
    >
      <div style={{ marginBottom: headerMarginBottom }}>{puck.renderSlot('header')}</div>
      <div className={cn('grid grid-cols-1', columnsLg, cardsGap)}>{puck.renderSlot('cards')}</div>
    </section>
  );
}
