import type { ComponentType } from 'react';
import type { PuckNode, StatsProps } from '@titan/shared';
import { getSlotChildren, mergeBlockProps, seedStatCard } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps, PuckBridge } from './index';
import { StatItemBlock } from './stat-item-block';
import { StackBlock } from './stack-block';
import { TextBlock } from './text-block';
import { BadgeBlock } from './badge-block';
import { HeadingBlock } from './heading-block';
import { useBuilderLivePreview } from '@/components/builder/live-preview-context';

const LIVE_NODE_COMPONENTS: Record<string, ComponentType<BlockComponentProps<any>>> = {
  'stat-item': StatItemBlock,
  stack: StackBlock,
  text: TextBlock,
  badge: BadgeBlock,
  heading: HeadingBlock,
};

/**
 * Minimal inline renderer for the stat-card subtree.
 *
 * `seedStatCard` already produces the exact tree the public page uses. Rendering
 * it through the same block components keeps the builder's live counters in the
 * same markup as the server-baked layout.
 */
function LiveNode({ node }: { node: PuckNode }) {
  const props = mergeBlockProps(node.type, node.props);
  const Component = LIVE_NODE_COMPONENTS[node.type];
  if (!Component) return null;
  const puck: PuckBridge = {
    renderSlot: (slot: string) =>
      getSlotChildren(node, slot).map((child, index) => (
        <LiveNode key={(child.props?.id as string | undefined) ?? index} node={child} />
      )),
    getSlotData: (slot: string) => getSlotChildren(node, slot),
    isEditing: false,
  };
  return <Component props={props} puck={puck} />;
}

/** Overlapping stat cards that sit on top of the hero. */
export function StatsBlock({ props, puck }: BlockComponentProps<StatsProps>) {
  const {
    id,
    className,
    overlap = 96,
    columnsMobile = 'grid-cols-1',
    columnsSm = 'sm:grid-cols-2',
    columnsLg = 'lg:grid-cols-4',
    gap = 'gap-6',
  } = props;
  const layout = layoutStyle(props);
  const authoredMarginTop = typeof props.marginTop === 'number' ? props.marginTop : 0;
  const preview = useBuilderLivePreview();
  const editing = Boolean(puck?.isEditing);
  const isHome = editing && preview?.pageSlug === 'home';
  const liveNodes = isHome && preview?.homeMetrics
    ? preview.homeMetrics.stats.map((stat) => seedStatCard(stat).node)
    : null;

  return (
    <section
      id={id}
      className={cn(
        'px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto relative z-20',
        className,
      )}
      style={{ ...layout, marginTop: authoredMarginTop - overlap }}
    >
      {' '}
      <div className={cn('grid', columnsMobile, columnsSm, columnsLg, gap)}>
        {isHome && preview?.loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-44 animate-pulse rounded-2xl border border-border bg-surface-sunken"
              aria-hidden
            />
          ))
        ) : liveNodes ? (
          liveNodes.map((node, index) => (
            <LiveNode key={(node.props?.id as string | undefined) ?? index} node={node} />
          ))
        ) : (
          puck.renderSlot('content')
        )}
      </div>{' '}
    </section>
  );
}
