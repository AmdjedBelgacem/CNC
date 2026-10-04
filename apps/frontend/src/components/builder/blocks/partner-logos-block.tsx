import type { PartnerLogosProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index'; /** Eyebrow header above a glass logo wall. */
export function PartnerLogosBlock({ props, puck }: BlockComponentProps<PartnerLogosProps>) {
  const { id, className, logoGap = 'gap-12 md:gap-24', headerMarginBottom = 40, frame = 'wall' } = props;
  if (frame === 'strip') {
    return (
      <section id={id} className={cn('w-full', className)} style={layoutStyle(props)}>
        {' '}
        <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto text-center">
          {' '}
          <div style={{ marginBottom: headerMarginBottom }}>{puck.renderSlot('header')}</div>{' '}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 items-center justify-center">
            {' '}
            {puck.renderSlot('logos')}{' '}
          </div>{' '}
        </div>{' '}
      </section>
    );
  }
  return (
    <section
      id={id}
      className={cn('px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto', className)}
      style={layoutStyle(props)}
    >
      {' '}
      <div className="text-center" style={{ marginBottom: headerMarginBottom }}>
        {puck.renderSlot('header')}
      </div>{' '}
      <div
        className={cn(
          'bg-card border border-border rounded-3xl p-6 sm:p-8 md:p-12 flex flex-wrap items-center justify-center',
          logoGap,
        )}
      >
        {' '}
        {puck.renderSlot('logos')}{' '}
      </div>{' '}
    </section>
  );
}
