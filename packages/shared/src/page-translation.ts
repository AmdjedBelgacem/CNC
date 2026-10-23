/**
 * Translating a builder page.
 *
 * Pages localize as a whole alternate layout rather than per-block translations, so an AI pass has
 * to produce a second tree. This rebuilds that tree by replacing only the strings inside it —
 * structure, block types, ids, spacing and design tokens are copied through untouched, because a
 * model asked to "translate the layout" would otherwise helpfully restyle the page.
 */
import type { PageLayout, PuckNode } from './types/page';
import { harvestLessonBlocks, applyBlockTranslations, type HarvestedField } from './lesson-translation';
import type { LessonBlock } from './types/lesson';

function toBlock(node: PuckNode, id: string): LessonBlock {
  // Reuse the lesson-block walker so builder and lesson content behave identically; a block that
  // translates in a course must translate the same way on a page.
  return { id, type: node.type as LessonBlock['type'], sortOrder: 0, content: (node.props ?? {}) as never };
}

export interface PageTranslationDraft {
  layout: PageLayout;
  /** Label -> English text, for the translate endpoint. */
  fields: Record<string, string>;
  /** Every harvested field, for review and write-back. */
  harvested: HarvestedField[];
}

/**
 * Harvest the translatable strings of a whole layout.
 *
 * Nodes are keyed by their position rather than a stable id because `PuckNode` carries no id —
 * positions are what the write-back addresses too, so the two cannot drift.
 */
/** Read a harvested field from the node it belongs to, not from the layout root. */
export function readPageTranslationField(
  layout: PageLayout | null | undefined,
  field: HarvestedField,
): unknown {
  if (!layout) return undefined;
  const rootMatch = /^n(\d+):/.exec(field.key);
  if (rootMatch) {
    return readAt(layout.content?.[Number(rootMatch[1])]?.props, field.path);
  }
  // Zone ids may contain dots; a greedy match backtracks to the index immediately
  // before the final colon that starts the prop path.
  const zoneMatch = /^z:(.+):(\d+):/.exec(field.key);
  if (zoneMatch) {
    return readAt(layout.zones?.[zoneMatch[1]!]?.[Number(zoneMatch[2])]?.props, field.path);
  }
  return undefined;
}

function readAt(root: unknown, path: string): unknown {
  let current: unknown = root;
  for (const key of path.split('.')) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

export function harvestPageLayout(layout: PageLayout): PageTranslationDraft {
  const harvested: HarvestedField[] = [];
  layout.content.forEach((node, index) => {
    harvested.push(...harvestLessonBlocks([toBlock(node, `n${index}`)]));
  });
  for (const [zoneName, nodes] of Object.entries(layout.zones ?? {})) {
    nodes.forEach((node, index) => {
      harvested.push(...harvestLessonBlocks([toBlock(node, `z:${zoneName}:${index}`)]));
    });
  }
  const fields: Record<string, string> = {};
  for (const field of harvested) {
    if (field.value.trim()) fields[field.key] = field.value;
  }
  return { layout, fields, harvested };
}

/**
 * Apply translated strings back onto a copy of the layout.
 *
 * Design values are protected by the shared key allowlist rather than a page-specific one: a prop
 * like `color` is never harvested in the first place, so it cannot be replaced with a sentence.
 */
export function applyPageTranslations(
  draft: PageTranslationDraft,
  translations: Record<string, string>,
): PageLayout {
  const rebuild = (nodes: PuckNode[], keyFor: (index: number) => string): PuckNode[] =>
    nodes.map((node, index) => {
      const id = keyFor(index);
      const block = toBlock(node, id);
      // `field.path` is already relative to the node's props and `field.key` is the addressable
      // label, so the harvested entries are passed through untouched — stripping the prefix here
      // would break the lookup against `translations`.
      const fields = draft.harvested.filter((field) => field.key.startsWith(`${id}:`));
      if (fields.length === 0) return node;
      const content = applyBlockTranslations(block.content, fields, translations);
      return { ...node, props: content as Record<string, unknown> };
    });

  return {
    ...draft.layout,
    content: rebuild(draft.layout.content, (index) => `n${index}`),
    zones: draft.layout.zones
      ? Object.fromEntries(
          Object.entries(draft.layout.zones).map(([zone, nodes]) => [
            zone,
            rebuild(nodes, (index) => `z:${zone}:${index}`),
          ]),
        )
      : draft.layout.zones,
  };
}
