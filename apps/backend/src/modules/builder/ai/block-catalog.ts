import type { ZodTypeAny } from 'zod';
import {
  BLOCK_REGISTRY,
  ICON_KEYS,
  NODE_ANIMATION_DEFAULTS,
  NODE_ANIMATION_HOVERS,
  NODE_ANIMATION_TYPES,
  NODE_ANIMATION_SCHEMA_SHAPE,
  type BlockDefinition,
} from '@titan/shared';

/**
 * A compact, model-readable description of every block the builder can render.
 *
 * Generated from the registry's own zod schemas at boot, so the AI is always told exactly what
 * the validator will accept: adding a block or a prop to the registry teaches the AI builder
 * about it with no prompt edits. Shapes are written in a terse TypeScript-like notation because
 * that is what models read most reliably for the fewest tokens.
 */

/** Props every block inherits (spacing, animation). Listed once instead of on every block. */
const SHARED_PROP_NAMES = new Set([
  'marginTop', 'marginBottom', 'maxWidth', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'minHeight', 'className', 'id',
  ...Object.keys(NODE_ANIMATION_DEFAULTS),
  ...Object.keys(NODE_ANIMATION_SCHEMA_SHAPE),
]);

const ICON_SIGNATURE = [...ICON_KEYS].sort().join('|');

/** Blocks wired to live data or internal parts of a composite. The AI must not build these from scratch. */
const INTERNAL_BLOCKS = new Set(['live-island', 'product-card']);

function unwrap(schema: ZodTypeAny): { inner: ZodTypeAny; optional: boolean } {
  let current: ZodTypeAny = schema;
  let optional = false;
  for (let guard = 0; guard < 10; guard += 1) {
    const def = (current as { _def?: { typeName?: string; innerType?: ZodTypeAny; schema?: ZodTypeAny } })._def;
    const name = def?.typeName;
    if (name === 'ZodOptional' || name === 'ZodNullable' || name === 'ZodDefault') {
      optional = true;
      current = def!.innerType!;
    } else if (name === 'ZodEffects') {
      current = def!.schema!;
    } else {
      break;
    }
  }
  return { inner: current, optional };
}

export function describeZod(schema: ZodTypeAny, depth = 0): string {
  const { inner } = unwrap(schema);
  const def = (inner as { _def: Record<string, unknown> })._def;
  switch (def.typeName) {
    case 'ZodString': {
      const checks = (def.checks as Array<{ kind: string; value?: number }> | undefined) ?? [];
      const max = checks.find((c) => c.kind === 'max')?.value;
      return max && max <= 120 ? `string(${max})` : 'string';
    }
    case 'ZodNumber': {
      const checks = (def.checks as Array<{ kind: string; value?: number }> | undefined) ?? [];
      const min = checks.find((c) => c.kind === 'min')?.value;
      const max = checks.find((c) => c.kind === 'max')?.value;
      const int = checks.some((c) => c.kind === 'int');
      const range = min !== undefined || max !== undefined ? `${min ?? ''}..${max ?? ''}` : '';
      return `${int ? 'int' : 'number'}${range ? ` ${range}` : ''}`;
    }
    case 'ZodBoolean':
      return 'bool';
    case 'ZodEnum': {
      const values = def.values as string[];
      // The icon set appears on a dozen blocks; it is listed once in the header instead.
      if ([...values].sort().join('|') === ICON_SIGNATURE) return 'Icon';
      return values.map((v) => `'${v}'`).join('|');
    }
    case 'ZodNativeEnum':
      return Object.values(def.values as Record<string, string>).map((v) => `'${v}'`).join('|');
    case 'ZodLiteral':
      return JSON.stringify(def.value);
    case 'ZodUnion':
      return (def.options as ZodTypeAny[]).map((o) => describeZod(o, depth)).join('|');
    case 'ZodArray':
      return `${describeZod(def.type as ZodTypeAny, depth + 1)}[]`;
    case 'ZodRecord':
      return 'Record<string,string>';
    case 'ZodObject': {
      if (depth > 2) return 'object';
      const shape = (inner as unknown as { shape: Record<string, ZodTypeAny> }).shape;
      return `{${describeShape(shape, depth + 1, false)}}`;
    }
    default:
      return 'any';
  }
}

function describeShape(shape: Record<string, ZodTypeAny>, depth: number, skipShared: boolean): string {
  return Object.entries(shape)
    .filter(([name]) => !skipShared || !SHARED_PROP_NAMES.has(name))
    .map(([name, field]) => `${name}${unwrap(field).optional ? '?' : ''}:${describeZod(field, depth)}`)
    .join('; ');
}

function describeBlock(def: BlockDefinition): string {
  const shape = (def.schema as unknown as { shape?: Record<string, ZodTypeAny> }).shape ?? {};
  const slotNames = new Set(Object.keys(def.zones ?? {}));
  const props = Object.fromEntries(Object.entries(shape).filter(([name]) => !slotNames.has(name)));
  const lines = [`### ${def.type} — ${def.description}`];
  const described = describeShape(props, 1, true);
  if (described) lines.push(`props: {${described}}`);
  if (slotNames.size) {
    const slots = Object.entries(def.zones ?? {}).map(([name, spec]) => {
      const allow = spec.allow ? ` allow ${spec.allow.join('|')}` : ' any block';
      return `${name}[${spec.max ? `max ${spec.max};` : ''}${allow}]`;
    });
    lines.push(`slots: ${slots.join(', ')}`);
  }
  return lines.join('\n');
}

let cached: string | null = null;

/** The full catalog, grouped by category. Stable text, so provider-side prompt caching applies. */
export function blockCatalog(): string {
  if (cached) return cached;
  const groups = new Map<string, string[]>();
  for (const def of Object.values(BLOCK_REGISTRY)) {
    if (INTERNAL_BLOCKS.has(def.type)) continue;
    const list = groups.get(def.category) ?? [];
    list.push(describeBlock(def));
    groups.set(def.category, list);
  }
  const order = ['Layout', 'Content', 'Sections', 'Items', 'Chrome', 'Console'];
  const sections = [...groups.entries()]
    .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
    .map(([category, blocks]) => `## ${category}\n${blocks.join('\n')}`);
  const header = [
    'Every block also accepts: id (string), className (Tailwind classes from the allowed list),',
    'marginTop/marginBottom/paddingTop/paddingRight/paddingBottom/paddingLeft/minHeight/maxWidth (int px),',
    `entrance animation animType?:${NODE_ANIMATION_TYPES.map((t) => `'${t}'`).join('|')} (animTrigger?:'view'|'load'),`,
    `hover animHover?:${NODE_ANIMATION_HOVERS.map((t) => `'${t}'`).join('|')}.`,
    `Icon = ${ICON_KEYS.map((key) => `'${key}'`).join('|')}`,
  ].join('\n');
  cached = `${header}\n\n${sections.join('\n\n')}`;
  return cached;
}

export function isBuildableBlock(type: string): boolean {
  return type in BLOCK_REGISTRY && !INTERNAL_BLOCKS.has(type);
}
