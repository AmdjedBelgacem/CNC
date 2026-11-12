import type { CSSProperties } from 'react';
import type { LayoutProps } from '@titan/shared'; /** * Builds the inline style for the universal layout props * (marginTop / marginBottom / maxWidth). * * Every block component applies this to ITS OWN root element — this keeps the * margins inside the element Puck uses as its click/selection target, so the * whole block (including its margins) is directly selectable in the editor. */
export function layoutStyle(props: Partial<LayoutProps> | undefined): CSSProperties {
  const style: CSSProperties = {};
  if (props?.marginTop) style.marginTop = props.marginTop;
  if (props?.marginBottom) style.marginBottom = props.marginBottom;
  if (props?.maxWidth) {
    style.maxWidth = props.maxWidth;
    style.width = '100%';
    style.marginLeft = 'auto';
    style.marginRight = 'auto';
  }
  if (props?.paddingTop) style.paddingTop = props.paddingTop;
  if (props?.paddingRight) style.paddingRight = props.paddingRight;
  if (props?.paddingBottom) style.paddingBottom = props.paddingBottom;
  if (props?.paddingLeft) style.paddingLeft = props.paddingLeft;
  if (props?.minHeight) style.minHeight = props.minHeight;
  return style;
}

/**
 * Splits a block's `color` prop into a class or an inline colour.
 *
 * The schema accepts either a theme class (`text-primary`) or a literal colour, but the heading
 * only knew the first: `#1c1917` landed in the class list, did nothing, and the heading fell back
 * to the theme's light text — invisible on a light band. Text and icon only knew hex, so
 * `rgb()`/`hsl()` values were dropped the same way. Every text-like block uses this now.
 */
const LITERAL_COLOR = /^(#|rgba?\(|hsla?\(|oklch\(|oklab\(|lab\(|lch\(|hwb\(|color-mix\(|var\(--)/i;

export function colorProp(color: string | undefined | null): { className?: string; style: CSSProperties } {
  if (!color) return { style: {} };
  const value = color.trim();
  if (LITERAL_COLOR.test(value)) return { style: { color: value } };
  return { className: value, style: {} };
}
