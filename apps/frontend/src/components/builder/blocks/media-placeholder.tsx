import type { CSSProperties } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Canvas/fallback treatment for an image slot that has no usable source.
 *
 * The editor needs to explain why the space is empty, but that explanation must
 * never leak onto the public site: a visitor should see a quiet blueprint
 * fallback, not "Image (set src)". Callers pass `editing` from Puck's context.
 */
export function MediaPlaceholder({
  editing,
  className,
  style,
  label = 'Image',
  aspectClass = 'min-h-40',
  detail = 'Upload an image in the inspector',
}: {
  editing: boolean;
  className?: string;
  style?: CSSProperties;
  label?: string;
  aspectClass?: string;
  detail?: string;
}) {
  return (
    <div
      className={cn(
        'relative flex w-full items-center justify-center overflow-hidden bg-surface-container-low',
        aspectClass,
        editing ? 'border-2 border-dashed border-border' : 'blueprint-grid',
        className,
      )}
      style={style}
      aria-hidden={!editing}
    >
      <div className="absolute inset-0 blueprint-grid opacity-50" aria-hidden="true" />
      {editing ? (
        <div className="relative flex max-w-[16rem] flex-col items-center gap-1 px-4 py-6 text-center text-muted-foreground">
          <ImageIcon className="size-5" aria-hidden="true" />
          <span className="text-xs font-semibold text-foreground">{label}</span>
          <span className="text-2xs leading-relaxed opacity-80">{detail}</span>
        </div>
      ) : null}
    </div>
  );
}
