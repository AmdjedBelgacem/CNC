'use client';
import type { ReactNode } from 'react';
import type { PageLayout, PuckNode } from '@titan/shared';
import { getBlockDefinition, getSlotChildren, mergeBlockProps } from '@titan/shared';
import {
  BLOCK_COMPONENTS,
  type PuckBridge,
} from '@/components/builder/blocks';
import { Reveal } from '@/components/ui/motion'; /** * Public renderer. * * Renders the exact same block components the Puck editor uses, injecting a * synthetic `puck` bridge whose `renderSlot` resolves slot children inline * from the node's props — so the public page and the editor canvas can * never render differently. Layouts still in the legacy DropZone shape * (flat `zones` map) are honored through the same fallback the shared * slot helpers provide. */ /** * Renders a single layout node (and its nested slots) with the shared block * components. `intercept` lets special blocks (e.g. the auth-aware navbar) * substitute or drop specific nodes before they render. */
/**
 * Blocks that duplicate the app chrome.
 *
 * Builder layouts are authored in Puck and can legitimately contain `nav` and
 * `footer` blocks, but every public route already renders `<NavMain />` +
 * `<Footer />` from its layout. Rendering both produced TWO headers and TWO
 * footers on the landing page (a fixed "Ahmad CNC" marketing bar stacked on the
 * real app navbar), with the duplicate lacking auth state, theme toggle, search
 * and notifications. The public renderer therefore never emits them; the Puck
 * editor still can, because it renders through its own component map.
 */
const CHROME_BLOCK_TYPES = new Set(['nav', 'footer']);

export function BuilderNode({
  node,
  zones,
  intercept,
}: {
  node: PuckNode;
  /** Legacy flat zones map — only consulted when a node has no inline slot children. */
  zones?: Record<string, PuckNode[]>;
  intercept?: (node: PuckNode) => ReactNode | null | undefined;
}) {
  const props = mergeBlockProps(node.type, node.props);
  if (props.visible === false) return null;
  if (CHROME_BLOCK_TYPES.has(node.type)) return null;
  const override = intercept?.(node);
  if (override !== undefined) return override;
  const definition = getBlockDefinition(node.type);
  const Component = BLOCK_COMPONENTS[node.type];
  if (!Component) return null;
  if (definition?.zones) {
    const nodeWithDefaults: PuckNode = { type: node.type, props };
    const puck: PuckBridge = {
      renderSlot: (slot: string) => {
        const children = getSlotChildren(nodeWithDefaults, slot, zones);
        return children.map((child, index) => (
          <BuilderNode
            key={(child.props?.id as string | undefined) ?? index}
            node={child}
            zones={zones}
            intercept={intercept}
          />
        ));
      },
      getSlotData: (slot: string) => getSlotChildren(nodeWithDefaults, slot, zones),
    };
    return <Component props={props} puck={puck} />;
  }
  return <Component props={props} puck={undefined as unknown as PuckBridge} />;
}
export function BlockRenderer({ layout }: { layout: PageLayout }) {
  const nodes = layout.content ?? [];
  const zones = layout.zones ?? {};
  if (!nodes.length) return null;
  return (
    <div>
      {' '}
      {/* Each authored section reveals as it scrolls into view.
          `whileInView` is what makes this correct on a long marketing page: the
          blocks near the bottom are in the document long before the user gets
          there, so a mount-triggered animation would have finished — and been
          missed — before it was ever on screen. `<Reveal>` is already
          view-triggered with `once`, so a block that starts in the viewport
          (the hero) animates on arrival and everything below waits its turn.

          The `.motion-reveal` marker that `<Reveal>` attaches is what lets
          globals.css force these visible when scripting is off. */}
      {nodes.map((node, index) => (
        <Reveal key={(node.props?.id as string | undefined) ?? index}>
          <BuilderNode node={node} zones={zones} />
        </Reveal>
      ))}{' '}
    </div>
  );
}
export function renderLayoutZones(layout: PageLayout): {
  renderZone: (id: string, zone: string) => ReactNode;
} {
  const zones = layout.zones ?? {};
  return {
    renderZone: (id: string, zone: string) => {
      const children = getSlotChildren(
        { type: '', props: { id } },
        zone,
        zones,
      );
      return children.map((child, index) => (
        <BuilderNode
          key={(child.props?.id as string | undefined) ?? index}
          node={child}
          zones={zones}
        />
      ));
    },
  };
}
