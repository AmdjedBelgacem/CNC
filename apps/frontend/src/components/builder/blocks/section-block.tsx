import type { LayoutProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index'; /** Section background treatments (absent/transparent = page default). */
const SECTION_BGS: Record<string, string> = {
  transparent: '',
  white: 'bg-surface-container-lowest',
  muted: 'bg-surface-container-low',
  secondary: 'bg-secondary/10',
  primary: 'bg-primary',
  'gradient-primary': 'bg-gradient-to-b from-primary to-accent',
  'gradient-muted': 'bg-gradient-to-b from-surface-container-low to-surface-container-lowest',
}; /** A full-width `<section>` wrapper with one content zone. */
export function SectionBlock({ props, puck }: BlockComponentProps<LayoutProps>) {
  const { className, bg, hidden } = props as LayoutProps & { bg?: string; hidden?: boolean };
  return (
    <section
      className={cn(SECTION_BGS[bg ?? 'transparent'], hidden && 'hidden', className)}
      style={layoutStyle(props)}
    >
      {' '}
      {puck.renderSlot('content')}{' '}
    </section>
  );
}
