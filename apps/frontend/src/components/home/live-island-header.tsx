import type { ReactNode } from 'react';
import { getSlotChildren, type PageLayout, type PuckNode } from '@titan/shared';
import { BuilderNode } from '@/components/builder/block-renderer';

/**
 * Builds the builder-authored header for a live island.
 *
 * `HomeBuilder` is a client component, so it cannot receive a render function
 * from a server page (functions are not serializable across the RSC boundary).
 * The page resolves the header itself and passes the resulting element into
 * the island component. Arabic pages call this with `locale !== 'en'` and get
 * `undefined`, keeping the translated header that lives inside the island.
 */
export function liveIslandHeader(
  layout: PageLayout,
  variant: string,
  locale: string,
): ReactNode | undefined {
  if (locale !== 'en') return undefined;
  const zones = (layout as { zones?: Record<string, PuckNode[]> }).zones ?? {};
  const node = (layout.content ?? []).find(
    (candidate) =>
      candidate.type === 'live-island' && candidate.props?.variant === variant,
  );
  if (!node) return undefined;
  const children = getSlotChildren(node, 'header', zones);
  if (children.length === 0) return undefined;
  return children.map((child, index) => (
    <BuilderNode
      key={(child.props?.id as string | undefined) ?? index}
      node={child}
      zones={zones}
    />
  ));
}
