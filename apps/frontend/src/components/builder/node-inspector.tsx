'use client';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Content, Data } from '@measured/puck';
import { getBlockDefinition, isNodeArray, slotNamesFor } from '@titan/shared';
import { useBuilderPuck } from '@/lib/builder/use-builder-puck';
import { toast } from '@/components/ui/toast';
import { AnimatePresence, m } from 'framer-motion';
import { spring, transition } from '@/lib/motion';
import {
  Braces,
  Check,
  ChevronDown,
  Copy,
  TriangleAlert,
} from 'lucide-react'; /** * JSON Inspector — a coder-grade view of the selected node. * * Shows the node's raw props as JSON, validates them against the block's * zod schema (linter-style), and applies the result back into the live tree. */
export function JsonInspectorSection() {
  const t = useTranslations('ui.builder');
  const tc = useTranslations('common');
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
      setIssues([{ path: 'JSON', message: err instanceof Error ? err.message : t('invalidJson') }]);
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
    try {
      await navigator.clipboard?.writeText(JSON.stringify(selected, null, 2));
      toast({ type: 'ok', title: tc('copied') });
    } catch {
      toast({ type: 'err', title: tc('error') });
    }
  };
  return (
    <div className="border-t border-border/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
      >
        <m.span
          className="inline-flex"
          initial={false}
          animate={{ rotate: open ? 0 : -90 }}
          transition={spring.snappy}
        >
          <ChevronDown className="size-3.5" />
        </m.span>
        <Braces className="size-3.5" /> JSON
        <AnimatePresence>
        {applied && (
          <m.span
            key="applied"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1, transition: spring.snappy }}
            exit={{ opacity: 0, transition: transition.leave }}
            className="ms-auto flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-2xs font-medium text-success"
          >
            <Check className="size-3.5" /> {t('applied')}
          </m.span>
        )}
        </AnimatePresence>
      </button>
      <AnimatePresence initial={false}>
      {open && (
        <m.div
          key="json"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1, transition: spring.gentle }}
          exit={{ height: 0, opacity: 0, transition: transition.leave }}
          className="overflow-hidden"
        >
        <div className="border-t border-border/60 p-3.5">
          {' '}
          <div className="mb-2 flex flex-wrap items-center gap-2 text-2xs text-muted-foreground">
            {' '}
            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono font-medium text-primary">
              {selected.type}
            </span>{' '}
            {zoneNames.length > 0 && (
              <span>
                {t('zonesLabel')} {zoneNames.join(', ')}
              </span>
            )}{' '}
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="ms-auto flex items-center gap-1 rounded-lg border border-border/70 bg-card px-2 py-1 font-medium text-muted-foreground shadow-xs transition hover:bg-muted hover:text-foreground active:scale-95"
              title={t('copyNodeJsonHint')}
            >
              {' '}
              <Copy className="size-3.5" /> {t('copyNodeJson')}{' '}
            </button>{' '}
          </div>{' '}
          <textarea
            value={json}
            onChange={(e) => {
              draftRef.current = e.target.value;
              setJson(e.target.value);
            }}
            spellCheck={false}
            className="h-56 w-full resize-y rounded-xl border border-border/80 bg-surface-sunken/50 p-2.5 font-mono text-2xs leading-relaxed text-foreground outline-none transition focus:border-primary/50 focus:bg-background focus:ring-4 focus:ring-primary/10"
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
            className="mt-2.5 w-full rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90 active:scale-[0.98]"
          >
            {' '}
            {t('applyProps')}{' '}
          </button>{' '}
        </div>
        </m.div>
      )}
      </AnimatePresence>
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
