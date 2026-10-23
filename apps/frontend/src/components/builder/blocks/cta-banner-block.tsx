import type { CtaBannerProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';

/** Stored banner presets → responsive classes that also work on narrow screens. */
const BANNER_PADDING: Record<string, string> = {
  'p-8 md:p-16': 'p-6 sm:p-8 md:p-16',
  'p-12 md:p-24': 'p-6 sm:p-8 md:p-12 lg:p-24',
  'p-16 md:p-32': 'p-6 sm:p-10 md:p-16 lg:p-32',
};

/**
 * A CSS `url()` value, but only for ordinary web URLs.
 *
 * The stored value may be a relative upload path or a remote CDN URL. Quotes,
 * backslashes and newlines would let it escape the `url()` token, so they are
 * percent-encoded; non-http(s) schemes are rejected.
 */
function safeCssImageUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) && !/^https?:/i.test(trimmed)) return undefined;
  return trimmed.replace(/["\\\n\r]/g, (char) => encodeURIComponent(char));
}

/** Gradient banner over a background image with copy + side card columns. */
export function CtaBannerBlock({ props, puck }: BlockComponentProps<CtaBannerProps>) {
  const {
    id,
    imageUrl,
    overlayColor = '#C2410C',
    overlayOpacity = 90,
    radialVeil = true,
    padding: paddingProp,
    gap = 64,
    radius = 'rounded-3xl',
    copyWidth = 'lg:w-3/5',
    sideWidth = 'lg:w-2/5',
    className,
    sectionBg = '',
  } = props;
  const padding = BANNER_PADDING[paddingProp ?? ''] ?? 'p-6 sm:p-8 md:p-12 lg:p-16';
  const rgb = /^#([0-9a-fA-F]{6})$/.exec(overlayColor);
  const overlayRgb = rgb?.[1]
    ? `${parseInt(rgb[1].slice(0, 2), 16)},${parseInt(rgb[1].slice(2, 4), 16)},${parseInt(rgb[1].slice(4, 6), 16)}`
    : '194,65,12';
  const image = safeCssImageUrl(imageUrl);
  const gradient = `linear-gradient(rgba(${overlayRgb},${overlayOpacity / 100}),rgba(${overlayRgb},${overlayOpacity / 100}))${image ? `,url("${image}")` : ''}`;
  return (
    <section
      id={id}
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
