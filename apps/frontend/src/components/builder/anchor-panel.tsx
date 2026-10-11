'use client';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * A popover that escapes its ancestor's clipping and stacking contexts.
 *
 * Both builder popovers (Add Block, Saved Sections) live in the editor's toolbox bar, which is
 * `overflow-x-auto` so the toolbar can scroll on narrow screens. That is a hard clipping
 * ancestor: one non-`visible` axis makes the other compute to `auto`, so an absolutely-positioned
 * dropdown inside it is trapped in the 44px-tall bar and painted under the layers sidebar. The
 * menu was therefore reachable only if it happened to be inside the scroll window.
 *
 * Portalling to `document.body` with `position: fixed` coordinates taken from the trigger's
 * rectangle sidesteps clipping, stacking contexts and transformed ancestors entirely. The
 * position is recomputed on scroll and resize, and flipped below the trigger when there is not
 * room underneath.
 */
export interface AnchorPanelProps {
  /** Element the panel is positioned against. */
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  onDismiss: () => void;
  children: ReactNode;
  /** Minimum width; the panel also matches the anchor when it is wider. */
  minWidth?: number;
  /** Height of the space above the trigger reserved for footers/hints. */
  gap?: number;
}

const VIEWPORT_MARGIN = 8;

export function AnchorPanel({
  anchorRef,
  open,
  onDismiss,
  children,
  minWidth = 320,
  gap = 6,
}: AnchorPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const place = () => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;

    const spaceBelow = vh - rect.bottom - gap - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - gap - VIEWPORT_MARGIN;
    // Flip above when below is too cramped to be usable and above is roomier.
    const flip = spaceBelow < 240 && spaceAbove > spaceBelow;

    const maxHeight = Math.max(160, flip ? spaceAbove : spaceBelow);
    const width = Math.max(minWidth, rect.width);

    // Keep the panel on screen; the trigger is near the left edge of a full-width toolbar.
    const left = Math.min(
      Math.max(VIEWPORT_MARGIN, rect.left),
      Math.max(VIEWPORT_MARGIN, vw - width - VIEWPORT_MARGIN),
    );
    const top = flip ? rect.top - gap - maxHeight : rect.bottom + gap;

    setStyle({ top, left, width, maxHeight });
  };

  // Position before paint so the panel never flashes at the wrong place.
  useLayoutEffect(() => {
    if (!open) return;
    place();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => place();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open]);

  // Dismiss on outside click or Escape. `pointerdown` so it fires before a click lands on a row.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onDismiss();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onDismiss();
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open, onDismiss, anchorRef]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={panelRef}
      role="presentation"
      style={{
        position: 'fixed',
        top: style?.top ?? -9999,
        left: style?.left ?? -9999,
        width: style?.width ?? minWidth,
        maxHeight: style?.maxHeight ?? undefined,
        // Above the layers sidebar (z-40) and any editor chrome, below modal dialogs (z-[60]).
        zIndex: 55,
      }}
      className="flex flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-lg"
    >
      {children}
    </div>,
    document.body,
  );
}
