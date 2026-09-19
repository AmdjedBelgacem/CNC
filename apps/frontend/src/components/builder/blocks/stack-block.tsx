import type { CSSProperties } from 'react';
import type { StackProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';

const GAP_PX: Record<string, number> = { none: 0, sm: 8, md: 16, 'md-2': 20, 'md-lg': 24, lg: 32, xl: 48 };
const JUSTIFY: Record<string, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
};
const ALIGN: Record<string, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
};

/** Responsive direction overrides: mobile base + `md:` desktop (overrides the inline default). */
const DIRECTION_MOBILE: Record<string, string> = {
  column: '[--stack-direction:column]',
  row: '[--stack-direction:row]',
};
const DIRECTION_DESKTOP: Record<string, string> = {
  column: 'md:[--stack-direction:column]',
  row: 'md:[--stack-direction:row]',
};

export function StackBlock({ props, puck }: BlockComponentProps<StackProps>) {
  const {
    direction = 'column',
    directionMobile,
    gap = 'md',
    align = 'center',
    justify = 'center',
    wrap = false,
    bg,
    className,
  } = props;

  const style: CSSProperties = {
    display: 'flex',
    /* `cta-row` etc. can flip the direction responsively via a CSS variable. */
    flexDirection: `var(--stack-direction, ${direction === 'row' ? 'row' : 'column'})` as CSSProperties['flexDirection'],
    gap: GAP_PX[gap],
    justifyContent: JUSTIFY[justify],
    alignItems: ALIGN[align],
    flexWrap: wrap ? 'wrap' : undefined,
    ...(bg === 'glass'
      ? {
          background: 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          borderRadius: 24,
        }
      : {}),
    ...layoutStyle(props),
  };

  return (
    <div
      className={
        cn(
          className,
          directionMobile && directionMobile !== 'none' && DIRECTION_MOBILE[directionMobile],
          directionMobile && directionMobile !== 'none' && DIRECTION_DESKTOP[direction],
        ) || undefined
      }
      style={style}
    >
      {puck.renderSlot('content')}
    </div>
  );
}
