import type { FeatureTilesProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index'; /** Two-column section: supporting image beside a feature list. */
export function FeatureTilesBlock({ props, puck }: BlockComponentProps<FeatureTilesProps>) {
  const {
    imageUrl,
    imageAlt = '',
    sectionBg = 'bg-surface-container-lowest',
    gap = 64,
    imageBorder = 8,
    decorativeCircles = true,
    imageFirstMobile = false,
    className,
  } = props;
  return (
    <section
      className={cn('relative overflow-hidden', sectionBg, className)}
      style={layoutStyle(props)}
    >
      {' '}
      <div
        className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop grid grid-cols-1 lg:grid-cols-2 items-center gap-6 md:gap-16"
        style={{ gap: `clamp(24px, 6vw, ${gap}px)` } as any}
      >
        {' '}
        <div
          className={cn('relative', imageFirstMobile ? 'order-1 lg:order-1' : 'order-2 lg:order-1')}
        >
          {' '}
          <div
            className="relative z-10 rounded-3xl overflow-hidden shadow-sm"
            style={{ border: `${imageBorder}px solid #fff` }}
          >
            {' '}
            {imageUrl && (
              <img
                src={imageUrl}
                alt={imageAlt}
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  e.currentTarget.style.visibility = 'hidden';
                }}
                className="w-full aspect-[4/3] object-cover"
              />
            )}{' '}
          </div>{' '}
          {decorativeCircles && (
            <>
              {' '}
              <div className="absolute -bottom-8 -end-8 w-48 h-48 bg-primary/5 rounded-full blur-3xl"></div>{' '}
              <div className="absolute -top-8 -start-8 w-64 h-64 bg-secondary/5 rounded-full blur-3xl"></div>{' '}
            </>
          )}{' '}
        </div>{' '}
        <div className={cn(imageFirstMobile ? 'order-2 lg:order-2' : 'order-1 lg:order-2')}>
          {puck.renderSlot('content')}
        </div>{' '}
      </div>{' '}
    </section>
  );
}
