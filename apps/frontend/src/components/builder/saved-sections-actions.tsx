'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Boxes, FolderPlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { useBuilderPuck } from '@/lib/builder/use-builder-puck';
import {
  cloneSubtree,
  extractSubtree,
  getSavedSections,
  type SavedSection,
} from '@/lib/builder/saved-sections';
import { insertNodeAtZone, type PageLayout } from '@titan/shared';
import { toast } from '@/components/ui/toast';
import { useBuilderUI } from './builder-ui-store';

const ROOT_ZONE = 'root:default-zone';

/**
 * Rendered inside the unified toolbar so it can read the current selection and
 * live page data with `usePuck`. Saved sections are tenant-scoped on the
 * backend (never localStorage).
 *
 * Inserting merges a freshly-id-cloned copy of the subtree into the live state
 * via `setData`, after anchoring the pre-insert state with a no-op `replace`
 * (the debounced history recorder captures it), so ONE undo removes the whole
 * inserted subtree.
 */
export function SavedSectionsActions() {
  const tb = useTranslations('builder');
  const appState = useBuilderPuck((s) => s.appState);
  const selectedItemRaw = useBuilderPuck((s) => s.selectedItem);
  const dispatch = useBuilderPuck((s) => s.dispatch);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<SavedSection[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const setSectionDialog = useBuilderUI((s) => s.setSectionDialog);
  const selectedNode = selectedItemRaw as (SavedSection['node'] & {
    readOnly?: boolean;
  }) | null;
  const selectedId = (selectedNode?.props?.id as string | undefined) ?? null;
  const canSave = selectedNode?.type === 'section';

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const refresh = async () => {
    try {
      setLoading(true);
      setSaved(await getSavedSections());
    } catch (e) {
      toast({
        type: 'err',
        title: tb('savedSections.loadFailed', { default: 'Could not load saved sections' }),
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (!selectedNode || !selectedId) return;
    const suggested = String((selectedNode.props?.title as string | undefined) ?? '');
    const sub = extractSubtree(appState.data as unknown as PageLayout, selectedId);
    if (!sub) {
      toast({
        type: 'err',
        title: tb('savedSections.extractFailed', {
          default: 'Could not extract the selected section from the current layout',
        }),
      });
      return;
    }
    setSectionDialog({
      mode: 'save',
      suggested,
      node: sub.node,
    });
  };

  const handleInsert = (s: SavedSection) => {
    try {
      const data = appState.data as unknown as PageLayout;
      const sel = appState.ui.itemSelector;
      const zone = sel?.zone ?? ROOT_ZONE;
      /* Clone with fresh ids so repeated inserts never collide. */
      const { node: cloned } = cloneSubtree(s.node);
      const afterSelection = sel?.zone === zone ? (sel?.index ?? 0) + 1 : undefined;
      const { layout: next, index } = insertNodeAtZone(data, zone, cloned, afterSelection);
      /* `setData` is not history-recorded, so anchor the POST-insert state with a re-indexing `set` after the merge: the debounced recorder captures a complete, detached snapshot of the inserted state, so ONE undo restores the pre-insert baseline (removing the whole subtree) and redo brings the inserted section back. Anchoring the pre-insert state instead would make redo a silent no-op. */
      /* NB: a no-op `replace` cannot be used as the anchor — replaceAction's deep-slot-removal deletes zone index entries from its input state in place, and that object is also referenced by the previously recorded history entry, so undo would restore a state whose first node's zones render empty on canvas. */
      dispatch({
        type: 'setData',
        data: () => next,
      } as never);
      dispatch({
        type: 'setUi',
        ui: {
          itemSelector: {
            index,
            zone,
          },
        },
      } as never);
      dispatch({
        type: 'set',
        state: {
          data: next,
        } as never,
        recordHistory: true,
      } as never);
      setOpen(false);
      toast({
        type: 'ok',
        title: tb('savedSections.inserted', { default: 'Section inserted' }),
        description: s.name,
      });
    } catch (e) {
      toast({
        type: 'err',
        title: tb('savedSections.insertFailed', { default: 'Insert failed' }),
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  const toggle = () => {
    if (!open) void refresh();
    setOpen((v) => !v);
  };

  return (
    <div ref={rootRef} className="relative">
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          title={
            canSave
              ? tb('savedSections.saveTooltip', {
                  default: 'Save the selected Section container as a reusable component',
                })
              : tb('savedSections.saveTooltipBlocked', {
                  default: 'Select a Section container first to save it',
                })
          }
          className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          <FolderPlus className="size-3.5" /> {tb('savedSections.save', { default: 'Save' })}
        </button>
        <button
          type="button"
          onClick={toggle}
          title={tb('savedSections.insertTooltip', {
            default: 'Insert a previously saved section',
          })}
          className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <Boxes className="size-3.5" />{' '}
          {saved.length > 0
            ? tb('savedSections.count', {
                count: saved.length,
                default: `Sections (${saved.length})`,
              })
            : tb('savedSections.label', { default: 'Sections' })}{' '}
        </button>
      </div>
      {open && (
        <div className="fixed start-3 end-3 top-[48px] z-50 w-auto rounded-xl border border-border bg-popover p-2 shadow-sm lg:absolute lg:start-0 lg:end-auto lg:top-full lg:mt-1.5 lg:w-80">
          <p className="px-2 pb-1.5 text-2xs font-bold uppercase tracking-wide text-muted-foreground">
            {tb('savedSections.listHint', {
              default: 'Reusable sections — inserted after the selected block, or at the end of the page',
            })}
          </p>
          {loading ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">
              {tb('savedSections.loading', { default: 'Loading…' })}
            </p>
          ) : saved.length === 0 ? (
            <div className="px-2 py-4 text-center">
              <p className="text-sm text-muted-foreground">
                {tb('savedSections.empty', { default: 'Nothing saved yet.' })}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                {tb('savedSections.emptyHint', {
                  default: 'Select a Section container on the canvas, then press “Save”.',
                })}
              </p>
            </div>
          ) : (
            <ul className="scrollbar-thin max-h-72 space-y-0.5 overflow-auto">
              {saved.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-1 rounded-lg px-2 py-1.5 transition hover:bg-muted"
                >
                  <span
                    className="flex-1 truncate text-13 font-medium text-foreground"
                    title={s.name}
                  >
                    {s.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleInsert(s)}
                    title={tb('savedSections.insertAfter', {
                      default: 'Insert after the selected block (or at the end of the page)',
                    })}
                    className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-2xs font-bold text-primary-foreground transition hover:opacity-90"
                  >
                    <Plus className="size-3.5" />{' '}
                    {tb('savedSections.insert', { default: 'Insert' })}{' '}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSectionDialog({
                        mode: 'rename',
                        id: s.id,
                        name: s.name,
                      })
                    }
                    title={tb('savedSections.renameTooltip', {
                      default: 'Rename this saved section',
                    })}
                    className="rounded-md p-1 text-muted-foreground transition hover:bg-muted-foreground/10 hover:text-foreground"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSectionDialog({
                        mode: 'delete',
                        id: s.id,
                        name: s.name,
                      })
                    }
                    title={tb('savedSections.deleteTooltip', {
                      default: 'Delete this saved section',
                    })}
                    className="rounded-md p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-red-500"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
