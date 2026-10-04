import type { CSSProperties } from 'react';
import type { TextProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index'; /** Mockup label/body treatments: 2xs = 10px, xs = 11px, sm = 12px, md = 16px, lg = 18px. */
const TEXT_SIZE: Record<string, string> = {
  '2xs': 'font-label-sm text-2xs',
  xs: 'font-label-sm text-2xs',
  sm: 'font-label-sm text-xs',
  md: 'font-body-md text-body-md',
  lg: 'font-body-lg text-body-lg',
};
const WEIGHT_CLASS: Record<string, string> = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
};
/** Letter-spacing map (literal classes so Tailwind picks them up — never interpolate). */
const TRACKING_CLASS: Record<string, string> = {
  '0.025em': 'tracking-[0.025em]',
  '0.05em': 'tracking-[0.05em]',
  '0.1em': 'tracking-[0.1em]',
  '0.15em': 'tracking-[0.15em]',
  '0.2em': 'tracking-[0.2em]',
};
const ALIGN_CLASS: Record<string, string> = { center: 'text-center', right: 'text-right' };
const LEADING_CLASS: Record<string, string> = {
  tight: 'leading-tight',
  snug: 'leading-snug',
  normal: 'leading-normal',
  relaxed: 'leading-relaxed',
  loose: 'leading-loose',
};
export function TextBlock({ props }: BlockComponentProps<TextProps>) {
  const {
    text = '',
    align,
    color,
    size = 'md',
    uppercase,
    tracking,
    weight = 'normal',
    opacity,
    leading,
    className,
  } = props;
  const style: CSSProperties = { ...layoutStyle(props) };
  if (opacity !== undefined) style.opacity = opacity / 100;
  const isHex = color?.startsWith('#');
  return (
    <p
      className={cn(
        TEXT_SIZE[size],
        WEIGHT_CLASS[weight],
        align && ALIGN_CLASS[align],
        uppercase && 'uppercase',
        tracking && tracking !== 'none' && TRACKING_CLASS[tracking],
        leading && leading !== 'none' && LEADING_CLASS[leading],
        isHex ? undefined : color,
        'break-words [overflow-wrap:anywhere]',
        className,
      )}
      style={style}
    >
      {' '}
      {text}{' '}
    </p>
  );
}
