/**
 * Utility classes the AI page builder may put in a block's `className`.
 *
 * Tailwind only emits CSS for classes it finds in source files, and layouts live in the
 * database, so a class the model invents ships as dead text. This file is inside the shared
 * package that the frontend's Tailwind `content` glob scans, so every class listed here is
 * guaranteed to exist in the production stylesheet. The backend uses the same list to drop
 * anything else before a layout is returned, so the two can never disagree.
 *
 * Colours come from the theme tokens (`bg-primary`, `text-text-muted`, ...) so AI-built
 * sections follow the site theme and dark mode. Exact one-off colours go through the typed
 * props (`bgColor`, `color`) instead, which render as inline styles.
 */
const layout = [
  'flex', 'inline-flex', 'grid', 'block', 'inline-block', 'hidden', 'contents',
  'flex-row', 'flex-col', 'flex-wrap', 'flex-1', 'shrink-0', 'grow',
  'items-start', 'items-center', 'items-end', 'items-stretch', 'items-baseline',
  'justify-start', 'justify-center', 'justify-end', 'justify-between', 'justify-around', 'justify-evenly',
  'self-start', 'self-center', 'self-end', 'place-items-center',
  'grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4', 'grid-cols-5', 'grid-cols-6', 'grid-cols-12',
  'col-span-1', 'col-span-2', 'col-span-3', 'col-span-4', 'col-span-6', 'col-span-full',
  'sm:grid-cols-2', 'sm:grid-cols-3', 'md:grid-cols-2', 'md:grid-cols-3', 'md:grid-cols-4',
  'lg:grid-cols-2', 'lg:grid-cols-3', 'lg:grid-cols-4', 'lg:grid-cols-5', 'lg:grid-cols-6',
  'md:col-span-2', 'lg:col-span-2', 'md:flex-row', 'lg:flex-row', 'md:items-center', 'md:justify-between',
  'sm:flex', 'md:flex', 'lg:flex', 'md:block', 'lg:block', 'md:hidden', 'lg:hidden', 'md:grid', 'lg:grid',
  'relative', 'absolute', 'sticky', 'inset-0', 'top-0', 'z-10', 'z-20',
  'w-full', 'h-full', 'w-auto', 'h-auto', 'w-fit', 'mx-auto', 'min-h-screen', 'aspect-video', 'aspect-square',
  'max-w-xs', 'max-w-sm', 'max-w-md', 'max-w-lg', 'max-w-xl', 'max-w-2xl', 'max-w-3xl', 'max-w-4xl',
  'max-w-5xl', 'max-w-6xl', 'max-w-7xl', 'max-w-prose',
  'overflow-hidden', 'overflow-x-auto', 'object-cover', 'object-contain',
] as const;

/* Written out literally: Tailwind's scanner cannot see classes built from template strings. */
const spacing = [
  'gap-0', 'gap-x-0', 'gap-y-0', 'p-0', 'px-0', 'py-0', 'pt-0', 'pb-0', 'm-0', 'mt-0', 'mb-0', 'space-y-0',
  'gap-1', 'gap-x-1', 'gap-y-1', 'p-1', 'px-1', 'py-1', 'pt-1', 'pb-1', 'm-1', 'mt-1', 'mb-1', 'space-y-1',
  'gap-2', 'gap-x-2', 'gap-y-2', 'p-2', 'px-2', 'py-2', 'pt-2', 'pb-2', 'm-2', 'mt-2', 'mb-2', 'space-y-2',
  'gap-3', 'gap-x-3', 'gap-y-3', 'p-3', 'px-3', 'py-3', 'pt-3', 'pb-3', 'm-3', 'mt-3', 'mb-3', 'space-y-3',
  'gap-4', 'gap-x-4', 'gap-y-4', 'p-4', 'px-4', 'py-4', 'pt-4', 'pb-4', 'm-4', 'mt-4', 'mb-4', 'space-y-4',
  'gap-5', 'gap-x-5', 'gap-y-5', 'p-5', 'px-5', 'py-5', 'pt-5', 'pb-5', 'm-5', 'mt-5', 'mb-5', 'space-y-5',
  'gap-6', 'gap-x-6', 'gap-y-6', 'p-6', 'px-6', 'py-6', 'pt-6', 'pb-6', 'm-6', 'mt-6', 'mb-6', 'space-y-6',
  'gap-8', 'gap-x-8', 'gap-y-8', 'p-8', 'px-8', 'py-8', 'pt-8', 'pb-8', 'm-8', 'mt-8', 'mb-8', 'space-y-8',
  'gap-10', 'gap-x-10', 'gap-y-10', 'p-10', 'px-10', 'py-10', 'pt-10', 'pb-10', 'm-10', 'mt-10', 'mb-10',
  'space-y-10', 'gap-12', 'gap-x-12', 'gap-y-12', 'p-12', 'px-12', 'py-12', 'pt-12', 'pb-12', 'm-12',
  'mt-12', 'mb-12', 'space-y-12', 'gap-16', 'gap-x-16', 'gap-y-16', 'p-16', 'px-16', 'py-16', 'pt-16',
  'pb-16', 'm-16', 'mt-16', 'mb-16', 'space-y-16', 'gap-20', 'gap-x-20', 'gap-y-20', 'p-20', 'px-20',
  'py-20', 'pt-20', 'pb-20', 'm-20', 'mt-20', 'mb-20', 'space-y-20', 'gap-24', 'gap-x-24', 'gap-y-24',
  'p-24', 'px-24', 'py-24', 'pt-24', 'pb-24', 'm-24', 'mt-24', 'mb-24', 'space-y-24',
] as const;

const responsiveSpacing = [
  'md:gap-4', 'md:p-4', 'md:px-4', 'md:py-4', 'lg:py-4', 'lg:px-4', 'md:gap-6', 'md:p-6', 'md:px-6',
  'md:py-6', 'lg:py-6', 'lg:px-6', 'md:gap-8', 'md:p-8', 'md:px-8', 'md:py-8', 'lg:py-8', 'lg:px-8',
  'md:gap-10', 'md:p-10', 'md:px-10', 'md:py-10', 'lg:py-10', 'lg:px-10', 'md:gap-12', 'md:p-12', 'md:px-12',
  'md:py-12', 'lg:py-12', 'lg:px-12', 'md:gap-16', 'md:p-16', 'md:px-16', 'md:py-16', 'lg:py-16', 'lg:px-16',
  'md:gap-20', 'md:p-20', 'md:px-20', 'md:py-20', 'lg:py-20', 'lg:px-20', 'md:gap-24', 'md:p-24', 'md:px-24',
  'md:py-24', 'lg:py-24', 'lg:px-24',
] as const;

const type = [
  'text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl', 'text-6xl', 'text-7xl',
  'md:text-xl', 'md:text-2xl', 'md:text-3xl', 'md:text-4xl', 'md:text-5xl', 'md:text-6xl', 'lg:text-5xl', 'lg:text-6xl', 'lg:text-7xl',
  'font-normal', 'font-medium', 'font-semibold', 'font-bold', 'font-extrabold', 'font-mono', 'italic', 'uppercase', 'capitalize',
  'leading-none', 'leading-tight', 'leading-snug', 'leading-normal', 'leading-relaxed', 'leading-loose',
  'tracking-tighter', 'tracking-tight', 'tracking-normal', 'tracking-wide', 'tracking-wider', 'tracking-widest',
  'text-left', 'text-center', 'text-right', 'text-start', 'text-end', 'md:text-left', 'md:text-start',
  'line-clamp-2', 'line-clamp-3', 'truncate', 'whitespace-nowrap', 'text-balance', 'text-pretty', 'underline',
] as const;

const color = [
  'text-foreground', 'text-muted-foreground', 'text-text-muted', 'text-primary', 'text-primary-foreground',
  'text-secondary-foreground', 'text-white', 'text-black',
  'bg-background', 'bg-card', 'bg-muted', 'bg-primary', 'bg-secondary', 'bg-surface-sunken', 'bg-white', 'bg-black',
  'bg-primary/5', 'bg-primary/10', 'bg-primary/20', 'bg-muted/50', 'bg-card/80', 'bg-black/40', 'bg-white/10',
  'bg-gradient-to-r', 'bg-gradient-to-b', 'bg-gradient-to-br', 'from-primary', 'to-primary/60', 'from-background', 'to-muted',
  'border', 'border-0', 'border-2', 'border-t', 'border-b', 'border-border', 'border-primary', 'border-primary/30',
  'border-glass-border', 'border-white/10', 'divide-y', 'divide-border',
] as const;

const surface = [
  'rounded', 'rounded-md', 'rounded-lg', 'rounded-xl', 'rounded-2xl', 'rounded-3xl', 'rounded-full', 'rounded-none',
  'shadow-sm', 'shadow', 'shadow-md', 'shadow-lg', 'shadow-xl', 'shadow-2xl', 'shadow-none',
  'ring-1', 'ring-border', 'backdrop-blur', 'backdrop-blur-md', 'opacity-50', 'opacity-70', 'opacity-80',
  'transition', 'transition-all', 'transition-colors', 'transition-transform', 'duration-200', 'duration-300', 'duration-500',
  'hover:shadow-lg', 'hover:-translate-y-1', 'hover:scale-105', 'hover:bg-muted', 'hover:text-primary', 'hover:opacity-90',
  'group', 'group-hover:scale-105', 'cursor-pointer', 'select-none',
] as const;

export const AI_SAFE_CLASSES: readonly string[] = Array.from(
  new Set<string>([...layout, ...spacing, ...responsiveSpacing, ...type, ...color, ...surface]),
);

const SAFE = new Set(AI_SAFE_CLASSES);

/**
 * Keeps only classes that are guaranteed to compile. `extra` admits classes the page already
 * uses (seeded sections carry hand-written mockup classes), so an AI edit never strips a class
 * that was working before.
 */
export function sanitizeAiClassName(value: unknown, extra?: ReadonlySet<string>): string | undefined {
  if (typeof value !== 'string') return undefined;
  const kept = value
    .split(/\s+/)
    .filter((token) => token && (SAFE.has(token) || extra?.has(token)));
  const joined = Array.from(new Set(kept)).join(' ').slice(0, 300).trim();
  return joined || undefined;
}
