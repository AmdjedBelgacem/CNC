'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  GripVertical,
  Link2,
  Loader2,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
// There is no alert-dialog primitive in this design system; the confirm reuses
// Dialog so it inherits the same overlay, focus trap and Escape handling.

/**
 * Navigation tree editor.
 *
 * The whole tree is edited in local state and saved with one PUT. Per-item
 * endpoints would make a single drag two or three calls, each of which can
 * half-apply, and the server already replaces the tree transactionally.
 *
 * Reordering is up/down buttons rather than drag-and-drop on purpose: a
 * keyboard-reachable move is a move that works for everyone, and a DnD tree
 * that only responds to a mouse is a tree half the staff cannot edit.
 */

interface NavNode {
  id?: string;
  label: string;
  labelAr?: string | null;
  type: 'page' | 'url' | 'group';
  href?: string | null;
  pageSlug?: string | null;
  visible?: boolean;
  openInNewTab?: boolean;
  children?: NavNode[];
  // Server-computed, editor-only:
  pageStatus?: string | null;
  pageMissing?: boolean;
  pageDisabled?: boolean;
}

interface PageOption {
  slug: string;
  title: string;
}

let draftSeq = 0;
const newId = () => `new-${(draftSeq += 1)}`;

export function NavigationEditor() {
  const t = useTranslations('admin.navigation');
  const [tree, setTree] = useState<NavNode[]>([]);
  const [pages, setPages] = useState<PageOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState<{ node: NavNode; parentId: string | null } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ node: NavNode; parentId: string | null } | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nav, pageList] = await Promise.all([
        api.get<NavNode[]>('/builder/navigation'),
        api.get<{ slug: string; title: string }[]>('/builder/pages'),
      ]);
      setTree(nav ?? []);
      // A page picker should offer every page, not just published ones: an admin
      // often wires a link before the page goes live.
      setPages(pageList ?? []);
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('loadFailed'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /* ------------------------------------------------------------ mutations */

  const mutate = (fn: (draft: NavNode[]) => NavNode[]) => {
    setTree((current) => fn(structuredClone(current)));
    setDirty(true);
    setSaved(false);
  };

  const updateNode = (parentId: string | null, id: string, patch: Partial<NavNode>) => {
    mutate((draft) => {
      const list = parentId ? findChildren(draft, parentId) : draft;
      const node = list?.find((n) => (n.id ?? newIdOf(n)) === id);
      if (node) Object.assign(node, patch);
      return draft;
    });
  };

  const removeNode = (parentId: string | null, id: string) => {
    mutate((draft) => {
      if (parentId) {
        const parent = findNode(draft, parentId);
        if (parent) parent.children = (parent.children ?? []).filter((c) => (c.id ?? newIdOf(c)) !== id);
      } else {
        return draft.filter((n) => (n.id ?? newIdOf(n)) !== id);
      }
      return draft;
    });
  };

  const move = (parentId: string | null, id: string, direction: -1 | 1) => {
    mutate((draft) => {
      const list = parentId ? findChildren(draft, parentId) : draft;
      if (!list) return draft;
      const index = list.findIndex((n) => (n.id ?? newIdOf(n)) === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= list.length) return draft;
      const [node] = list.splice(index, 1);
      list.splice(target, 0, node!);
      return draft;
    });
  };

  const addNode = (parentId: string | null, node: NavNode) => {
    mutate((draft) => {
      if (parentId) {
        const parent = findNode(draft, parentId);
        if (parent) {
          parent.children = [...(parent.children ?? []), node];
          return draft;
        }
      }
      draft.push(node);
      return draft;
    });
  };

  /* -------------------------------------------------------------- saving */

  const serialize = (nodes: NavNode[]): unknown[] =>
    nodes.map((n) => ({
      id: n.id,
      label: n.label,
      labelAr: n.labelAr || null,
      type: n.type,
      href: n.type === 'url' ? n.href || null : null,
      pageSlug: n.type === 'page' ? n.pageSlug || null : null,
      visible: n.visible !== false,
      openInNewTab: !!n.openInNewTab,
      children: n.children?.length ? serialize(n.children) : [],
    }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await api.put<NavNode[]>('/builder/navigation', {
        items: serialize(tree),
      });
      setTree(result ?? []);
      setDirty(false);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const pageOptions = useMemo(
    () => pages.map((p) => ({ slug: p.slug, title: p.title, status: 'unknown' as string })),
    [pages],
  );

  const stats = useMemo(() => {
    let links = 0;
    let groups = 0;
    const walk = (nodes: NavNode[]) => {
      for (const n of nodes) {
        if (n.type === 'group') groups += 1;
        else links += 1;
        if (n.children) walk(n.children);
      }
    };
    walk(tree);
    return { links, groups };
  }, [tree]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {stats.links === 1 ? t('linkCount') : t('linksCount', { count: stats.links })}
          {stats.groups > 0 &&
            ` · ${stats.groups === 1 ? t('groupSuffix') : t('groupsSuffix', { count: stats.groups })}`}
        </div>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-xs text-muted-foreground">{t('unsaved')}</span>}
          {saved && !dirty && <span className="text-xs text-success">{t('saved')}</span>}
          <Button variant="outline" onClick={() => void load()} disabled={saving || !dirty}>
            {t('discard')}
          </Button>
          <Button onClick={() => void save()} disabled={saving || !dirty}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {t('save')}
          </Button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {tree.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {t('empty')}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button
              variant="outline"
              onClick={() =>
                setEditing({ node: { id: newId(), label: '', type: 'url' }, parentId: null })
              }
            >
              <Plus className="size-4" />
              {t('addLink')}
            </Button>
            <Button onClick={() => setEditing({ node: { id: newId(), label: '', type: 'group' }, parentId: null })}>
              <Plus className="size-4" />
              {t('addDropdown')}
            </Button>
          </div>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {tree.map((node) => (
            <NavRow
              key={node.id ?? newIdOf(node)}
              node={node}
              depth={0}
              pageOptions={pageOptions}
              onEdit={() => setEditing({ node, parentId: null })}
              onDelete={() => setConfirmDelete({ node, parentId: null })}
              onToggle={() =>
                updateNode(null, node.id ?? newIdOf(node), { visible: node.visible === false })
              }
              onMove={(dir) => move(null, node.id ?? newIdOf(node), dir)}
              onAddChild={() =>
                setEditing({ node: { id: newId(), label: '', type: 'url' }, parentId: node.id ?? newIdOf(node) })
              }
              onEditChild={(child, parentId) => setEditing({ node: child, parentId })}
              onDeleteChild={(child, parentId) => setConfirmDelete({ node: child, parentId })}
              onToggleChild={(child, parentId) =>
                updateNode(parentId, child.id ?? newIdOf(child), { visible: child.visible === false })
              }
              onMoveChild={(child, parentId, dir) => move(parentId, child.id ?? newIdOf(child), dir)}
            />
          ))}
        </ul>
      )}

      {tree.length > 0 && (
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing({ node: { id: newId(), label: '', type: 'url' }, parentId: null })}
          >
            <Plus className="size-4" />
            {t('addLink')}
          </Button>
          <Button
            size="sm"
            onClick={() => setEditing({ node: { id: newId(), label: '', type: 'group' }, parentId: null })}
          >
            <Plus className="size-4" />
            {t('addDropdown')}
          </Button>
        </div>
      )}

      {editing && (
        <ItemDialog
          node={editing.node}
          pageOptions={pageOptions}
          onClose={() => setEditing(null)}
          onSubmit={(next) => {
            if (editing.node.id && treeHasId(tree, editing.node.id)) {
              // Existing row: patch in place so the server keeps its id.
              mutate((draft) => {
                const list = editing.parentId ? findChildren(draft, editing.parentId) : draft;
                const found = list?.find((n) => n.id === editing.node.id);
                if (found) Object.assign(found, next);
                return draft;
              });
            } else {
              addNode(editing.parentId, { ...next, id: editing.node.id });
            }
            setEditing(null);
          }}
        />
      )}

      {confirmDelete && (
        <Dialog open onOpenChange={(open) => !open && setConfirmDelete(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('deleteTitle', { label: confirmDelete.node.label })}</DialogTitle>
              <DialogDescription>
                {confirmDelete.node.children?.length
                  ? t('deleteWithChildren', { count: confirmDelete.node.children.length })
                  : t('deleteSimple')}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDelete(null)}>
                {t('cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  removeNode(confirmDelete.parentId, confirmDelete.node.id ?? newIdOf(confirmDelete.node));
                  setConfirmDelete(null);
                }}
              >
                <Trash2 className="size-4" />
                {t('delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ rows */

function NavRow({
  node,
  depth,
  pageOptions,
  onEdit,
  onDelete,
  onToggle,
  onMove,
  onAddChild,
  onEditChild,
  onDeleteChild,
  onToggleChild,
  onMoveChild,
}: {
  node: NavNode;
  depth: number;
  pageOptions: PageOption[];
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onMove: (dir: -1 | 1) => void;
  onAddChild: () => void;
  onEditChild: (child: NavNode, parentId: string) => void;
  onDeleteChild: (child: NavNode, parentId: string) => void;
  onToggleChild: (child: NavNode, parentId: string) => void;
  onMoveChild: (child: NavNode, parentId: string, dir: -1 | 1) => void;
}) {
  const t = useTranslations('admin.navigation');
  const [open, setOpen] = useState(true);
  const isGroup = node.type === 'group';
  const hidden = node.visible === false;
  const broken = node.type === 'page' && (node.pageMissing || node.pageDisabled);

  return (
    <li>
      <div
        className={cn(
          'flex items-center gap-2 rounded-md border border-border bg-card px-2 py-2',
          hidden && 'opacity-60',
        )}
      >
        {isGroup ? (
          <button
            type="button"
            aria-label={open ? t('collapse') : t('expand')}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
          >
            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="flip-rtl size-4" />}
          </button>
        ) : (
          <GripVertical className="size-4 shrink-0 text-muted-foreground/40" aria-hidden />
        )}

        <button
          type="button"
          onClick={onEdit}
          className="flex min-w-0 flex-1 items-center gap-2 text-start"
        >
          <span className="truncate text-sm font-medium">{node.label || t('noLabel')}</span>
          {node.labelAr && (
            <span dir="rtl" className="shrink-0 text-xs text-muted-foreground">
              {node.labelAr}
            </span>
          )}
          {isGroup ? (
            <span className="shrink-0 rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-[10px] uppercase text-secondary-foreground">
              {t('groupBadge')}
            </span>
          ) : (
            <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
              {node.type === 'page' ? `/${node.pageSlug}` : node.href}
              {node.openInNewTab && <ExternalLink className="ms-1 inline size-3" aria-hidden />}
            </span>
          )}
          {broken && (
            <span className="shrink-0 rounded-sm bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning">
              {node.pageMissing ? t('pageMissing') : t('pageDisabled')}
            </span>
          )}
        </button>

        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton label={t('moveUp')} onClick={() => onMove(-1)}>
            <ChevronDown className="size-4 rotate-180" />
          </IconButton>
          <IconButton label={t('moveDown')} onClick={() => onMove(1)}>
            <ChevronDown className="size-4" />
          </IconButton>
          {isGroup && (
            <IconButton label={t('addChild')} onClick={onAddChild}>
              <Plus className="size-4" />
            </IconButton>
          )}
          <IconButton label={hidden ? t('show') : t('hide')} onClick={onToggle}>
            {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </IconButton>
          <IconButton label={t('delete')} onClick={onDelete} danger>
            <Trash2 className="size-4" />
          </IconButton>
        </div>
      </div>

      {isGroup && open && node.children?.length ? (
        <ul className="mt-1.5 space-y-1.5 border-s-2 border-border/60 ps-4 pe-0">
          {node.children.map((child) => (
            <NavRow
              key={child.id ?? newIdOf(child)}
              node={child}
              depth={depth + 1}
              pageOptions={pageOptions}
              onEdit={() => onEditChild(child, node.id ?? newIdOf(node))}
              onDelete={() => onDeleteChild(child, node.id ?? newIdOf(node))}
              onToggle={() => onToggleChild(child, node.id ?? newIdOf(node))}
              onMove={(dir) => onMoveChild(child, node.id ?? newIdOf(node), dir)}
              onAddChild={() => {}}
              onEditChild={() => {}}
              onDeleteChild={() => {}}
              onToggleChild={() => {}}
              onMoveChild={() => {}}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function IconButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        danger && 'hover:bg-destructive/10 hover:text-destructive',
      )}
    >
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------- dialog */

function ItemDialog({
  node,
  pageOptions,
  onClose,
  onSubmit,
}: {
  node: NavNode;
  pageOptions: PageOption[];
  onClose: () => void;
  onSubmit: (next: NavNode) => void;
}) {
  const t = useTranslations('admin.navigation');
  const [draft, setDraft] = useState<NavNode>({ ...node });
  const set = (patch: Partial<NavNode>) => setDraft((d) => ({ ...d, ...patch }));
  const isGroup = draft.type === 'group';

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isGroup ? t('dialogGroupTitle') : t('dialogLinkTitle')}</DialogTitle>
          <DialogDescription>
            {isGroup ? t('dialogGroupDesc') : t('dialogLinkDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nav-label">{t('labelEn')}</Label>
            <Input
              id="nav-label"
              value={draft.label}
              onChange={(e) => set({ label: e.target.value })}
              placeholder={t('labelEnPlaceholder')}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nav-label-ar">{t('labelAr')}</Label>
            <Input
              id="nav-label-ar"
              dir="rtl"
              lang="ar"
              value={draft.labelAr ?? ''}
              onChange={(e) => set({ labelAr: e.target.value })}
              placeholder={t('labelArPlaceholder')}
            />
            <p className="text-xs text-muted-foreground">
              {t('labelArHint')}
            </p>
          </div>

          {!isGroup && (
            <>
              <div className="space-y-2">
                <Label>{t('linkType')}</Label>
                <Select value={draft.type} onValueChange={(v) => set({ type: v as NavNode['type'] })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="page">{t('typePage')}</SelectItem>
                    <SelectItem value="url">{t('typeUrl')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {draft.type === 'page' ? (
                <div className="space-y-2">
                  <Label htmlFor="nav-page">{t('page')}</Label>
                  <Select
                    value={draft.pageSlug ?? ''}
                    onValueChange={(v) => set({ pageSlug: v })}
                  >
                    <SelectTrigger id="nav-page">
                      <SelectValue placeholder={t('choosePage')} />
                    </SelectTrigger>
                    <SelectContent>
                      {pageOptions.map((p) => (
                        <SelectItem key={p.slug} value={p.slug}>
                          {p.title} — /{p.slug}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {t('pageHint')}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="nav-href">{t('url')}</Label>
                  <Input
                    id="nav-href"
                    value={draft.href ?? ''}
                    onChange={(e) => set({ href: e.target.value })}
                    placeholder={t('urlPlaceholder')}
                  />
                </div>
              )}

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!draft.openInNewTab}
                  onChange={(e) => set({ openInNewTab: e.target.checked })}
                  className="size-4 rounded border-input"
                />
                {t('newTab')}
              </label>
            </>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.visible !== false}
              onChange={(e) => set({ visible: e.target.checked })}
              className="size-4 rounded border-input"
            />
            {t('visible')}
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button
            disabled={!draft.label.trim()}
            onClick={() =>
              onSubmit({
                ...draft,
                label: draft.label.trim(),
                href: draft.type === 'url' ? draft.href?.trim() : null,
                pageSlug: draft.type === 'page' ? draft.pageSlug ?? null : null,
              })
            }
          >
            <Link2 className="size-4" />
            {node.id && treeHasId([node], node.id) ? t('saveLink') : t('addLink')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------------------------------------- helpers */

/** Stable identity for a node that the editor has not persisted yet. */
function newIdOf(node: NavNode): string {
  return node.id ?? '';
}

function treeHasId(nodes: NavNode[], id: string): boolean {
  return nodes.some((n) => n.id === id || (n.children ? treeHasId(n.children, id) : false));
}

function findNode(nodes: NavNode[], id: string): NavNode | undefined {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) {
      const hit = findNode(n.children, id);
      if (hit) return hit;
    }
  }
  return undefined;
}

function findChildren(nodes: NavNode[], id: string): NavNode[] | undefined {
  return findNode(nodes, id)?.children;
}
