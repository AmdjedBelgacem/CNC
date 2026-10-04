'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Data } from '@measured/puck';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getBlockDefinition, getSlotChildren } from '@titan/shared';
import type { PuckNode } from '@titan/shared';
import { useBuilderPuck } from '@/lib/builder/use-builder-puck';
const ROOT_ZONE = 'root:default-zone';
const CATEGORY_COLORS: Record<string, string> = {
  Chrome: 'bg-warning',
  Sections: 'bg-info',
  Items: 'bg-primary',
  Layout: 'bg-success',
  Content: 'bg-muted-foreground',
};
interface StructureNode {
  id: string;
  type: string;
  label: string;
  index: number;
  zone: string;
  depth: number;
  hasChildren: boolean;
  children: StructureNode[];
  parent: string | null;
}
interface TreeData {
  roots: StructureNode[];
  ancestors: Map<string, string[]>;
}
function nodeLabel(type: string, props: Record<string, unknown> | undefined): string {
  const candidate = props?.title ?? props?.label ?? props?.text ?? props?.heading;
  if (typeof candidate === 'string' && candidate.trim()) {
    return candidate.length > 48 ? `${candidate.slice(0, 48)}…` : candidate;
  }
  return type;
}
function buildTree(data: Data): TreeData {
  const ancestors = new Map<string, string[]>();
  const legacyZones = (data.zones ?? {}) as unknown as Record<string, PuckNode[]>;
  const walk = (
    zone: string,
    list: { type: string; props?: Record<string, unknown> }[],
    depth: number,
    parent: string | null,
  ): StructureNode[] => {
    return (list ?? []).map((item, index) => {
      const id = (item.props?.id as string | undefined) ?? `${item.type}-${index}`;
      if (parent) {
        const chain = ancestors.get(parent) ?? [];
        ancestors.set(id, [...chain, parent]);
      }
      const children: StructureNode[] = [];
      const node = item as PuckNode;
      for (const slot of Object.keys(getBlockDefinition(item.type)?.zones ?? {})) {
        const kids = getSlotChildren(node, slot, legacyZones);
        if (kids.length > 0) {
          children.push(...walk(`${id}:${slot}`, kids, depth + 1, id));
        }
      }
      return {
        id,
        type: item.type,
        label: nodeLabel(item.type, item.props),
        index,
        zone,
        depth,
        hasChildren: children.length > 0,
        children,
        parent,
      };
    });
  };
  return { roots: walk(ROOT_ZONE, data.content ?? [], 0, null), ancestors };
} /**
 * Lightweight structure tree — replaces Puck's expensive layer tree. * One component subscribes to the store (no per-node subscriptions), so it * stays cheap even with hundreds of nodes. Click a row to select that node. */
export function StructureTree() {
  const data = useBuilderPuck((s) => s.appState.data);
  const selectedItem = useBuilderPuck((s) => s.selectedItem);
  const dispatch = useBuilderPuck((s) => s.dispatch);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const selectedId = (selectedItem as { props?: { id?: string } } | null)?.props?.id ?? null;
  const tree = useMemo(() => buildTree(data as Data), [data]); // Keep the branch containing the selection expanded.
  useEffect(() => {
    if (!selectedId) return;
    const chain = tree.ancestors.get(selectedId);
    if (!chain || chain.length === 0) return;
    setExpanded((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const id of chain) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [selectedId, tree]);
  const select = (node: StructureNode) => {
    dispatch({ type: 'setUi', ui: { itemSelector: { index: node.index, zone: node.zone } } } as never);
    if (node.hasChildren && !expanded.has(node.id)) {
      setExpanded((prev) => new Set(prev).add(node.id));
    }
  };
  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const renderNodes = (nodes: StructureNode[]) =>
    nodes.map((node) => {
      const isExpanded = expanded.has(node.id);
      const isSelected = node.id === selectedId;
      const color =
        CATEGORY_COLORS[getBlockDefinition(node.type)?.category ?? ''] ?? 'bg-muted-foreground';
      return (
        <div key={node.id}>
          {' '}
          <div
            className={cn(
              'group flex w-full items-center gap-1.5 rounded-lg px-2 py-[5px] text-left text-xs transition',
              isSelected
                ? 'bg-primary/10 font-semibold text-primary'
                : 'text-foreground hover:bg-muted',
            )}
            style={{ paddingLeft: 6 + node.depth * 14 }}
            role="button"
            tabIndex={0}
            onClick={() => select(node)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                select(node);
              }
            }}
            title={node.label}
          >
            {' '}
            <span
              role="button"
              tabIndex={-1}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
              onClick={(e) => {
                e.stopPropagation();
                toggle(node.id);
              }}
              className={cn(
                'flex size-3.5 shrink-0 items-center justify-center rounded hover:bg-muted-foreground/15',
              )}
            >
              {' '}
              {node.hasChildren && (
                <ChevronDown
                  className={cn(
                    'size-3.5 text-muted-foreground transition-transform duration-200',
                    !isExpanded && '-rotate-90',
                  )}
                />
              )}{' '}
            </span>{' '}
            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', color)} />{' '}
            <span className="flex-1 truncate">{node.label}</span>{' '}
            <span className="shrink-0 font-mono text-2xs uppercase text-muted-foreground/60 group-hover:text-muted-foreground/80">
              {node.type}
            </span>{' '}
          </div>{' '}
          {isExpanded && node.children.length > 0 && renderNodes(node.children)}{' '}
        </div>
      );
    });
  if (tree.roots.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
        {' '}
        <p className="text-sm font-semibold text-foreground">The page is empty</p>{' '}
        <p className="max-w-[200px] text-xs leading-relaxed text-muted-foreground">
          {' '}
          Use Add Block to insert your first component.{' '}
        </p>{' '}
      </div>
    );
  }
  return <div className="space-y-px">{renderNodes(tree.roots)}</div>;
}
