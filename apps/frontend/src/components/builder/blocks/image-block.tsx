import type { CSSProperties } from 'react';
import type { ImageProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';
const RADIUS_CLASS: Record<string, string> = {
  none: '',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
};
export function ImageBlock({ props }: BlockComponentProps<ImageProps>) {
  const {
    src,
    alt = '',
    width,
    height,
    objectFit = 'cover',
    radius = 'none',
    aspectRatio = 'none',
    className,
  } = props;
  const style: CSSProperties = { ...layoutStyle(props) };
  if (!src) {
    return (
      <div
        className="flex h-40 w-full items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground"
        style={style}
      >
        {' '}
        Image (set src){' '}
      </div>
    );
  }
  const aspectClass =
    aspectRatio === '4/3' ? 'aspect-[4/3]' : aspectRatio === '16/10' ? 'aspect-[16/10]' : '';
  const rounded = RADIUS_CLASS[radius ?? 'none'];
  const hideOnError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.style.visibility = 'hidden';
  };
  if (width && height) {
    return (
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        onError={hideOnError}
        className={cn(rounded, className)}
        style={{ objectFit, ...style }}
      />
    );
  }
  return (
    <div className={cn('relative overflow-hidden', aspectClass, rounded)} style={style}>
      {' '}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={hideOnError}
        className={cn('absolute inset-0 w-full h-full', className)}
        style={{ objectFit }}
      />{' '}
    </div>
  );
}
