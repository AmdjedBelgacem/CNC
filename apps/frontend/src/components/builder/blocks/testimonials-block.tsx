import type { TestimonialsProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';

/** Centered header plus the testimonial card grid (mockup social proof). */
export function TestimonialsBlock({ props, puck }: BlockComponentProps<TestimonialsProps>) {
  const {
    id,
    className,
    headerMarginBottom = 64,
    columnsMd = 'md:grid-cols-2',
    cardsGap = 'gap-8',
  } = props;
  return (
    <section
      id={id}
      className={cn('px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto', className)}
      style={layoutStyle(props)}
    >
      <div
        className="text-center max-w-3xl mx-auto"
        style={{ marginBottom: headerMarginBottom }}
      >
        {puck.renderSlot('header')}
      </div>
      <div className={cn('grid grid-cols-1', columnsMd, cardsGap)}>{puck.renderSlot('items')}</div>
    </section>
  );
}
