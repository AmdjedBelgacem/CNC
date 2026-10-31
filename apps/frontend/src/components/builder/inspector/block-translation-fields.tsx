'use client';

import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { useBuilderTranslation } from '@/components/builder/translation-context';
import { FieldRow } from './controls';
import { findNodeById, harvestBlock, type PuckNode } from '@titan/shared';

interface Props {
  selected: { type: string; props: Record<string, unknown> };
}

/**
 * Per-block Arabic copy.
 *
 * The page stores Arabic as a complete alternate layout. Each node is matched by its stable
 * `props.id` rather than by array position, so inserting or reordering English blocks never
 * writes a translation into a different block. Harvested field paths are relative to the node's
 * props and are used unchanged for both read and write.
 */
export function BlockTranslationFields({ selected }: Props) {
  const ctx = useBuilderTranslation();
  const nodeId = typeof selected.props?.id === 'string' ? selected.props.id : null;

  const translatable = useMemo(() => {
    if (!nodeId) return [];
    return harvestBlock(
      {
        id: nodeId,
        type: selected.type,
        sortOrder: 0,
        content: selected.props ?? {},
      } as any,
      {},
    ).filter((field) => field.value.trim().length > 0);
  }, [nodeId, selected]);

  const arabicNode = useMemo(() => {
    if (!ctx?.arabicLayout || !nodeId) return null;
    return findNodeById(ctx.arabicLayout, nodeId);
  }, [ctx?.arabicLayout, nodeId]);

  if (!ctx || !nodeId || translatable.length === 0) return null;

  const onAi = async () => {
    await ctx.translateBlock(
      { type: selected.type, props: selected.props } as unknown as PuckNode,
      translatable,
    );
  };

  return (
    <div className="space-y-3 border-b border-border/60 px-3.5 py-3">
      <div className="flex items-center justify-between">
        <span className="font-display text-sm font-medium tracking-[-0.01em] text-foreground">
          Arabic version
        </span>
        <button
          type="button"
          onClick={() => void onAi()}
          disabled={ctx.translating}
          className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary transition hover:bg-primary/10 active:scale-95 disabled:opacity-50"
        >
          <Sparkles className="size-3.5" />
          AI translate
        </button>
      </div>
      {translatable.map((field) => {
        const arValue = arabicNode ? readAt(arabicNode.props, field.path) : undefined;
        return (
          <FieldRow key={field.path} label={field.path.split('.').pop() ?? field.path}>
            <textarea
              value={typeof arValue === 'string' ? arValue : ''}
              onChange={(event) => ctx.setArabicField(nodeId, field.path, event.target.value)}
              placeholder={field.value}
              dir="rtl"
              rows={2}
              className="w-full resize-y rounded-lg border border-border/80 bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
            />
          </FieldRow>
        );
      })}
    </div>
  );
}

function readAt(root: unknown, path: string): unknown {
  let current: unknown = root;
  for (const key of path.split('.')) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}
