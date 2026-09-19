import { getBlockDefinition } from './registry';
import type { PageLayout, PuckNode } from '../types/page';

/**
 * Slot-model helpers (Puck Slot fields).
 *
 * Since the DropZone → Slot migration, nested block children live INLINE on
 * the owning node (`node.props[slotName]`, an array of child nodes) instead of
 * the legacy flat top-level `zones` map keyed by `"<parentId>:<slotName>"`.
 * Every helper below reads the inline shape first and falls back to the legacy
 * map, so un-migrated rows keep working until they are re-saved.
 */

/** Slot names a block type declares (from its registry definition). */
export function slotNamesFor(type: string): string[] {
  return Object.keys(getBlockDefinition(type)?.zones ?? {});
}

/** True when the value looks like an array of child nodes. */
export function isNodeArray(value: unknown): value is PuckNode[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) => typeof item === 'object' && item !== null && typeof (item as PuckNode).type === 'string',
    )
  );
}

/**
 * Children of a node's slot. Prefers the inline `props[slot]` array and falls
 * back to the legacy flat zones entry (`<nodeId>:<slot>`).
 */
export function getSlotChildren(
  node: PuckNode,
  slot: string,
  legacyZones?: Record<string, PuckNode[]>,
): PuckNode[] {
  const inline = node.props?.[slot];
  if (isNodeArray(inline)) return inline;
  const id = node.props?.id as string | undefined;
  if (id && legacyZones) {
    const legacy = legacyZones[`${id}:${slot}`];
    if (Array.isArray(legacy)) return legacy;
  }
  return [];
}

/** Depth-first walk of every node in a layout (content + inline slots + legacy zones). */
export function walkLayoutNodes(layout: PageLayout, visit: (node: PuckNode) => void): void {
  const legacyZones = layout.zones ?? {};
  const walk = (nodes: PuckNode[] | undefined) => {
    for (const node of nodes ?? []) {
      visit(node);
      for (const slot of slotNamesFor(node.type)) {
        walk(getSlotChildren(node, slot, legacyZones));
      }
    }
  };
  walk(layout.content ?? []);
}

/** Finds a node anywhere in the layout by its `props.id`. */
export function findNodeById(layout: PageLayout, nodeId: string | undefined | null): PuckNode | null {
  if (!nodeId) return null;
  let found: PuckNode | null = null;
  walkLayoutNodes(layout, (node) => {
    if (!found && node.props?.id === nodeId) found = node;
  });
  return found;
}

/**
 * Items of a zone compound key (`"<nodeId>:<slot>"` or the root
 * `"root:default-zone"`). Used by insert-position calculations.
 */
export function getZoneItems(layout: PageLayout, zone: string): PuckNode[] {
  if (zone === 'root:default-zone') return layout.content ?? [];
  const sep = zone.indexOf(':');
  if (sep === -1) return [];
  const node = findNodeById(layout, zone.slice(0, sep));
  if (!node) return [];
  return getSlotChildren(node, zone.slice(sep + 1), layout.zones);
}

/**
 * Returns a new layout with `node` inserted into the given zone compound key
 * at `index` (defaults to the end). The root zone appends to `content`;
 * slot zones splice into the owner's inline `props[slot]` array.
 */
export function insertNodeAtZone(
  layout: PageLayout,
  zone: string,
  node: PuckNode,
  index?: number,
): { layout: PageLayout; index: number } {
  if (zone === 'root:default-zone') {
    const content = layout.content ?? [];
    const at = index ?? content.length;
    return {
      layout: { ...layout, content: [...content.slice(0, at), node, ...content.slice(at)] },
      index: at,
    };
  }
  const sep = zone.indexOf(':');
  const ownerId = sep === -1 ? '' : zone.slice(0, sep);
  const slot = sep === -1 ? '' : zone.slice(sep + 1);
  let at = index ?? -1;
  const place = (n: PuckNode): PuckNode => {
    if ((n.props?.id as string | undefined) !== ownerId) {
      // Recurse: the owner may be nested deeper.
      let changed = false;
      const next: Record<string, unknown> = { ...(n.props ?? {}) };
      for (const name of slotNamesFor(n.type)) {
        const kids = next[name];
        if (isNodeArray(kids)) {
          const rewritten = kids.map(place);
          if (rewritten.some((kid, i) => kid !== kids[i])) {
            next[name] = rewritten;
            changed = true;
          }
        }
      }
      return changed ? { type: n.type, props: next } : n;
    }
    const kids = getSlotChildren(n, slot, layout.zones);
    const pos = at === -1 ? kids.length : at;
    at = pos;
    return { type: n.type, props: { ...(n.props ?? {}), [slot]: [...kids.slice(0, pos), node, ...kids.slice(pos)] } };
  };
  const content = (layout.content ?? []).map(place);
  if (at === -1) {
    // Owner not found (stale selection): fall back to appending at the root
    // rather than silently dropping the node.
    return insertNodeAtZone(layout, 'root:default-zone', node);
  }
  return { layout: { ...layout, content }, index: at };
}

/**
 * Converts a legacy DropZone layout (flat `zones` map) to the inline slot
 * shape: every `"<nodeId>:<slot>"` entry whose owner declares that slot moves
 * into `owner.props[slot]` and is removed from the map. Unknown, orphan, or
 * undeclared entries are left untouched so nothing that previously loaded can
 * break.
 *
 * Mirrors Puck's own `migrate()` helper for our data shape, without console
 * noise and without needing the editor config.
 */
export function migrateLegacyLayout(layout: PageLayout): PageLayout {
  const zones = layout.zones;
  if (!zones || Object.keys(zones).length === 0) return layout;
  // Keys actually consumed by the attach pass. Anything else (orphans,
  // undeclared slots, unreachable owners) stays in the map untouched.
  const consumed = new Set<string>();
  const attach = (node: PuckNode): PuckNode => {
    const id = node.props?.id as string | undefined;
    let changed = false;
    const next: Record<string, unknown> = { ...(node.props ?? {}) };
    for (const slot of slotNamesFor(node.type)) {
      const key = id ? `${id}:${slot}` : '';
      const raw = key ? zones[key] : undefined;
      const legacy = Array.isArray(raw) ? (raw as PuckNode[]) : [];
      const current = next[slot];
      const base = isNodeArray(current) ? current : [];
      let out = base;
      if (base.length > 0) {
        const rewritten = base.map(attach);
        if (rewritten.some((child, i) => child !== base[i])) {
          out = rewritten;
          changed = true;
        }
      }
      if (legacy.length > 0) {
        out = [...out, ...legacy.map(attach)];
        changed = true;
        if (key) consumed.add(key);
      }
      if (out !== base) next[slot] = out;
    }
    return changed ? { type: node.type, props: next } : node;
  };
  const prevContent = layout.content ?? [];
  const content = prevContent.map(attach);
  const contentChanged = content.some((node, i) => node !== prevContent[i]);
  if (!contentChanged && consumed.size === 0) return layout;
  const remaining: Record<string, PuckNode[]> = {};
  for (const [key, value] of Object.entries(zones)) {
    if (!consumed.has(key)) remaining[key] = value as PuckNode[];
  }
  return {
    ...layout,
    content,
    zones: Object.keys(remaining).length > 0 ? remaining : undefined,
  };
}

/** Fresh id for cloned nodes (falls back when `crypto.randomUUID` is missing). */
export function freshNodeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Deep-clones a (slot-shaped) subtree, assigning fresh ids to every node. */
export function cloneSubtreeWithFreshIds(node: PuckNode): PuckNode {
  const clone = (n: PuckNode): PuckNode => {
    const props: Record<string, unknown> = { ...(n.props ?? {}), id: freshNodeId() };
    for (const slot of slotNamesFor(n.type)) {
      const children = n.props?.[slot];
      if (isNodeArray(children)) props[slot] = children.map(clone);
    }
    return { type: n.type, props };
  };
  return clone(node);
}

/**
 * Merges a legacy saved-section payload (`node` + flat `zones`) into a single
 * inline node. New payloads (inline children, empty zones) pass through.
 */
export function inlineSectionZones(node: PuckNode, zones?: Record<string, PuckNode[]>): PuckNode {
  if (!zones || Object.keys(zones).length === 0) return node;
  return migrateLegacyLayout({
    root: { props: {} },
    content: [node],
    zones,
  }).content[0] as PuckNode;
}
