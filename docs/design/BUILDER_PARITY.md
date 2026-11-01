# Builder ↔ production parity

The admin builder (Puck canvas) and the public site render the **same block
components**, so most of a page cannot drift. What can drift is everything around
the blocks. This note lists what keeps those parts in step, and how it was checked.

## One source for each shared thing

| Thing | Single source | Used by |
|---|---|---|
| Island section padding, header type scale | `packages/shared/src/constants/island-style.ts` (`ISLAND_PAD`, `ISLAND_HEAD`) | public island components, builder header wrapper, header seeds |
| Island header seeds (editable blocks) | `packages/shared/src/blocks/live-island-parts.ts` | builder, and production once a page is saved |
| FAQ / guides / about seeds | `apps/frontend/src/lib/builder/fixed-island-seeds.ts` | same, mirrors `home-extras.tsx` |
| Course → card mapping | `courseToCardProps` in `program-cards-block.tsx` | `HomeBuilder`, canvas |
| Sponsor wordmark | `builder/blocks/sponsor-wordmark.tsx` | `HomeBuilder`, canvas |
| Legal page frame | `LegalDocument`, applied in the canvas by `BuilderPageFrame` | `/privacy`, `/terms`, `/refunds`, canvas |

**Why seeds matter.** An unsaved page renders the hard-coded defaults in the island
components. The builder shows seeded blocks instead. The first save writes those
seeds into the layout, and from then on they *are* production. A seed that differs from
its default therefore restyles the page the moment someone publishes. Change the
default and its seed together; `tests/island-style.test.ts` guards the shared parts.

## What the canvas cannot reproduce on its own

Puck wraps every block in a `DropZone` and its own element. Production has no such
layer, so rules that address a container's *direct children* stop matching:

- `space-y-*` and `.logo-row > *` are re-applied one level down in `CANVAS_CSS`
  (`builder-editor.tsx`).
- A block that renders nothing keeps an empty wrapper; `[data-puck-component]:empty`
  is hidden so it does not take a grid cell.
- Wrapping flex rows size the *wrappers*, not the blocks. Prefer a grid for seeded
  headers that must stack on mobile (see `products-inventory`).
- Stack direction is a CSS variable and **inherits into nested stacks**; do not set
  it from a class on a stack that contains other stacks.

## Not in the canvas

The site chrome (announcement bar, navigation, footer) is not drawn in the canvas.
`Footer` is an async server component, so it cannot render inside the client canvas.

## How parity was measured

Per top-level section, at 1280 / 768 / 390 px, light and dark: height, width,
padding and background in production against the canvas, with every page both
unsaved (production = defaults) and after publishing through the builder UI
(production = the saved layout). Result on the final code:

- 1280 px: 43 of 43 sections within 3 px, unsaved and published.
- 390 px: every section within 3 px except the home hero (8 px).
- 768 px: every section within 3 px except the home program cards (42 px, one
  card row wraps differently; not yet traced).
- Dark mode matched on the build before the last header change; not re-measured.

Existing saved layouts keep whatever seeds they were saved with. To pick up new
seeds on a page, use the builder's page reset, then republish.
