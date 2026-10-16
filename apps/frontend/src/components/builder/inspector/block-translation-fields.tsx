'use client';
import { useMemo, useState } from 'react';

import { Sparkles } from 'lucide-react';
import { useBuilderPuck } from '@/lib/builder/use-builder-puck';
import { useBuilderTranslation } from '@/components/builder/translation-context';
import { FieldRow } from './controls';
import { harvestBlock } from '@titan/shared';

interface Props {
  selected: { type: string; props: Record<string, unknown> };
}

/**
 * Per-block Arabic copy.
 *
 * The page stores Arabic as a complete alternate layout, so editing one block's Arabic text
 * means writing into that tree at the same node position. The context owns that tree and the
 * persistence; this component is just the surface for the currently selected block.
 */
export function BlockTranslationFields({ selected }: Props) {
  const ctx = useBuilderTranslation();
  const data = useBuilderPuck((s) => (s as any).appState?.data ?? null);
  const [busy, setBusy] = useState(false);

  // Find the selected block's positional key in the English layout (n3 / z:content:0).
  const nodeKey = useMemo(() => {
    if (!data) return null;
    const target = selected.props?.id;
    // Walk content + zones, matching by reference first, then by id.
    const walk = (nodes: any[], prefix: (i: number) => string): string | null => {
      for (let i = 0; i < (nodes?.length ?? 0); i++) {
        const node = nodes[i];
        if (node === selected || (target && node?.props?.id === target)) {
          return prefix(i);
        }
        // Recurse into slots.
        for (const [k, v] of Object.entries(node?.props ?? {})) {
          if (Array.isArray(v) && v.length && v[0]?.type) {
            const found = walk(v as any[], (j) => `${prefix(i)}.props.${k}.${j}`);
            if (found) return found;
          }
        }
      }
      return null;
    };
    let found = walk((data as any).content ?? [], (i) => `n${i}`);
    if (!found) {
      for (const [zone, nodes] of Object.entries((data as any).zones ?? {})) {
        found = walk(nodes as any[], (i) => `z:${zone}:${i}`);
        if (found) break;
      }
    }
    return found;
  }, [data, selected]);

  const harvested = useMemo(() => {
    if (!nodeKey) return [];
    const block = { id: nodeKey, type: selected.type, sortOrder: 0, content: selected.props ?? {} } as any;
    return harvestBlock(block, {}).map((f) => ({ ...f, key: `${nodeKey}:${f.key}` }));
  }, [nodeKey, selected]);

  const translatable = harvested.filter((f) => f.value.trim().length > 0 || true);

  if (!ctx || !nodeKey || translatable.length === 0) return null;

  const arabicNode = ctx.arabicLayout ? readNode(ctx.arabicLayout, nodeKey) : null;

  const onAi = async () => {
    setBusy(true);
    const fields = harvested.filter((f) => f.value.trim().length > 0);
    if (fields.length === 0) { setBusy(false); return; }
    await ctx.translateBlock(selected as any, fields);
    setBusy(false);
  };

  return (
    <div className="border-b border-border px-3 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
          Arabic version
        </span>
        <button
          type="button"
          onClick={() => void onAi()}
          disabled={ctx.translating || busy}
          className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
        >
          <Sparkles className="size-3.5" />
          AI translate
        </button>
      </div>
      {harvested.map((field) => {
        const propPath = field.key.split(':')[1] ?? field.key; // props.text
        const arValue = arabicNode ? readAt(arabicNode, propPath) : '';
        return (
          <FieldRow key={field.key} label={field.key.split('.').pop() ?? field.key}>
            <textarea
              value={typeof arValue === 'string' ? arValue : ''}
              onChange={(e) => ctx.setArabicField(field.key, e.target.value)}
              placeholder={field.value}
              dir="rtl"
              rows={2}
              className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            />
          </FieldRow>
        );
      })}
    </div>
  );
}

function readNode(layout: any, key: string): any {
  const segments = key.split('.');
  let cursor: any = layout;
  // key is like "n3" or "z:content:0" — top-level node index
  const top = segments[0]!;
  if (top.startsWith('n')) {
    const idx = Number(top.slice(1));
    cursor = layout.content?.[idx];
  } else if (top.startsWith('z:')) {
    const parts = top.split(':');
    const zone = parts[1];
    const idx = Number(parts[2]);
    if (zone && layout?.zones?.[zone]) {
      cursor = layout.zones[zone][idx];
    }
  }
  return cursor?.props ?? null;
}

function readAt(root: unknown, path: string): unknown {
  let current: unknown = root;
  for (const key of path.split('.')) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}