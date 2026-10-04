import type { CtaBannerProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index'; /** Gradient banner over a background image with copy + side card columns. */
export function CtaBannerBlock({ props, puck }: BlockComponentProps<CtaBannerProps>) {
  const {
    imageUrl,
    overlayColor = '#C2410C',
    overlayOpacity = 90,
    radialVeil = true,
    gap = 64,
    radius = 'rounded-3xl',
    copyWidth = 'lg:w-3/5',
    sideWidth = 'lg:w-2/5',
    className,
    sectionBg = '',
  } = props; // Use responsive padding that works on mobile — ignore any stored `padding` prop that may be `p-12 md:p-24`
const padding = 'p-6 sm:p-8 md:p-12 lg:p-16';
  const rgb = /^#([0-9a-fA-F]{6})$/.exec(overlayColor);
  const overlayRgb = rgb?.[1]
    ? `${parseInt(rgb[1].slice(0, 2), 16)},${parseInt(rgb[1].slice(2, 4), 16)},${parseInt(rgb[1].slice(4, 6), 16)}`
    : '194,65,12';
  const gradient = `linear-gradient(rgba(${overlayRgb},${overlayOpacity / 100}),rgba(${overlayRgb},${overlayOpacity / 100}))${imageUrl ? `,url('${imageUrl}')` : ''}`;
  return (
    <section
      className={cn('px-margin-mobile md:px-margin-desktop', sectionBg, className)}
      style={layoutStyle(props)}
    >
      {' '}
      <div
        className={cn(
          'max-w-container-max mx-auto relative overflow-hidden flex flex-col lg:flex-row items-center',
          padding,
          radius,
        )}
        style={{
          backgroundImage: gradient,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          gap,
        }}
      >
        {' '}
        {radialVeil && (
          <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
        )}{' '}
        <div className={cn('relative z-10 text-center lg:text-left', copyWidth)}>
          {puck.renderSlot('copy')}
        </div>{' '}
        <div className={cn(sideWidth, 'relative')}>{puck.renderSlot('side')}</div>{' '}
      </div>{' '}
    </section>
  );
}
