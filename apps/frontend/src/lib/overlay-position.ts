/**
 * Trigger-anchored overlay positioning.
 *
 * Both floating surfaces (the notification panel and the AI assistant) open relative to
 * their own trigger button rather than to a viewport corner, so the two always read as a
 * pair. The shared rules are:
 *
 *  - coordinates are **physical**, because they come from `getBoundingClientRect()`. The
 *    result is applied with `left`/`top`; a logical `start`/`end` would resolve to the
 *    opposite edge under `dir="rtl"` and push the panel off-screen in Arabic.
 *  - the width never exceeds the viewport, and the horizontal position is clamped inside
 *    both gutters, so a narrow window can never produce a negative `left`.
 *  - the height never exceeds the space actually available, so a panel cannot render
 *    taller than the screen and push its own footer off the bottom.
 */

/** Viewport dimensions. */
export interface ViewportSize {
  width: number;
  height: number;
}

/** Resolved physical box for the overlay panel. */
export interface OverlayPosition {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface TriggerBox {
  /** Physical distance from the left viewport edge to the trigger's right edge. */
  right: number;
  /** Physical distance from the top viewport edge to the trigger's bottom edge. */
  bottom: number;
  /** Physical distance from the top viewport edge to the trigger's top edge. */
  top: number;
}

const GUTTER = 12;
const GAP = 12;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Panel width: capped, but never so wide that it cannot be placed on screen. */
export function overlayWidth(viewportWidth: number, maxWidth = 420): number {
  return Math.min(maxWidth, Math.max(280, viewportWidth - GUTTER * 2));
}

/**
 * Opens **below** the trigger, right-aligned with it — used by the notification bell.
 */
export function positionBelow(
  trigger: TriggerBox,
  viewport: ViewportSize,
  options: { maxWidth?: number; maxHeight?: number; minSpaceBelow?: number } = {},
): OverlayPosition {
  const { maxWidth = 420, maxHeight = 680, minSpaceBelow = 120 } = options;
  const width = overlayWidth(viewport.width, maxWidth);
  const left = clamp(trigger.right - width, GUTTER, Math.max(GUTTER, viewport.width - width - GUTTER));
  // Leave room for the body so the panel is not squeezed to nothing on short viewports.
  const top = clamp(trigger.bottom + GAP, GUTTER, Math.max(GUTTER, viewport.height - minSpaceBelow));
  const height = Math.max(0, Math.min(maxHeight, viewport.height - top - GUTTER));
  return { left, top, width, height };
}

/**
 * Opens **above** the trigger, right-aligned with it — used by the AI assistant FAB.
 */
export function positionAbove(
  trigger: TriggerBox,
  viewport: ViewportSize,
  options: { maxWidth?: number; maxHeight?: number } = {},
): OverlayPosition {
  const { maxWidth = 420, maxHeight = 640 } = options;
  const width = overlayWidth(viewport.width, maxWidth);
  const left = clamp(trigger.right - width, GUTTER, Math.max(GUTTER, viewport.width - width - GUTTER));
  // The panel's bottom edge sits one gap above the trigger's top edge. Measured from the
  // viewport top, so it is `trigger.top - GAP` — NOT a distance up from the viewport
  // bottom, which pinned the panel to the top of the screen on tall viewports.
  const bottomEdge = trigger.top - GAP;
  const height = Math.max(
    0,
    Math.min(maxHeight, bottomEdge - GUTTER, viewport.height - GUTTER * 2),
  );
  const top = Math.max(GUTTER, bottomEdge - height);
  return { left, top, width, height };
}

/** Reads the physical trigger box a measurement effect needs. */
export function triggerBox(rect: {
  top: number;
  bottom: number;
  right: number;
}): TriggerBox {
  return { right: rect.right, bottom: rect.bottom, top: rect.top };
}

/**
 * The viewport the panel must fit inside.
 *
 * Uses `documentElement.clientWidth/clientHeight`, NOT `window.innerWidth/innerHeight`.
 * When a page overflows horizontally the two disagree: `innerWidth` includes the
 * overflowing content, so on a 360px-wide phone whose document scrolled to 390px the
 * panel was sized 366px wide and hung 6px off both edges. `clientWidth` is the actual
 * visible layout viewport, which is what "keep it on screen" has to mean.
 */
export function visibleViewport(): ViewportSize {
  const root = typeof document !== 'undefined' ? document.documentElement : null;
  const width = root?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 0);
  const height = root?.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 0);
  return { width, height };
}