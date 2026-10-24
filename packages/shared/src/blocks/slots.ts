import { getBlockDefinition } from './registry';
import { consoleNodesFromProps } from './console-composition';
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
      (item) =>
        typeof item === 'object' && item !== null && typeof (item as PuckNode).type === 'string',
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
export function findNodeById(
  layout: PageLayout,
  nodeId: string | undefined | null,
): PuckNode | null {
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
    return {
      type: n.type,
      props: { ...(n.props ?? {}), [slot]: [...kids.slice(0, pos), node, ...kids.slice(pos)] },
    };
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

/**
 * Expands a legacy prop-driven `hero-console` into the composable console tree.
 *
 * Old pages stored the image, telemetry, axes and mode buttons as props on one
 * block. If the author has not chosen `legacy` and has never supplied a
 * `console` slot, this adds a `console-frame` subtree derived from those props.
 * The original props stay in place as a fallback and the generated ids are
 * stable, so subsequent reads, saves and Arabic structure merges address the
 * same nodes.
 */
export function expandHeroConsoleLayout(layout: PageLayout): PageLayout {
  const legacyZones = layout.zones ?? {};
  let changed = false;

  const expandNode = (node: PuckNode): PuckNode => {
    const props = node.props ?? {};
    let nextProps: Record<string, unknown> | null = null;
    const set = (key: string, value: unknown) => {
      if (!nextProps) nextProps = { ...props };
      nextProps[key] = value;
    };

    if (node.type === 'hero-console' && props.consoleMode !== 'legacy' && !('console' in props)) {
      const legacyChildren = getSlotChildren(node, 'console', legacyZones);
      if (legacyChildren.length > 0) {
        set('console', legacyChildren);
      } else {
        const baseId = typeof props.id === 'string' && props.id ? props.id : 'hero-console';
        set('console', consoleNodesFromProps(props, baseId));
      }
      set('consoleMode', 'composed');
      changed = true;
    }

    for (const slot of slotNamesFor(node.type)) {
      const children = getSlotChildren(node, slot, legacyZones);
      if (children.length === 0) continue;
      let slotChanged = false;
      const rewritten = children.map((child) => {
        const expanded = expandNode(child);
        if (expanded !== child) slotChanged = true;
        return expanded;
      });
      if (slotChanged) set(slot, rewritten);
    }

    return nextProps ? { type: node.type, props: nextProps } : node;
  };

  const content = (layout.content ?? []).map((node) => {
    const expanded = expandNode(node);
    if (expanded !== node) changed = true;
    return expanded;
  });

  return changed ? { ...layout, content } : layout;
}

/**
 * Rebuilds a translated layout on top of the English structure.
 *
 * Pages are translated as a whole alternate tree, so a section added to the
 * English page after the translation was saved exists only in English. That
 * used to make new sections invisible to Arabic visitors until someone rebuilt
 * the Arabic layout by hand.
 *
 * The English layout is authoritative for structure (which blocks exist, their
 * order, and their slots). The translated layout supplies the localized props
 * for every block whose `props.id` still exists, matched recursively through
 * slots. Newly added blocks therefore appear in the right place with English
 * copy until they are translated; deleted blocks disappear from both locales.
 */
const UNSAFE_PATH_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Props that describe presentation rather than copy.
 *
 * A translated page is a whole alternate tree, so it also carried a frozen copy
 * of the design. Changing the hero overlay or swapping an image on the English
 * page therefore never reached Arabic visitors: the translated node already had
 * the old value, and the merge only filled props that were missing. Presentation
 * is not copy, so English is authoritative for these keys while every text prop
 * stays in the translated tree.
 *
 * Short labels such as `tag` and `value` are deliberately absent: they are copy
 * even though the AI harvester does not send them to a model, and an author may
 * have chosen an Arabic term for them.
 */
const PRESENTATION_PROP_KEYS = new Set([
  'accent',
  'accentColor',
  'active',
  'align',
  'answerPaddingBottom',
  'answerPaddingX',
  'as',
  'aspectRatio',
  'avatarUrl',
  'backgroundColor',
  'backgroundOpacity',
  'backgroundOverlay',
  'band',
  'barHeight',
  'bg',
  'bgColor',
  'bgGradient',
  'bgImage',
  'blueprint',
  'border',
  'borderBottom',
  'borderColor',
  'borderTop',
  'bottomGap',
  'box',
  'buttonPaddingX',
  'buttonPaddingY',
  'cardsColumns',
  'cardsGap',
  'className',
  'color',
  'columns',
  'columnsLg',
  'columnsMd',
  'columnsMobile',
  'columnsSm',
  'containerMaxWidth',
  'containerPaddingX',
  'containerPaddingY',
  'containerRadius',
  'contentAlign',
  'contentMaxWidth',
  'contentPadding',
  'contentPaddingX',
  'copyWidth',
  'count',
  'decorativeCircles',
  'direction',
  'directionMobile',
  'duration',
  'floatIcon',
  'footerMarginTop',
  'frame',
  'fullHeight',
  'gap',
  'glass',
  'gradientVeil',
  'gridGap',
  'headerMarginBottom',
  'height',
  'hidden',
  'hideOnMobile',
  'hover',
  'icon',
  'iconPosition',
  'iconSize',
  'imageBorder',
  'imageFirstMobile',
  'imageUrl',
  'itemsGap',
  'justify',
  'leading',
  'levelTone',
  'logoGap',
  'marginBottom',
  'marginTop',
  'maxWidth',
  'mediaAspect',
  'mesh',
  'minHeight',
  'mobileHeight',
  'objectFit',
  'opacity',
  'overflow',
  'overlap',
  'overlayColor',
  'overlayOpacity',
  'padding',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'paddingTop',
  'parallaxFactor',
  'percent',
  'placement',
  'plainCircles',
  'pulse',
  'radialVeil',
  'radius',
  'rating',
  'scrollIndicator',
  'scrollIndicatorBottom',
  'shadow',
  'showNumbers',
  'showTrafficLights',
  'showTrustChips',
  'sideWidth',
  'size',
  'src',
  'tagTone',
  'ticks',
  'tone',
  'topOffset',
  'tracking',
  'uppercase',
  'variant',
  'weight',
  'width',
  'widthPercent',
  'wrap',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Copy presentation props from an English node onto its translated counterpart.
 *
 * Text props, ids, block types and slot children are left alone. Nested objects
 * and lists are visited so design fields inside cards/readouts also follow the
 * English page, but only presentation keys are written.
 */
function syncPresentationProps(
  english: Record<string, unknown>,
  translated: Record<string, unknown>,
  slotNames: Set<string>,
): void {
  for (const key of Object.keys(translated)) {
    if (key === 'id' || slotNames.has(key)) continue;
    if (PRESENTATION_PROP_KEYS.has(key) && !(key in english)) delete translated[key];
  }
  for (const [key, value] of Object.entries(english)) {
    if (key === 'id' || key === 'type' || slotNames.has(key) || UNSAFE_PATH_KEYS.has(key)) continue;
    if (PRESENTATION_PROP_KEYS.has(key)) {
      translated[key] = value;
      continue;
    }
    const current = translated[key];
    if (isRecord(value) && isRecord(current)) {
      syncPresentationProps(value, current, slotNames);
      continue;
    }
    if (Array.isArray(value) && Array.isArray(current)) {
      const length = Math.min(value.length, current.length);
      for (let index = 0; index < length; index += 1) {
        const next = value[index];
        const existing = current[index];
        if (isRecord(next) && isRecord(existing)) {
          syncPresentationProps(next, existing, slotNames);
        }
      }
    }
  }
}

export function mergeLayoutStructure(
  english: PageLayout,
  translated: PageLayout,
): PageLayout {
  const byId = (nodes: unknown): Map<string, PuckNode> => {
    const map = new Map<string, PuckNode>();
    if (!isNodeArray(nodes)) return map;
    for (const node of nodes) {
      const id = node.props?.id;
      if (typeof id === 'string' && id) map.set(id, node);
    }
    return map;
  };

  const mergeNode = (en: PuckNode, tr: PuckNode | undefined): PuckNode => {
    if (!tr || tr.type !== en.type) return en;
    const props: Record<string, unknown> = { ...(tr.props ?? {}) };
    const enProps = en.props ?? {};
    const slotNames = new Set(slotNamesFor(en.type));
    // Presentation follows English; copy stays in the translated tree.
    syncPresentationProps(enProps, props, slotNames);
    // Keep the English id even if the translated copy drifted, and fill in
    // props that exist only on the English side (new CTA label, new image, ...).
    for (const [key, value] of Object.entries(enProps)) {
      if (key === 'id' || !(key in props)) props[key] = value;
    }
    // Visibility is structural, not copy: an editor who unhides a block on the
    // English page expects it to appear for Arabic visitors too.
    if ('visible' in enProps) props.visible = enProps.visible;
    else delete props.visible;
    // Slots are rebuilt from the English tree so newly added children show up.
    for (const slot of slotNames) {
      if (!(slot in enProps)) continue;
      const enChildren = isNodeArray(enProps[slot]) ? (enProps[slot] as PuckNode[]) : [];
      const trChildren = isNodeArray(tr.props?.[slot]) ? (tr.props?.[slot] as PuckNode[]) : [];
      const translatedChildren = byId(trChildren);
      props[slot] = enChildren.map((child) => {
        const id = child.props?.id;
        return mergeNode(
          child,
          typeof id === 'string' ? translatedChildren.get(id) : undefined,
        );
      });
    }
    return { type: en.type, props };
  };

  const translatedTop = byId(translated.content);
  const content = (english.content ?? []).map((node) => {
    const id = node.props?.id;
    return mergeNode(
      node,
      typeof id === 'string' ? translatedTop.get(id) : undefined,
    );
  });
  return { ...english, content };
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
