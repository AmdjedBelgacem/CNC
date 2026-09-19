import type { PartnerLogosProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index'; /** Eyebrow header above a glass logo wall. */
export function PartnerLogosBlock({ props, puck }: BlockComponentProps<PartnerLogosProps>) {
  const { className, logoGap = 'gap-12 md:gap-24', headerMarginBottom = 40 } = props;
  return (
    <section
      className={cn('px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto', className)}
      style={layoutStyle(props)}
    >
      {' '}
      <div className="text-center" style={{ marginBottom: headerMarginBottom }}>
        {puck.renderSlot('header')}
      </div>{' '}
      <div
        className={cn(
          'bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 md:p-12 flex flex-wrap items-center justify-center',
          logoGap,
        )}
      >
        {' '}
        {puck.renderSlot('logos')}{' '}
      </div>{' '}
    </section>
  );
}
