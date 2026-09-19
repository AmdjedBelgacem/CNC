'use client';
import type { ReactNode } from 'react';
import type { PageLayout, PuckNode } from '@titan/shared';
import { BuilderNode } from '@/components/builder/block-renderer';
import { LiveAcademyGrid } from './live-academy-grid';
import type { AcademySummary } from '@/lib/academies';

/**
 * Homepage renderer: identical to BlockRenderer except every `academy-grid`
 * node is substituted with live tenant data. Static seed cards can therefore
 * never reach visitors — the block renders DB rows in place (preserving page
 * order) or disappears when nothing is published.
 */
export function HomeBuilder({
  layout,
  academies,
}: {
  layout: PageLayout;
  academies: AcademySummary[];
}) {
  const nodes = layout.content ?? [];
  const zones = (layout as { zones?: Record<string, PuckNode[]> }).zones ?? {};
  if (!nodes.length) return null;
  const intercept = (node: PuckNode): ReactNode | null | undefined => {
    if (node.type === 'academy-grid') {
      return <LiveAcademyGrid academies={academies} />;
    }
    return undefined;
  };
  return (
    <div>
      {nodes.map((node, index) => (
        <BuilderNode
          key={(node.props?.id as string | undefined) ?? index}
          node={node}
          zones={zones}
          intercept={intercept}
        />
      ))}
    </div>
  );
}
