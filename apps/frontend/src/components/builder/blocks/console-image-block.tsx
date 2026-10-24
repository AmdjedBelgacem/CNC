import { useEffect, useState } from 'react';
import type { ConsoleImageProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';

/** Machine image inside the console viewport. */
export function ConsoleImageBlock({ props, puck }: BlockComponentProps<ConsoleImageProps>) {
  const { src, alt = '', objectFit = 'cover', opacity = 100, className } = props;
  const [failed, setFailed] = useState(false);
  // A replaced source deserves a fresh attempt; without this an image that
  // failed once would stay hidden after the author uploaded a new file.
  useEffect(() => setFailed(false), [src]);
  const editing = Boolean(puck?.isEditing);

  if (!src || failed) {
    if (!editing) return null;
    return (
      <span className="absolute start-1/2 top-4 z-30 -translate-x-1/2 rounded bg-background/90 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shadow-sm">
        {failed ? 'Image failed' : 'Add console image'}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="eager"
      decoding="async"
      onError={() => setFailed(true)}
      className={cn(
        'absolute inset-0 h-full w-full !pointer-events-auto',
        objectFit === 'contain' ? 'object-contain' : 'object-cover',
        className,
      )}
      style={{ ...layoutStyle(props), opacity: opacity / 100 }}
    />
  );
}
