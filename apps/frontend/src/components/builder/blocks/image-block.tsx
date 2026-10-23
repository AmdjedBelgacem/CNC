'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import type { ImageProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';
import { MediaPlaceholder } from './media-placeholder';

const RADIUS_CLASS: Record<string, string> = {
  none: '',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
};

export function ImageBlock({ props, puck }: BlockComponentProps<ImageProps>) {
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
  const [failed, setFailed] = useState(false);
  // A replaced source deserves a fresh attempt; without this an image that
  // failed once would stay hidden after the author uploaded a new file.
  useEffect(() => setFailed(false), [src]);

  const style: CSSProperties = { ...layoutStyle(props) };
  const aspectClass =
    aspectRatio === '4/3' ? 'aspect-[4/3]' : aspectRatio === '16/10' ? 'aspect-[16/10]' : '';
  const rounded = RADIUS_CLASS[radius ?? 'none'];
  const editing = Boolean(puck?.isEditing);
  const placeholderStyle: CSSProperties =
    width && height ? { ...style, width, height, maxWidth: '100%' } : style;
  const placeholderClass = cn(aspectClass || (width && height ? '' : 'min-h-40'), rounded);

  if (!src || failed) {
    // Authoring hint only. A visitor should never see "Image (set src)" or an
    // empty dashed box on a live page.
    if (!editing) return null;
    return (
      <MediaPlaceholder
        editing
        className={placeholderClass}
        style={placeholderStyle}
        label={failed ? 'Image failed to load' : 'Image'}
        aspectClass={aspectClass || (width && height ? '' : 'min-h-40')}
        detail={failed ? 'Check the URL or upload a new image' : undefined}
      />
    );
  }

  const hideOnError = () => setFailed(true);

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
  if (aspectRatio === 'none') {
    return (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={hideOnError}
        className={cn('block max-w-full h-auto', rounded, className)}
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
