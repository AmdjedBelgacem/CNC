import Link from 'next/link';
import type { AcademyCardProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import { isInternalHref } from '@/lib/builder/href';
import type { BlockComponentProps } from './index'; /** Course card: media on top, padded content below. */
export function AcademyCardBlock({ props, puck }: BlockComponentProps<AcademyCardProps>) {
  const { href, contentPadding = 'p-8', radius = 'rounded-3xl', mediaAspect, className } = props;
  const media = puck.renderSlot('media');
  const inner = (
    <>
      {' '}
      {mediaAspect ? <div className={mediaAspect}>{media}</div> : media}{' '}
      <div className={contentPadding}>{puck.renderSlot('content')}</div>{' '}
    </>
  );
  return (
    <div
      className={cn(
        'bg-white border border-gray-200 overflow-hidden transition-all duration-300 group',
        radius,
        className,
      )}
      style={layoutStyle(props)}
    >
      {' '}
      {href && isInternalHref(href) ? (
        <Link href={href} className="block">
          {inner}
        </Link>
      ) : href ? (
        <a href={href} className="block">
          {inner}
        </a>
      ) : (
        inner
      )}{' '}
    </div>
  );
}
