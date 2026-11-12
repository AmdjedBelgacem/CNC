import {
  freshNodeId,
  getBlockDefinition,
  isNodeArray,
  sanitizeAiClassName,
  slotNamesFor,
  validatePageLayout,
  walkLayoutNodes,
  type PageLayout,
  type PuckNode,
} from '@titan/shared';
import { isBuildableBlock } from './block-catalog';

/**
 * The tree format the AI reads and writes.
 *
 * Puck nests a node's props and slot children under `props`, which costs tokens on every node
 * and is the part models most often get wrong. The AI format flattens it: a node is
 * `{type, id, ...props, <slot>: [children]}`. Default-valued props are dropped on the way out,
 * so the model sees what the author actually set rather than every inherited value.
 */
export type AiNode = { type: string; id?: string } & Record<string, unknown>;

export type AiOperation =
  | { op: 'update'; id: string; props: Record<string, unknown> }
  | { op: 'replace'; id: string; node: AiNode }
  | { op: 'insert'; parent?: string | null; slot?: string; index?: number; node: AiNode }
  | { op: 'remove'; id: string }
  | { op: 'move'; id: string; parent?: string | null; slot?: string; index?: number }
  | { op: 'set_page'; content: AiNode[] };

const SAME = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/* ------------------------------------------------------------------ out */

export function toAiNode(node: PuckNode): AiNode {
  const def = getBlockDefinition(node.type);
  const slots = new Set(slotNamesFor(node.type));
  const out: AiNode = { type: node.type };
  const props = node.props ?? {};
  if (typeof props.id === 'string') out.id = props.id;
  for (const [key, value] of Object.entries(props)) {
    if (key === 'id' || slots.has(key)) continue;
    if (value === undefined || value === null || value === '') continue;
    if (def && key in def.defaultProps && SAME(def.defaultProps[key], value)) continue;
    out[key] = value;
  }
  for (const slot of slots) {
    const kids = props[slot];
    if (isNodeArray(kids) && kids.length) out[slot] = kids.map(toAiNode);
  }
  return out;
}

export function toAiTree(layout: PageLayout): AiNode[] {
  return (layout.content ?? []).map(toAiNode);
}

/**
 * A short outline of a large page: one line per node, indented by depth, with the first
 * words of its text. Used instead of the full tree when the page is too big to send whole,
 * so an edit still knows every id and where it sits.
 */
export function outlineTree(nodes: AiNode[], depth = 0, lines: string[] = []): string[] {
  for (const node of nodes) {
    const text = ['text', 'label', 'title', 'heading', 'question'].map((key) => node[key]).find(
      (value) => typeof value === 'string' && value.trim(),
    ) as string | undefined;
    lines.push(`${'  '.repeat(depth)}- ${node.type} #${node.id ?? '?'}${text ? ` "${text.slice(0, 60)}"` : ''}`);
    for (const slot of slotNamesFor(node.type)) {
      const kids = node[slot];
      if (Array.isArray(kids) && kids.length) {
        lines.push(`${'  '.repeat(depth + 1)}[${slot}]`);
        outlineTree(kids as AiNode[], depth + 2, lines);
      }
    }
  }
  return lines;
}

/** Every class the page already uses, so an AI edit never strips a working hand-written class. */
export function classesInLayout(layout: PageLayout): Set<string> {
  const set = new Set<string>();
  walkLayoutNodes(layout, (node) => {
    const value = node.props?.className;
    if (typeof value === 'string') for (const token of value.split(/\s+/)) if (token) set.add(token);
  });
  return set;
}

/* ------------------------------------------------------------------- in */

export interface BuildContext {
  /** Nodes on the page before this run, by id. Internal blocks are only kept when they already existed. */
  existing: Map<string, PuckNode>;
  /** Ids already used in the output, so a model that repeats an id cannot create duplicates. */
  used: Set<string>;
  pageClasses: Set<string>;
  warnings: string[];
}

export function newBuildContext(layout: PageLayout | null): BuildContext {
  const existing = new Map<string, PuckNode>();
  if (layout) {
    walkLayoutNodes(layout, (node) => {
      const id = node.props?.id;
      if (typeof id === 'string') existing.set(id, node);
    });
  }
  return {
    existing,
    used: new Set(),
    pageClasses: layout ? classesInLayout(layout) : new Set(),
    warnings: [],
  };
}

function warn(ctx: BuildContext, message: string) {
  if (ctx.warnings.length < 30 && !ctx.warnings.includes(message)) ctx.warnings.push(message);
}

/**
 * Turns a model node into a valid Puck node, repairing what can be repaired locally.
 *
 * Unknown block types are dropped, children a slot does not allow are dropped, and props the
 * block's schema rejects are removed one by one. Each of those is recorded as a warning, and
 * only what still fails afterwards is sent back to the model, so a single bad enum value never
 * costs a whole extra request.
 */
export function fromAiNode(raw: unknown, ctx: BuildContext): PuckNode | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  const type = typeof input.type === 'string' ? input.type.trim() : '';
  const rawId = typeof input.id === 'string' && input.id.trim() ? input.id.trim() : undefined;

  if (!isBuildableBlock(type)) {
    // A data-bound block echoed back untouched is kept as it was.
    const original = rawId ? ctx.existing.get(rawId) : undefined;
    if (original && original.type === type && !ctx.used.has(rawId!)) {
      ctx.used.add(rawId!);
      return original;
    }
    warn(ctx, type ? `Skipped an unknown block type "${type}".` : 'Skipped a block with no type.');
    return null;
  }

  const def = getBlockDefinition(type)!;
  const slots = def.zones ?? {};
  const props: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (key === 'type' || key === 'id' || key === 'props' || key in slots) continue;
    props[key] = value;
  }
  // Models trained on Puck sometimes nest props anyway; accept both shapes.
  if (input.props && typeof input.props === 'object' && !Array.isArray(input.props)) {
    for (const [key, value] of Object.entries(input.props as Record<string, unknown>)) {
      if (key === 'id') continue;
      if (key in slots) {
        if (!(key in input)) input[key] = value;
        continue;
      }
      if (!(key in props)) props[key] = value;
    }
  }

  if ('className' in props) {
    const clean = sanitizeAiClassName(props.className, ctx.pageClasses);
    if (clean) props.className = clean;
    else delete props.className;
  }

  // Drop invalid props until the schema accepts what is left.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const parsed = def.schema.safeParse(props);
    if (parsed.success) break;
    const bad = new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? '')).filter(Boolean));
    if (bad.size === 0) break;
    for (const key of bad) {
      warn(ctx, `Removed an invalid "${key}" value on ${type}.`);
      delete props[key];
    }
  }

  const id = rawId && !ctx.used.has(rawId) ? rawId : freshNodeId();
  ctx.used.add(id);
  const node: PuckNode = { type, props: { ...props, id } };

  for (const [slot, spec] of Object.entries(slots)) {
    const kidsRaw = input[slot];
    if (!Array.isArray(kidsRaw)) continue;
    let kids = kidsRaw
      .map((kid) => fromAiNode(kid, ctx))
      .filter((kid): kid is PuckNode => kid !== null);
    if (spec.allow) {
      const allowed = kids.filter((kid) => spec.allow!.includes(kid.type));
      if (allowed.length !== kids.length) {
        warn(ctx, `Removed blocks that ${type}.${slot} does not accept (it takes ${spec.allow.join(', ')}).`);
      }
      kids = allowed;
    }
    if (spec.max !== undefined && kids.length > spec.max) kids = kids.slice(0, spec.max);
    node.props![slot] = kids;
  }
  return node;
}

/* ------------------------------------------------------------ operations */

interface Location {
  list: PuckNode[];
  index: number;
  node: PuckNode;
}

function locate(content: PuckNode[], id: string): Location | null {
  const search = (list: PuckNode[]): Location | null => {
    for (let index = 0; index < list.length; index += 1) {
      const node = list[index]!;
      if (node.props?.id === id) return { list, index, node };
      for (const slot of slotNamesFor(node.type)) {
        const kids = node.props?.[slot];
        if (isNodeArray(kids)) {
          const found = search(kids);
          if (found) return found;
        }
      }
    }
    return null;
  };
  return search(content);
}

function targetList(content: PuckNode[], parent: string | null | undefined, slot: string | undefined): PuckNode[] | string {
  if (!parent || parent === 'root') return content;
  const found = locate(content, parent);
  if (!found) return `No block with id "${parent}".`;
  const slots = slotNamesFor(found.node.type);
  if (slots.length === 0) return `"${found.node.type}" #${parent} cannot hold other blocks.`;
  const name = slot && slots.includes(slot) ? slot : slots[0]!;
  const props = (found.node.props ??= {});
  if (!isNodeArray(props[name])) props[name] = [];
  return props[name] as PuckNode[];
}

const clampIndex = (index: unknown, length: number) =>
  typeof index === 'number' && Number.isInteger(index) ? Math.min(Math.max(index, 0), length) : length;

/**
 * Applies the model's operations to a copy of the layout.
 *
 * Each operation is independent: one that names a missing id is reported and skipped rather
 * than failing the whole edit, because the rest of a multi-part request is usually still right.
 */
export function applyOperations(
  layout: PageLayout,
  operations: unknown[],
  ctx: BuildContext,
): { layout: PageLayout; applied: number; errors: string[] } {
  const content = structuredClone(layout.content ?? []) as PuckNode[];
  const errors: string[] = [];
  let applied = 0;
  let replacedPage: PuckNode[] | null = null;

  for (const raw of operations) {
    if (!raw || typeof raw !== 'object') continue;
    const op = raw as Record<string, unknown>;
    const id = typeof op.id === 'string' ? op.id : '';
    const working = replacedPage ?? content;
    switch (op.op) {
      case 'set_page': {
        const nodes = Array.isArray(op.content) ? op.content : [];
        replacedPage = nodes.map((node) => fromAiNode(node, ctx)).filter((n): n is PuckNode => n !== null);
        applied += 1;
        break;
      }
      case 'update': {
        const found = locate(working, id);
        if (!found) {
          errors.push(`update: no block with id "${id}".`);
          break;
        }
        const patch = (op.props && typeof op.props === 'object' ? op.props : {}) as Record<string, unknown>;
        // toAiNode carries the slot children, so an update only changes the props it names.
        // A prop set to null in the patch means "back to the default".
        const merged: Record<string, unknown> = { ...toAiNode(found.node), ...patch, type: found.node.type, id };
        for (const [key, value] of Object.entries(patch)) if (value === null) delete merged[key];
        ctx.used.delete(id);
        const next = fromAiNode(merged, ctx);
        if (next) {
          found.list[found.index] = next;
          applied += 1;
        }
        break;
      }
      case 'replace': {
        const found = locate(working, id);
        if (!found) {
          errors.push(`replace: no block with id "${id}".`);
          break;
        }
        const node = fromAiNode(op.node, ctx);
        if (node) {
          found.list[found.index] = node;
          applied += 1;
        } else {
          errors.push(`replace: the new block for "${id}" was not valid.`);
        }
        break;
      }
      case 'insert': {
        const list = targetList(working, op.parent as string | null | undefined, op.slot as string | undefined);
        if (typeof list === 'string') {
          errors.push(`insert: ${list}`);
          break;
        }
        const node = fromAiNode(op.node, ctx);
        if (!node) {
          errors.push('insert: the new block was not valid.');
          break;
        }
        list.splice(clampIndex(op.index, list.length), 0, node);
        applied += 1;
        break;
      }
      case 'remove': {
        const found = locate(working, id);
        if (!found) {
          errors.push(`remove: no block with id "${id}".`);
          break;
        }
        found.list.splice(found.index, 1);
        applied += 1;
        break;
      }
      case 'move': {
        const found = locate(working, id);
        if (!found) {
          errors.push(`move: no block with id "${id}".`);
          break;
        }
        found.list.splice(found.index, 1);
        const list = targetList(working, op.parent as string | null | undefined, op.slot as string | undefined);
        if (typeof list === 'string') {
          found.list.splice(found.index, 0, found.node);
          errors.push(`move: ${list}`);
          break;
        }
        list.splice(clampIndex(op.index, list.length), 0, found.node);
        applied += 1;
        break;
      }
      default:
        errors.push(`Unknown operation "${String(op.op)}".`);
    }
  }
  return { layout: { ...layout, content: replacedPage ?? content }, applied, errors };
}

/** Runs the server's publish validator. Empty means the layout will save and publish. */
export function layoutIssues(layout: PageLayout): string[] {
  const result = validatePageLayout(layout);
  return result.ok ? [] : result.issues.slice(0, 12);
}

export function countNodes(layout: PageLayout): number {
  let count = 0;
  walkLayoutNodes(layout, () => {
    count += 1;
  });
  return count;
}
