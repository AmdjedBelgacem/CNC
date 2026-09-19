import { MATERIAL_SYMBOLS_HREF } from './material-symbols-href';
const HREF = MATERIAL_SYMBOLS_HREF;

/**
 * Server-rendered Material Symbols stylesheet.
 *
 * Must stay a Server Component (no `'use client'`) — it lives inside
 * `<head>` in the root layout. A Client Component there causes a
 * hydration mismatch: the server emits static `<link>`s while the
 * client hydrates with a different tree (preload + onLoad swap, etc.),
 * producing `Hydration failed ... <MaterialSymbols>` on `/`.
 *
 * Rendered as a normal `stylesheet` (not `preload` → `stylesheet` via
 * `onLoad`) so Puck's iframe `CopyHostStyles` can clone it. The old
 * `preload` swap happened after Puck's initial `querySelectorAll` and
 * was missed by its `childList` MutationObserver, leaving the canvas
 * iframe without the font (icons rendered as literal words like "star").
 */
export function MaterialSymbols() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={HREF} />
    </>
  );
}
