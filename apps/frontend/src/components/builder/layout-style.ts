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
