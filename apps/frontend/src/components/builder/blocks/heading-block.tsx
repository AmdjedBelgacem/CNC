import type { CSSProperties } from 'react';
import type { HeadingProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index'; /** Base treatment per tag (applied when no size is set). */
const HEADING_BASE: Record<string, string> = {
  h1: 'font-display-hero text-text-primary',
  h2: 'font-headline-lg text-text-primary',
  h3: 'font-headline-md text-text-primary',
  h4: 'font-headline-md text-text-primary',
  span: 'font-headline-md text-text-primary',
  strong: 'font-headline-md text-text-primary',
}; /** Mockup heading treatments (a size replaces the base font/colour classes entirely). */
const HEADING_SIZE: Record<string, string> = {
  hero: 'font-display-hero text-[clamp(32px,8vw,54px)] md:text-display-hero leading-[1.1] break-words',
  'headline-lg': 'font-headline-lg text-[clamp(28px,7vw,44px)] break-words',
  'headline-md': 'font-headline-md text-headline-md break-words',
  stats: 'font-stats-number text-[clamp(32px,8vw,40px)] tracking-tighter',
  '2xl': 'font-headline-md text-2xl break-words',
  xl: 'font-headline-md text-xl break-words',
  lg: 'font-headline-md text-lg break-words',
  md: 'font-headline-md text-base break-words',
  sm: 'font-headline-md text-sm break-words',
  label: 'font-label-sm text-[11px] uppercase tracking-[0.2em] font-bold break-words',
  logo: 'font-headline-lg text-xl md:text-2xl break-words',
}; /** Letter-spacing + line-height overrides (literal classes so Tailwind picks them up). */
const TRACKING_CLASS: Record<string, string> = {
  '0.025em': 'tracking-[0.025em]',
  '0.05em': 'tracking-[0.05em]',
  '0.1em': 'tracking-[0.1em]',
  '0.15em': 'tracking-[0.15em]',
  '0.2em': 'tracking-[0.2em]',
};
const LEADING_CLASS: Record<string, string> = {
  tight: 'leading-tight',
  snug: 'leading-snug',
  normal: 'leading-normal',
  relaxed: 'leading-relaxed',
  loose: 'leading-loose',
};
export function HeadingBlock({ props }: BlockComponentProps<HeadingProps>) {
  const { as = 'h2', text = '', align, color, size, tracking, leading, className } = props;
  const Tag = as;
  const style: CSSProperties = { ...layoutStyle(props) };
  if (align) style.textAlign = align;
  const sizing = size ? HEADING_SIZE[size] : HEADING_BASE[as];
  const isHero = size === 'hero';
  return (
    <Tag
      className={cn(
        sizing,
        color ?? 'text-text-primary',
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
    </Tag>
  );
}
