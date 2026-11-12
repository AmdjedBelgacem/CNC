import type { CSSProperties } from 'react';
import type { HeadingProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { colorProp, layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index'; /** Base treatment per tag (applied when no size is set). */
const HEADING_BASE: Record<string, string> = {
  h1: 'font-display font-medium tracking-[-0.022em] text-balance text-text-primary',
  h2: 'font-display font-medium tracking-[-0.02em] text-balance text-text-primary',
  h3: 'font-display font-medium tracking-[-0.015em] text-text-primary',
  h4: 'font-display font-medium tracking-[-0.01em] text-text-primary',
  span: 'font-display font-medium text-text-primary',
  strong: 'font-display font-medium text-text-primary',
}; /** Mockup heading treatments (a size replaces the base font/colour classes entirely). */
const HEADING_SIZE: Record<string, string> = {
  hero: 'font-display font-medium text-[clamp(2.5rem,7vw,3.5rem)] md:text-[clamp(3.25rem,5.2vw,4.75rem)] leading-[1.04] tracking-[-0.028em] break-words',
  'headline-lg': 'font-display font-medium text-[clamp(1.875rem,5vw,3rem)] leading-[1.08] tracking-[-0.022em] text-balance break-words',
  'headline-md': 'font-display font-medium text-headline-md tracking-[-0.018em] text-balance break-words',
  stats: 'font-display font-medium text-[clamp(2.25rem,6vw,2.75rem)] leading-none tracking-[-0.025em] tabular-nums',
  '2xl': 'font-display font-medium text-2xl tracking-[-0.015em] break-words',
  xl: 'font-display font-medium text-xl tracking-[-0.012em] break-words',
  lg: 'font-display font-medium text-lg tracking-[-0.01em] break-words',
  md: 'font-display font-medium text-base break-words',
  sm: 'font-display font-medium text-sm break-words',
  // Labels are UI, not voice: sentence-case muted sans.
  label: 'font-sans text-[13px] font-medium break-words',
  logo: 'font-display font-medium text-xl md:text-2xl tracking-[-0.015em] break-words',
  // The shared fluid section title (`.section-title`).
  section: '',
}; /** Letter-spacing + line-height overrides (literal classes so Tailwind picks them up). */
const TRACKING_CLASS: Record<string, string> = {
  '0.025em': 'tracking-[0.025em]',
  '0.05em': 'tracking-[0.05em]',
  // The wide presets are tempered: Ivory & Clay labels are quiet, so even an
  // authored "wide" setting stays close to the type's natural spacing.
  '0.1em': 'tracking-[0.05em]',
  '0.15em': 'tracking-[0.06em]',
  '0.2em': 'tracking-[0.07em]',
};
const LEADING_CLASS: Record<string, string> = {
  tight: 'leading-tight',
  snug: 'leading-snug',
  normal: 'leading-normal',
  relaxed: 'leading-relaxed',
  loose: 'leading-loose',
};
export function HeadingBlock({ props }: BlockComponentProps<HeadingProps>) {
  const { as = 'h2', text = '', align, color, size, tracking, leading, accentText, suffixText, className } = props;
  const Tag = as;
  const tint = colorProp(color);
  const style: CSSProperties = { ...layoutStyle(props), ...tint.style };
  if (align) style.textAlign = align;
  const sizing = size ? HEADING_SIZE[size] : HEADING_BASE[as];
  const isHero = size === 'hero';
  return (
    <Tag
      className={cn(
        sizing,
        color ? tint.className : 'text-text-primary',
        tracking && tracking !== 'none' && TRACKING_CLASS[tracking],
        leading && leading !== 'none' && LEADING_CLASS[leading],
        className,
      )}
      style={style}
    >
      {' '}
      {text.split('\n').map((line, i) => (
        <span key={i} className={isHero ? 'inline md:inline' : undefined}>
          {' '}
          {i > 0 && <br />} {line} {isHero && i === 0 ? ' ' : ''}{' '}
        </span>
      ))}{' '}
      {accentText ? (
        <>
          {' '}
          <span className="font-normal italic text-primary">{accentText}</span>{' '}
        </>
      ) : null}
      {suffixText ? ` ${suffixText}` : null}
    </Tag>
  );
}
