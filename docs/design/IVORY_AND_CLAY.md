# Ivory & Clay — design system

The product's visual language: a calm, editorial, Claude-style interface. Warm
ivory paper, a clay (terracotta) accent used sparingly, book-serif headlines,
a neutral sans for UI, soft hairlines, and motion that feels physical but quiet.

The tokens live in `apps/frontend/src/styles/globals.css` and mirror
`DEFAULT_THEME_TOKENS` in `packages/shared/src/constants/theme-defaults.ts`.
Tenants can re-theme via the theme editor, so **never hardcode colours** —
always use the Tailwind token utilities below.

## Principles

1. **Paper, not chrome.** Surfaces are ivory (`bg-background`) with white cards
   (`bg-card`) and hairline borders (`border-border/70`–`border-border`).
   Shadows are soft and diffuse (`shadow-xs`/`shadow-sm` at rest, `shadow-lg`
   on hover/elevated). No heavy outlines, no neon glows, no gradients on text.
2. **Clay is a highlight, not a fill.** `primary` is for the single main CTA in
   a view, active states, links and small accents (dots, focus rings). Large
   areas use neutrals. Secondary actions use `variant="outline"` or `ghost`.
3. **Serif for voice, sans for work.** Page titles, section titles, card titles
   on marketing/content surfaces, dialog titles, big numbers → `font-display`
   (Source Serif) at `font-medium`, `tracking-[-0.015em]`–`tracking-[-0.022em]`,
   `text-balance`. Body, labels, tables, forms, nav → sans (default). Dense
   admin tables stay sans; admin page titles use serif.
4. **Quiet labels.** Replace mono/uppercase/wide-tracked "industrial" labels
   (`font-mono uppercase tracking-[0.18em] text-[11px]`) with sentence-case
   sans: `text-xs font-medium text-muted-foreground` (or the `.eyebrow` class,
   which renders a clay dot + muted sans label). Keep `font-mono` only for real
   code, G-code, IDs, SKUs, numeric readouts and keyboard hints.
5. **Generous rhythm.** Prefer more whitespace: section padding `py-20 md:py-28`
   on marketing pages, `gap-6`/`gap-8` grids, card padding `p-6`. Max reading
   width `max-w-2xl`/`max-w-prose` for copy.
6. **Rounded, not bubbly.** Cards `rounded-2xl` (marketing) / `rounded-xl`
   (app/admin); inputs/buttons `rounded-lg`; chips/badges/pills `rounded-full`;
   avatars `rounded-full`. Radii derive from `--radius`, so use the scale.
7. **Accessible always.** Keep every aria attribute, label, focus style, RTL
   logical property (`ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-`) and i18n `t()` call.
   Never replace translated strings with literals. Contrast ≥ 4.5:1 for text.

## Tokens (Tailwind utilities)

| Role | Utilities |
| --- | --- |
| Page | `bg-background text-foreground` |
| Card / surface | `bg-card`, `bg-surface-raised`, `bg-muted` (tinted wells), `bg-surface-sunken` |
| Text | `text-foreground`, `text-muted-foreground`, `text-primary` (links/accents) |
| Lines | `border-border`, `border-border/70` (hairline), `border-border-strong` (hover) |
| Brand | `primary` (clay), `secondary` (slate), `accent` (sage) |
| Feedback | `success`, `warning`, `info`, `destructive` — use soft forms: `bg-success/10 text-success` |
| Overlay | `bg-overlay/45 backdrop-blur-[3px]` |
| Helpers | `.eyebrow`, `.section-title`, `.headline`, `.panel`, `.card-hover`, `.ambient-wash`, `.hairline`, `.link-pill`, `.blueprint-grid` (now a faint dot field) |

Status/tone colours that were raw Tailwind palette (`bg-blue-500`, `text-emerald-600`
…) should move to the semantic tokens where the meaning is semantic; purely
categorical colours (chart series, avatar tints) may stay but should be muted
(`/10`–`/15` backgrounds, `-700`/`-300` text in light/dark).

## Components (`@/components/ui/*`)

Use these rather than hand-rolling: `Button` (variants default/outline/ghost/
subtle/secondary/link/destructive), `Card*`, `Badge` (pill), `Input`/`Textarea`,
`Select`, `Switch` (springy knob), `Tabs` (spring-sliding pill), `DropdownMenu`,
`Tooltip` (ink chip), `Dialog*` (Framer-animated; `DialogHeader`, `DialogBody`,
`DialogFooter`), `Modal` (admin detail modal), `EmptyState`/`ErrorState`/
`LoadingState`, `Skeleton*`, `Progress`.

**Modals:** any hand-rolled overlay (`fixed inset-0 …`) should either move to
`Dialog`, or, if it must stay custom, animate with `AnimatePresence` + `m.div`
using `dialogMotion.overlay` / `dialogMotion.surface` from `@/components/ui/dialog`
and the `DIALOG_SURFACE_CLASS` look. Drawers slide from the inline-end on
`spring.gentle`, scrim fades.

## Motion (`framer-motion`)

The app runs `LazyMotion` in **strict** mode — always import `m` (never
`motion`) from `framer-motion`, or use the wrappers in `@/components/ui/motion`.
Tokens: `@/lib/motion` (`duration`, `ease`, `spring`, `transition`, `fadeUp`,
`fadeScale`, `fade`, `stagger`, `staggerItem`).

| Pattern | Use |
| --- | --- |
| `<Reveal>` | Section/heading entering on scroll (fade + 14px rise). |
| `<Stagger>` + `<StaggerItem>` | Grids and lists cascading in. Cap at ~12 animated items. |
| `<HoverLift>` / `.card-hover` | Clickable cards lift 3–4px on hover. |
| `<PressScale>` / `.pressable` | Press feedback (Button already has it). |
| `<Crossfade value={key}>` | Swapping content in place (filters, steps, tab bodies). |
| `<AnimatedNumber value>` | Stats/KPIs counting up. |
| `m.span layoutId=…` | Sliding active indicators in nav, segmented controls, filters. |
| `AnimatePresence` | Anything mounting/unmounting: toasts, banners, menus, list rows, inline errors. |
| `layout` prop | Lists that reorder/filter, accordions that expand. |

Rules: travel 4–16px; entrances decelerate (`ease.emerge`), exits ~40% faster;
interactive things use springs; never animate a page wrapper to `opacity: 0`
(see `page-transition.tsx`); server components stay server components — put
motion in small client leaves (`'use client'`) rather than converting whole
pages; reduced motion is handled globally by `MotionProvider`.

Use `<Reveal>`/`<Stagger>` initial-hidden states only for content below the fold
or in client components; never hide LCP content (the hero headline) behind an
animation that needs JS — animate it with `initial={false}`-safe patterns or
CSS `animate-fade-in-up`.
