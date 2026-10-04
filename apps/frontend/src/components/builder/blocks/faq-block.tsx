import type { FaqProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index'; /** Centered FAQ header, list and support footer. */
export function FaqBlock({ props, puck }: BlockComponentProps<FaqProps>) {
  const {
    id,
    className,
    sectionBg = '',
    maxWidth = 896,
    headerMarginBottom = 64,
    itemsGap = 'flex flex-col gap-4',
    footerMarginTop = 64,
  } = props;
  return (
    <section
      id={id}
      className={cn('px-margin-mobile md:px-margin-desktop', sectionBg, className)}
      style={layoutStyle(props)}
    >
      {' '}
      <div className="mx-auto" style={{ maxWidth }}>
        {' '}
        <div className="text-center" style={{ marginBottom: headerMarginBottom }}>
          {puck.renderSlot('header')}
        </div>{' '}
        <div className={itemsGap}>{puck.renderSlot('items')}</div>{' '}
        <div className="text-center" style={{ marginTop: footerMarginTop }}>
          {puck.renderSlot('footer')}
        </div>{' '}
      </div>{' '}
    </section>
  );
}
