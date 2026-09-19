import { z } from 'zod';
import { getBlockDefinition, BLOCK_REGISTRY } from '../blocks/registry';
import { isNodeArray, slotNamesFor, walkLayoutNodes } from '../blocks/slots';
import type { PageLayout, PuckNode } from '../types/page';

/**
 * Recursive validator for the Puck layout tree.
 *
 * - Rejects unknown block types (a typo'd type can never be published).
 * - Validates every node's props against the block's own zod schema.
 * - Validates nested slot children recursively.
 *
 * Props are validated with a loose object schema (unknown keys allowed) so
 * metadata added by the editor (ids etc.) never breaks a publish. Inline
 * slot arrays (`props[slotName]`) are skipped by the zod object check and
 * validated structurally here instead.
 */
function validateNodeTree(node: PuckNode, path: string, seen: Set<unknown>): string[] {
  const issues: string[] = [];
  if (seen.has(node)) return ['Circular layout reference detected — nodes must form a tree.'];
  seen.add(node);
  const at = path || node.type;
  const def = getBlockDefinition(node.type);
  if (!def) {
    issues.push(
      `Unknown block type "${node.type}" at ${at}. Known types: ${Object.keys(BLOCK_REGISTRY).join(', ')}`,
    );
    return issues;
  }
  const parsed = def.schema.safeParse(node.props);
  if (!parsed.success) {
    issues.push(
      `Block "${node.type}" at ${at} has invalid props: ${parsed.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ')}`,
    );
  }
  for (const slot of Object.keys(def.zones ?? {})) {
    const value = node.props?.[slot];
    if (value === undefined) continue;
    if (!isNodeArray(value)) {
      issues.push(`Slot "${slot}" on "${node.type}" at ${at} must be an array of child nodes.`);
      continue;
    }
    value.forEach((child, index) => {
      issues.push(...validateNodeTree(child, `${at} > ${slot}[${index}]`, seen));
    });
  }
  return issues;
}

export const puckNodeSchema: z.ZodType<PuckNode> = z.lazy(() =>
  z
    .object({
      type: z.string().min(1),
      props: z.record(z.string(), z.unknown()).default({}),
      zones: z.record(z.string(), z.array(puckNodeSchema)).optional(),
    })
    .superRefine((node, ctx) => {
      for (const message of validateNodeTree(node, '', new Set())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message });
      }
    }),
);

export const pageLayoutSchema: z.ZodType<PageLayout> = z.object({
  root: z.object({
    props: z.record(z.string(), z.unknown()).default({}),
  }),
  content: z.array(puckNodeSchema),
  zones: z.record(z.string(), z.array(puckNodeSchema)).optional(),
  schemaVersion: z.literal(2).optional(),
});

export type PageLayoutInput = z.infer<typeof pageLayoutSchema>;

// ------------------------------------------------------------------
// Slot connectivity checks (validator v2)
//
// Additive-only by design: entries whose referenced node is unknown or has
// no matching slot declaration are tolerated (legacy data), so nothing that
// previously validated can start failing. Violations only surface where a
// node DOES declare the slot: disallowed child types and over-capacity.
//
// Both the inline slot shape (`props[slot]`) and legacy flat-zones entries
// are checked; a legacy entry shadowed by an inline array for the same
// owner+slot is skipped to avoid double-reporting.
// ------------------------------------------------------------------

export interface ZoneViolation {
  zone: string;
  message: string;
}

function checkSlotChildren(
  violations: ZoneViolation[],
  ownerType: string,
  key: string,
  zoneName: string,
  nodes: PuckNode[],
): void {
  const def = getBlockDefinition(ownerType);
  const spec = def?.zones?.[zoneName];
  if (!spec) return; // undeclared slot on a known node: tolerated for legacy data
  for (const child of nodes) {
    if (spec.allow && !spec.allow.includes(child.type)) {
      violations.push({
        zone: key,
        message: `Zone "${key}" (${ownerType}) does not allow block type "${child.type}". Allowed: ${spec.allow.join(', ')}`,
      });
    }
  }
  if (spec.max !== undefined && nodes.length > spec.max) {
    violations.push({
      zone: key,
      message: `Zone "${key}" (${ownerType}) has ${nodes.length} children, exceeding the max of ${spec.max}`,
    });
  }
}

/** Returns violations for every slot in the layout (inline + legacy zones). */
export function validateLayoutZones(layout: PageLayout): ZoneViolation[] {
  const violations: ZoneViolation[] = [];
  const inlineKeys = new Set<string>();
  const walkInline = (nodes: PuckNode[] | undefined) => {
    for (const node of nodes ?? []) {
      const id = node.props?.id as string | undefined;
      for (const slot of slotNamesFor(node.type)) {
        const kids = node.props?.[slot];
        if (!isNodeArray(kids)) continue;
        const key = id ? `${id}:${slot}` : slot;
        if (id) inlineKeys.add(key);
        checkSlotChildren(violations, node.type, key, slot, kids);
        walkInline(kids);
      }
    }
  };
  walkInline(layout.content ?? []);
  const zones = layout.zones ?? {};
  const nodesById = collectNodesById(layout);
  for (const [key, nodes] of Object.entries(zones)) {
    if (inlineKeys.has(key)) continue; // already validated inline
    const sep = key.indexOf(':');
    const nodeId = sep === -1 ? key : key.slice(0, sep);
    const zoneName = sep === -1 ? '' : key.slice(sep + 1);
    const owner = nodesById.get(nodeId);
    if (!owner) continue; // orphan/unknown owner: tolerated for legacy data
    checkSlotChildren(violations, owner.type, key, zoneName, nodes);
  }
  return violations;
}

/** Parses the layout with the v2 schema AND the zone connectivity checks. */
export function validatePageLayout(
  layout: unknown,
): { ok: true; data: PageLayout } | { ok: false; issues: string[] } {
  const parsed = pageLayoutSchema.safeParse(layout);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => issue.message),
    };
  }
  const data = parsed.data as unknown as PageLayout;
  const zoneIssues = validateLayoutZones(data).map((v) => v.message);
  if (zoneIssues.length) return { ok: false, issues: zoneIssues };
  return { ok: true, data };
}

/** Walks content + inline slots + legacy zones, building `<nodeId> -> node` lookups. */
function collectNodesById(layout: PageLayout): Map<string, PuckNode> {
  const map = new Map<string, PuckNode>();
  walkLayoutNodes(layout, (node) => {
    const id = node.props?.id as string | undefined;
    if (id && !map.has(id)) map.set(id, node);
  });
  return map;
}

/** Validates a saved-section payload (node + its zone entries). */
export const savedSectionSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(160),
  node: puckNodeSchema,
  zones: z.record(z.string(), z.array(puckNodeSchema)).default({}),
});

export type SavedSectionInput = z.infer<typeof savedSectionSchema>;
