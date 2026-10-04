'use client';
import { useEffect, useRef, useState } from 'react';
import type { Content, Data } from '@measured/puck';
import { getBlockDefinition, isNodeArray, slotNamesFor } from '@titan/shared';
import { useBuilderPuck } from '@/lib/builder/use-builder-puck';
import {
  Braces,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  TriangleAlert,
} from 'lucide-react'; /** * JSON Inspector — a coder-grade view of the selected node. * * Shows the node's raw props as JSON, validates them against the block's * zod schema (linter-style), and applies the result back into the live tree. */
export function JsonInspectorSection() {
  const selected = useBuilderPuck((s) => s.selectedItem) as { type: string; props: Record<string, unknown> } | null;
  const data = useBuilderPuck((s) => s.appState.data) as unknown as Data;
  const dispatch = useBuilderPuck((s) => s.dispatch);
  const [open, setOpen] = useState(false);
  const [json, setJson] = useState('');
  const [issues, setIssues] = useState<{ path: string; message: string }[] | null>(null);
  const [applied, setApplied] = useState(false);
  const draftRef = useRef('');
  const id = (selected?.props?.id as string | undefined) ?? null;
  const def = selected ? getBlockDefinition(selected.type) : undefined;
  useEffect(() => {
    if (!selected) return;
    const { id: _id, ...rest } = selected.props;
    draftRef.current = JSON.stringify(rest, null, 2);
    setJson(draftRef.current);
    setIssues(null);
  }, [selected]);
  if (!selected || !id) return null;
  const zoneNames = Object.keys(def?.zones ?? {});
  const handleApply = () => {
    if (!selected || !id) return;
    setIssues(null);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(draftRef.current) as Record<string, unknown>;
    } catch (err) {
      setIssues([{ path: 'JSON', message: err instanceof Error ? err.message : 'Invalid JSON' }]);
      return;
    }
    const result = def?.schema.safeParse(parsed);
    if (!result) return;
    if (!result.success) {
      setIssues(
        result.error.issues.map((issue) => ({
          path: issue.path.join('.') || '(root)',
          message: issue.message,
        })),
      );
      return;
    }
    const next = withProps(data, id, { ...(result.data as Record<string, unknown>), id });
    dispatch({ type: 'setData', data: next } as never);
    draftRef.current = JSON.stringify(result.data, null, 2);
    setJson(draftRef.current);
    setApplied(true);
    window.setTimeout(() => setApplied(false), 2000);
  };
  const handleCopy = async () => {
    if (!selected) return;
    await navigator.clipboard?.writeText(JSON.stringify(selected, null, 2));
  };
  return (
    <div className="border-t border-border">
      {' '}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-2xs font-bold uppercase tracking-wide text-muted-foreground transition hover:bg-muted"
      >
        {' '}
        {open ? (
          <ChevronDown className="size-3.5" />
        ) : (
          <ChevronRight className="flip-rtl size-3.5" />
        )}{' '}
        <Braces className="size-3.5" /> JSON{' '}
        {applied && (
          <span className="ms-auto flex items-center gap-1 font-semibold normal-case text-green-600">
            {' '}
            <Check className="size-3.5" /> Applied{' '}
          </span>
        )}{' '}
      </button>{' '}
      {open && (
        <div className="border-t border-border p-3">
          {' '}
          <div className="mb-2 flex flex-wrap items-center gap-2 text-2xs text-muted-foreground">
            {' '}
            <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono font-bold text-primary">
              {selected.type}
            </span>{' '}
            {zoneNames.length > 0 && <span>zones: {zoneNames.join(', ')}</span>}{' '}
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="ms-auto flex items-center gap-1 rounded-md border border-border px-2 py-1 font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
              title="Copy the whole node (type + props + id) as JSON"
            >
              {' '}
              <Copy className="size-3.5" /> Copy node JSON{' '}
            </button>{' '}
          </div>{' '}
          <textarea
            value={json}
            onChange={(e) => {
              draftRef.current = e.target.value;
              setJson(e.target.value);
            }}
            spellCheck={false}
            className="h-56 w-full resize-y rounded-md border border-border bg-background p-2 font-mono text-2xs leading-relaxed text-foreground outline-none focus:border-primary"
          />{' '}
          {issues && (
            <ul className="mt-2 space-y-0.5">
              {' '}
              {issues.map((issue, i) => (
                <li
                  key={i}
                  className="flex items-start gap-1.5 text-2xs font-medium text-destructive"
                >
                  {' '}
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />{' '}
                  <span>
                    {' '}
                    <span className="font-mono">{issue.path}</span> — {issue.message}{' '}
                  </span>{' '}
                </li>
              ))}{' '}
            </ul>
          )}{' '}
          <button
            type="button"
            onClick={handleApply}
            className="mt-2 w-full rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition hover:opacity-90"
          >
            {' '}
            Apply props (validated){' '}
          </button>{' '}
        </div>
      )}{' '}
    </div>
  );
} /** Replaces the props of the node with the given id across content + inline slots. */
function withProps(data: Data, id: string, props: Record<string, unknown>): Data {
  // eslint-disable-line
const map = (list: Array<{ type: string; props?: Record<string, unknown> }>): Content =>
    (list ?? []).map((item) => {
      if (item.props?.id === id) return { ...item, props };
      const nextProps = { ...(item.props ?? {}) };
      let changed = false;
      for (const slot of slotNamesFor(item.type)) {
        const kids = nextProps[slot];
        if (isNodeArray(kids)) {
          const rewritten = map(kids as Content) as unknown as Record<string, unknown>[];
          if (rewritten.some((kid, i) => kid !== (kids as unknown[])[i])) {
            nextProps[slot] = rewritten;
            changed = true;
          }
        }
      }
      return changed ? { ...item, props: nextProps } : item;
    }) as unknown as Content;
  return { ...data, content: map((data.content ?? []) as Content) } as Data;
}
