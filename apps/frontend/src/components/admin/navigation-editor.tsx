'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ExternalLink,
  EyeOff,
  Eye,
  FolderTree,
  Link2,
  ListTree,
  Menu,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { AnimatePresence, m } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ease, spring } from '@/lib/motion';
import { AdminCommandBar, AdminPageHeader } from '@/components/admin/admin-chrome';
import { Field, FormSection, SelectField, SwitchField, TextField, TextInput } from '@/components/admin/admin-form';
import { SaveDock } from '@/components/admin/form-page';
import {
  DragHandle,
  SortableItem,
  SortableList,
  arrayMove,
  useSortableItem,
} from '@/components/admin/sortable-list';
import { Reveal } from '@/components/ui/motion';
import { ErrorState } from '@/components/ui/states';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
// There is no alert-dialog primitive in this design system; the confirm reuses
// Dialog so it inherits the same overlay, focus trap and Escape handling.

/**
 * Navigation tree editor.
 *
 * The whole tree is edited in local state and saved with one PUT. Per-item
 * endpoints would make a single drag two or three calls, each of which can
 * half-apply, and the server already replaces the tree transactionally.
 *
 * Reordering is by dragging the grip (SortableList) or with the arrow keys on
 * the grip / the move buttons, so a pointer is never required.
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

interface NodeErrors {
  label?: 'labelRequired' | 'labelDuplicate';
  target?: 'urlRequired' | 'urlInvalid' | 'pageRequired';
}

let draftSeq = 0;
const newId = () => `new-${(draftSeq += 1)}`;

/** Stable identity for a node that the editor has not persisted yet. */
const idOf = (node: NavNode): string => node.id ?? '';

/**
 * What a custom URL may be: a site path, an http(s) address, or mail/phone. The
 * server separately rejects `javascript:` — here it simply is not a valid shape.
 */
type UrlKind = 'internal' | 'external' | 'invalid' | 'empty';
function urlKind(raw: string | null | undefined): UrlKind {
  const value = (raw ?? '').trim();
  if (!value) return 'empty';
  if (/^\/(?!\/)/.test(value) || value.startsWith('#')) return 'internal';
  if (/^https?:\/\/\S+$/i.test(value) || /^(mailto|tel):\S+$/i.test(value)) return 'external';
  return 'invalid';
}

/** The same tree the PUT sends — also the basis for the "has unsaved edits" check. */
function serialize(nodes: NavNode[]): unknown[] {
  return nodes.map((n) => ({
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
}

function validate(nodes: NavNode[], out: Record<string, NodeErrors> = {}): Record<string, NodeErrors> {
  const seen = new Set<string>();
  for (const n of nodes) {
    const errors: NodeErrors = {};
    const label = n.label.trim();
    if (!label) errors.label = 'labelRequired';
    else if (seen.has(label.toLowerCase())) errors.label = 'labelDuplicate';
    seen.add(label.toLowerCase());
    if (n.type === 'url') {
      const kind = urlKind(n.href);
      if (kind === 'empty') errors.target = 'urlRequired';
      else if (kind === 'invalid') errors.target = 'urlInvalid';
    } else if (n.type === 'page' && !n.pageSlug) {
      errors.target = 'pageRequired';
    }
    if (errors.label || errors.target) out[idOf(n)] = errors;
    if (n.children?.length) validate(n.children, out);
  }
  return out;
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

/** Document order, used to find the first invalid item. */
function flatIds(nodes: NavNode[]): string[] {
  return nodes.flatMap((n) => [idOf(n), ...(n.children ? flatIds(n.children) : [])]);
}

/* ---------------------------------------------------------------- context */

interface NavContext {
  pages: PageOption[];
  openId: string | null;
  setOpenId: (id: string | null) => void;
  attempted: boolean;
  errors: Record<string, NodeErrors>;
  update: (id: string, patch: Partial<NavNode>) => void;
  requestDelete: (node: NavNode, parentId: string | null) => void;
  addChild: (parentId: string) => void;
  moveWithin: (parentId: string | null, from: number, to: number) => void;
}

const NavCtx = createContext<NavContext | null>(null);
const useNav = () => {
  const ctx = useContext(NavCtx);
  if (!ctx) throw new Error('NavCtx missing');
  return ctx;
};

/* ----------------------------------------------------------------- editor */

export function NavigationEditor() {
  const t = useTranslations('admin.navigation');
  const [tree, setTree] = useState<NavNode[]>([]);
  const [saved, setSaved] = useState<NavNode[]>([]);
  const [pages, setPages] = useState<PageOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    node: NavNode;
    parentId: string | null;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [nav, pageList] = await Promise.all([
        api.get<NavNode[]>('/builder/navigation'),
        api.get<{ slug: string; title: string }[]>('/builder/pages'),
      ]);
      setTree(nav ?? []);
      setSaved(structuredClone(nav ?? []));
      // A page picker should offer every page, not just published ones: an admin
      // often wires a link before the page goes live.
      setPages(pageList ?? []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : t('loadFailed'));
    } finally {
      setLoading(false);
    }
    // `t` is stable per locale; reloading on it would refetch for no reason.
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** True only when the tree differs from what the server holds. */
  const dirty = useMemo(
    () => JSON.stringify(serialize(tree)) !== JSON.stringify(serialize(saved)),
    [tree, saved],
  );
  const errors = useMemo(() => validate(tree), [tree]);
  const errorCount = Object.keys(errors).length;

  /* ------------------------------------------------------------ mutations */

  const mutate = useCallback((fn: (draft: NavNode[]) => NavNode[]) => {
    setTree((current) => fn(structuredClone(current)));
  }, []);

  const update = useCallback(
    (id: string, patch: Partial<NavNode>) => {
      mutate((draft) => {
        const node = findNode(draft, id);
        if (node) Object.assign(node, patch);
        return draft;
      });
    },
    [mutate],
  );

  const removeNode = (parentId: string | null, id: string) => {
    mutate((draft) => {
      if (parentId) {
        const parent = findNode(draft, parentId);
        if (parent) parent.children = (parent.children ?? []).filter((c) => idOf(c) !== id);
        return draft;
      }
      return draft.filter((n) => idOf(n) !== id);
    });
    if (openId === id) setOpenId(null);
  };

  const moveWithin = useCallback(
    (parentId: string | null, from: number, to: number) => {
      mutate((draft) => {
        if (!parentId) return arrayMove(draft, from, to);
        const parent = findNode(draft, parentId);
        if (parent?.children) parent.children = arrayMove(parent.children, from, to);
        return draft;
      });
    },
    [mutate],
  );

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
    setOpenId(idOf(node));
  };

  const addChild = useCallback(
    (parentId: string) => addNode(parentId, { id: newId(), label: '', type: 'url', href: '' }),
    [],
  );

  /* --------------------------------------------------------------- saving */

  const save = async () => {
    setAttempted(true);
    if (errorCount > 0) {
      // Bring the first problem into view rather than leaving the author to hunt for it.
      const first = flatIds(tree).find((id) => errors[id]);
      if (first) {
        setOpenId(first);
        window.setTimeout(
          () =>
            document
              .getElementById(`nav-item-${first}`)
              ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
          120,
        );
      }
      toast({ type: 'err', title: t('fixErrors') });
      return;
    }
    setSaving(true);
    setFailed(false);
    setError(null);
    try {
      const result = await api.put<NavNode[]>('/builder/navigation', {
        items: serialize(tree),
      });
      setTree(result ?? []);
      setSaved(structuredClone(result ?? []));
      setAttempted(false);
      setOpenId(null);
    } catch (e) {
      setFailed(true);
      setError(e instanceof Error ? e.message : t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    setTree(structuredClone(saved));
    setAttempted(false);
    setError(null);
    setOpenId(null);
  };

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

  const ctx = useMemo<NavContext>(
    () => ({
      pages,
      openId,
      setOpenId,
      attempted,
      errors,
      update,
      requestDelete: (node, parentId) => setConfirmDelete({ node, parentId }),
      addChild,
      moveWithin,
    }),
    [pages, openId, attempted, errors, update, addChild, moveWithin],
  );

  const trail = [{ label: t('title') }];

  if (loading) {
    return (
      <div className="w-full">
        <AdminCommandBar trail={trail} live={false} />
        <div className="mx-auto w-full max-w-6xl space-y-6 pt-6" aria-busy="true">
          <div className="space-y-3 pt-2">
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-4 w-80" />
          </div>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="space-y-2 rounded-xl border border-border/70 bg-card p-5 shadow-xs">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="w-full">
        <AdminCommandBar trail={trail} live={false} />
        <div className="mx-auto w-full max-w-3xl pt-10">
          <div className="rounded-xl border border-border/70 bg-card shadow-xs">
            <ErrorState title={t('loadFailed')} description={loadError} onRetry={() => void load()} />
          </div>
        </div>
      </div>
    );
  }

  const topKeys = tree.map(idOf);

  return (
    <div className="w-full">
      <AdminCommandBar trail={trail} live={false} />

      <div className="space-y-6 pt-6">
        <div className="mx-auto w-full max-w-6xl">
          <AdminPageHeader
            title={t('title')}
            description={t('description')}
            badge={
              <span className="text-sm tabular-nums text-muted-foreground">
                {stats.links === 1 ? t('linkCount') : t('linksCount', { count: stats.links })}
                {stats.groups > 0 &&
                  ` · ${stats.groups === 1 ? t('groupSuffix') : t('groupsSuffix', { count: stats.groups })}`}
              </span>
            }
          />
        </div>

        <AnimatePresence initial={false}>
          {error && (
            <m.div
              key="error"
              role="alert"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.24, ease: ease.emerge } }}
              exit={{ opacity: 0, transition: { duration: 0.14 } }}
              className="mx-auto flex w-full max-w-6xl items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/[0.06] px-4 py-3 text-sm text-destructive"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </m.div>
          )}
        </AnimatePresence>

        <div className="mx-auto grid w-full max-w-6xl items-start gap-6 pb-28 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <NavCtx.Provider value={ctx}>
            <Reveal className="min-w-0 xl:order-1">
              <FormSection
                id="structure"
                icon={ListTree}
                title={t('builderTitle')}
                description={t('builderHint')}
                actions={
                  tree.length > 0 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => addNode(null, { id: newId(), label: '', type: 'url', href: '' })}
                        className="pressable inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 text-13 font-medium shadow-xs transition-colors hover:border-border-strong hover:bg-muted/60"
                      >
                        <Plus className="size-4" />
                        {t('addLink')}
                      </button>
                      <button
                        type="button"
                        onClick={() => addNode(null, { id: newId(), label: '', type: 'group' })}
                        className="pressable inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-13 font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                      >
                        <Plus className="size-4" />
                        {t('addDropdown')}
                      </button>
                    </>
                  ) : undefined
                }
              >
                {tree.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/80 bg-surface-sunken/40 px-6 py-12 text-center">
                    <span className="mx-auto flex size-12 items-center justify-center rounded-xl border border-border/70 bg-card text-muted-foreground shadow-xs">
                      <Menu className="size-5" />
                    </span>
                    <p className="mt-4 font-display text-lg font-medium">{t('emptyTitle')}</p>
                    <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
                      {t('empty')}
                    </p>
                    <div className="mx-auto mt-6 grid max-w-md gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => addNode(null, { id: newId(), label: '', type: 'url', href: '' })}
                        className="pressable rounded-xl border border-border/80 bg-card p-4 text-start shadow-xs transition-colors hover:border-border-strong hover:bg-muted/50"
                      >
                        <Link2 className="size-5 text-primary" />
                        <span className="mt-2 block text-sm font-medium">{t('addLink')}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{t('addLinkHint')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => addNode(null, { id: newId(), label: '', type: 'group' })}
                        className="pressable rounded-xl border border-border/80 bg-card p-4 text-start shadow-xs transition-colors hover:border-border-strong hover:bg-muted/50"
                      >
                        <FolderTree className="size-5 text-primary" />
                        <span className="mt-2 block text-sm font-medium">{t('addDropdown')}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{t('addDropdownHint')}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <SortableList
                    keys={topKeys}
                    onMove={(from, to) => moveWithin(null, from, to)}
                    className="space-y-2"
                    aria-label={t('builderTitle')}
                  >
                    <AnimatePresence initial={false}>
                      {tree.map((node) => (
                        <NavItem key={idOf(node)} node={node} parentId={null} />
                      ))}
                    </AnimatePresence>
                  </SortableList>
                )}
              </FormSection>
            </Reveal>

            <Reveal delay={0.05} className="min-w-0 xl:sticky xl:top-24 xl:order-2">
              <MenuPreview tree={tree} />
            </Reveal>
          </NavCtx.Provider>
        </div>
      </div>

      <SaveDock
        mode="edit"
        dirty={dirty}
        saving={saving}
        failed={failed}
        onSave={() => void save()}
        onDiscard={discard}
        saveLabel={t('save')}
        extra={
          attempted && errorCount > 0 ? (
            <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-2xs font-medium text-destructive">
              {t('errorCount', { count: errorCount })}
            </span>
          ) : null
        }
      />

      {confirmDelete && (
        <Dialog open onOpenChange={(open) => !open && setConfirmDelete(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {t('deleteTitle', { label: confirmDelete.node.label || t('noLabel') })}
              </DialogTitle>
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
                  removeNode(confirmDelete.parentId, idOf(confirmDelete.node));
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

function NavItem({ node, parentId }: { node: NavNode; parentId: string | null }) {
  const id = idOf(node);
  return (
    <SortableItem
      id={id}
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -10, transition: { duration: 0.16, ease: ease.exit } }}
    >
      <NavRow node={node} parentId={parentId} />
    </SortableItem>
  );
}

function NavRow({ node, parentId }: { node: NavNode; parentId: string | null }) {
  const t = useTranslations('admin.navigation');
  const nav = useNav();
  const { moveBy, index, count, dragging } = useSortableItem();
  const id = idOf(node);
  const [expanded, setExpanded] = useState(true);
  const isGroup = node.type === 'group';
  const hidden = node.visible === false;
  const broken = node.type === 'page' && (node.pageMissing || node.pageDisabled);
  const open = nav.openId === id;
  const err = nav.attempted ? nav.errors[id] : undefined;
  const children = node.children ?? [];
  const Icon = isGroup ? FolderTree : Link2;

  const iconBtn =
    'flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30';

  return (
    <div id={`nav-item-${id}`} className="scroll-mt-28">
      <div
        className={cn(
          'overflow-hidden rounded-xl border bg-card transition-[border-color,box-shadow,opacity] duration-200',
          open ? 'border-primary/40 shadow-sm' : 'border-border/70 shadow-xs hover:border-border',
          err && 'border-destructive/60',
          dragging && 'shadow-lg ring-1 ring-primary/30',
          hidden && !open && 'opacity-70',
        )}
      >
        <div className="flex items-center gap-1 px-1.5 py-1.5">
          <DragHandle label={t('dragToReorder')} />
          <button
            type="button"
            onClick={() => nav.setOpenId(open ? null : id)}
            aria-expanded={open}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1.5 py-1 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                open ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
              )}
            >
              <Icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-2">
                <span className={cn('truncate text-sm font-medium', !node.label && 'text-muted-foreground')}>
                  {node.label || t('noLabel')}
                </span>
                {node.labelAr && (
                  <span dir="rtl" lang="ar" className="shrink-0 text-xs text-muted-foreground">
                    {node.labelAr}
                  </span>
                )}
              </span>
              <span className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                {isGroup ? (
                  <span>{t('itemsInGroup', { count: children.length })}</span>
                ) : (
                  <span className="truncate font-mono" dir="ltr">
                    {node.type === 'page' ? (node.pageSlug ? `/${node.pageSlug}` : '—') : node.href || '—'}
                    {node.openInNewTab && <ExternalLink className="ms-1 inline size-3" aria-hidden />}
                  </span>
                )}
                {hidden && (
                  <span className="shrink-0 rounded-full bg-muted px-1.5 py-px text-2xs font-medium">
                    {t('hiddenBadge')}
                  </span>
                )}
                {broken && (
                  <span className="shrink-0 rounded-full bg-warning/10 px-1.5 py-px text-2xs font-medium text-warning">
                    {node.pageMissing ? t('pageMissing') : t('pageDisabled')}
                  </span>
                )}
                {err && (
                  <span className="shrink-0 rounded-full bg-destructive/10 px-1.5 py-px text-2xs font-medium text-destructive">
                    {t('needsAttention')}
                  </span>
                )}
              </span>
            </span>
          </button>

          <div className="flex shrink-0 items-center">
            {isGroup && (
              <button
                type="button"
                className={iconBtn}
                aria-label={expanded ? t('collapse') : t('expand')}
                aria-expanded={expanded}
                onClick={() => setExpanded((v) => !v)}
              >
                <ChevronDown className={cn('size-4 transition-transform duration-200', !expanded && '-rotate-90 rtl:rotate-90')} />
              </button>
            )}
            <button type="button" className={cn(iconBtn, 'hidden sm:flex')} onClick={() => moveBy(-1)} disabled={index === 0} aria-label={t('moveUp')}>
              <ArrowUp className="size-3.5" />
            </button>
            <button type="button" className={cn(iconBtn, 'hidden sm:flex')} onClick={() => moveBy(1)} disabled={index === count - 1} aria-label={t('moveDown')}>
              <ArrowDown className="size-3.5" />
            </button>
            <button
              type="button"
              className={iconBtn}
              onClick={() => nav.update(id, { visible: hidden })}
              aria-label={hidden ? t('show') : t('hide')}
              title={hidden ? t('show') : t('hide')}
            >
              {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
            <button
              type="button"
              className={iconBtn}
              onClick={() => nav.setOpenId(open ? null : id)}
              aria-label={t('editItem')}
              title={t('editItem')}
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              className={cn(iconBtn, 'hover:bg-destructive/10 hover:text-destructive')}
              onClick={() => nav.requestDelete(node, parentId)}
              aria-label={t('delete')}
              title={t('delete')}
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {open && (
            <m.div
              key="editor"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1, transition: { duration: 0.28, ease: ease.emerge } }}
              exit={{ height: 0, opacity: 0, transition: { duration: 0.18, ease: ease.exit } }}
              className="overflow-hidden"
            >
              <div className="border-t border-border/60 bg-surface-sunken/30 p-4">
                <ItemFields node={node} />
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </div>

      {isGroup && (
        <AnimatePresence initial={false}>
          {expanded && (
            <m.div
              key="children"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1, transition: { duration: 0.28, ease: ease.emerge } }}
              exit={{ height: 0, opacity: 0, transition: { duration: 0.18, ease: ease.exit } }}
              className="overflow-hidden"
            >
              <div className="ms-5 mt-2 space-y-2 border-s border-border/70 ps-4 pb-1">
                {children.length > 0 && (
                  <SortableList
                    keys={children.map(idOf)}
                    onMove={(from, to) => nav.moveWithin(id, from, to)}
                    className="space-y-2"
                    aria-label={node.label || t('groupBadge')}
                  >
                    <AnimatePresence initial={false}>
                      {children.map((child) => (
                        <NavItem key={idOf(child)} node={child} parentId={id} />
                      ))}
                    </AnimatePresence>
                  </SortableList>
                )}
                <button
                  type="button"
                  onClick={() => nav.addChild(id)}
                  className="pressable inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-border-strong px-3 text-13 font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                >
                  <Plus className="size-4" />
                  {children.length === 0 ? t('addLinkToEmptyGroup') : t('addChild')}
                </button>
              </div>
            </m.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- inline fields */

function ItemFields({ node }: { node: NavNode }) {
  const t = useTranslations('admin.navigation');
  const nav = useNav();
  const id = idOf(node);
  const isGroup = node.type === 'group';
  const err = nav.attempted ? nav.errors[id] : undefined;
  const set = (patch: Partial<NavNode>) => nav.update(id, patch);
  const focusRef = useRef<HTMLDivElement>(null);
  const kind = urlKind(node.href);

  // A freshly added row opens with its label focused: type and go.
  useEffect(() => {
    if (!node.label) focusRef.current?.querySelector('input')?.focus({ preventScroll: true });
    // Only on open.
  }, []);

  return (
    <div className="space-y-4">
      <div ref={focusRef} className="grid gap-4 sm:grid-cols-2">
        <Field label={t('labelEn')} required error={err?.label ? t(err.label) : undefined}>
          {(a) => (
            <TextInput
              {...a}
              value={node.label}
              onChange={(e) => set({ label: e.target.value })}
              placeholder={t('labelEnPlaceholder')}
            />
          )}
        </Field>
        <TextField
          label={t('labelAr')}
          hint={t('labelArHint')}
          dir="rtl"
          lang="ar"
          value={node.labelAr ?? ''}
          onChange={(e) => set({ labelAr: e.target.value })}
          placeholder={t('labelArPlaceholder')}
        />
      </div>

      {!isGroup && (
        <>
          <Field label={t('linkType')}>
            {() => (
              <div role="group" className="inline-flex items-center gap-0.5 rounded-lg bg-muted/70 p-0.5">
                {(['page', 'url'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={node.type === v}
                    onClick={() => set({ type: v })}
                    className={cn(
                      'relative flex h-8 items-center rounded-md px-3 text-13 font-medium transition-colors',
                      node.type === v ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {node.type === v && (
                      <m.span
                        layoutId={`nav-type-${id}`}
                        aria-hidden="true"
                        className="absolute inset-0 rounded-md bg-card shadow-xs"
                        transition={spring.smooth}
                      />
                    )}
                    <span className="relative">{v === 'page' ? t('typePage') : t('typeUrl')}</span>
                  </button>
                ))}
              </div>
            )}
          </Field>

          {node.type === 'page' ? (
            <SelectField
              label={t('page')}
              required
              hint={t('pageHint')}
              error={err?.target ? t(err.target) : undefined}
              value={node.pageSlug ?? ''}
              onChange={(e) => set({ pageSlug: e.target.value })}
            >
              <option value="">{t('choosePage')}</option>
              {nav.pages.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.title} — /{p.slug}
                </option>
              ))}
            </SelectField>
          ) : (
            <TextField
              label={t('url')}
              required
              dir="ltr"
              spellCheck={false}
              value={node.href ?? ''}
              onChange={(e) => set({ href: e.target.value })}
              placeholder={t('urlPlaceholder')}
              className="font-mono text-13"
              hint={
                kind === 'internal' ? t('urlInternal') : kind === 'external' ? t('urlExternal') : t('urlHint')
              }
              error={err?.target ? t(err.target) : undefined}
            />
          )}

          <SwitchField
            label={t('newTab')}
            checked={!!node.openInNewTab}
            onCheckedChange={(v) => set({ openInNewTab: v })}
          />
        </>
      )}

      <SwitchField
        label={t('visible')}
        checked={node.visible !== false}
        onCheckedChange={(v) => set({ visible: v })}
      />
    </div>
  );
}

/* ----------------------------------------------------------- live preview */

function MenuPreview({ tree }: { tree: NavNode[] }) {
  const t = useTranslations('admin.navigation');
  const [lang, setLang] = useState<'en' | 'ar'>('en');
  const [pick, setPick] = useState<string | null>(null);

  // Mirrors what the public site shows: hidden items, links to missing or
  // disabled pages, and dropdowns left with nothing in them are pruned.
  const shown = useMemo(() => {
    const live = (n: NavNode) =>
      n.visible !== false && !(n.type === 'page' && (n.pageMissing || n.pageDisabled));
    return tree
      .filter(live)
      .map((n) => ({ ...n, children: (n.children ?? []).filter(live) }))
      .filter((n) => n.type !== 'group' || n.children.length > 0);
  }, [tree]);

  const firstGroup = shown.find((n) => n.type === 'group');
  const openGroupId = pick === '' ? null : (pick ?? (firstGroup ? idOf(firstGroup) : null));
  const text = (n: NavNode) => (lang === 'ar' && n.labelAr ? n.labelAr : n.label) || t('noLabel');
  const rtl = lang === 'ar';

  return (
    <section
      aria-label={t('previewTitle')}
      className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs"
    >
      <header className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 className="font-display text-[1.0625rem] font-medium tracking-[-0.015em]">{t('previewTitle')}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{t('previewHint')}</p>
        </div>
        <div role="group" className="flex shrink-0 items-center gap-0.5 rounded-lg bg-muted/70 p-0.5">
          {(['en', 'ar'] as const).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={lang === l}
              onClick={() => setLang(l)}
              className={cn(
                'relative h-7 rounded-md px-2.5 text-xs font-medium transition-colors',
                lang === l ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {lang === l && (
                <m.span
                  layoutId="nav-preview-lang"
                  aria-hidden="true"
                  className="absolute inset-0 rounded-md bg-card shadow-xs"
                  transition={spring.smooth}
                />
              )}
              <span className="relative">{l === 'en' ? 'EN' : 'عربي'}</span>
            </button>
          ))}
        </div>
      </header>

      <div className="bg-surface-sunken/60 p-4 sm:p-5">
        <div
          dir={rtl ? 'rtl' : 'ltr'}
          lang={lang}
          className="rounded-xl border border-border/70 bg-background px-2 py-2 shadow-xs"
        >
          {shown.length === 0 ? (
            <p className="px-2 py-1.5 text-center text-xs text-muted-foreground">{t('previewEmpty')}</p>
          ) : (
            <ul className="flex flex-wrap items-center gap-0.5">
              <AnimatePresence initial={false}>
                {shown.map((n) => {
                  const id = idOf(n);
                  const isGroup = n.type === 'group';
                  const isOpen = isGroup && openGroupId === id;
                  return (
                    <m.li
                      key={id}
                      layout="position"
                      transition={spring.layout}
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.12 } }}
                      className="relative"
                    >
                      <button
                        type="button"
                        onClick={() => setPick(isGroup ? (isOpen ? '' : id) : '')}
                        aria-expanded={isGroup ? isOpen : undefined}
                        className={cn(
                          'flex h-8 items-center gap-1 rounded-lg px-2.5 text-13 font-medium transition-colors',
                          isOpen ? 'bg-muted text-foreground' : 'text-foreground/80 hover:bg-muted/70 hover:text-foreground',
                        )}
                      >
                        {text(n)}
                        {isGroup && (
                          <ChevronDown className={cn('size-3.5 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
                        )}
                      </button>
                    </m.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}

          <AnimatePresence initial={false} mode="wait">
            {openGroupId && (
              <m.ul
                key={openGroupId}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: ease.emerge } }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                className="mt-2 rounded-lg border border-border/70 bg-card p-1 shadow-sm"
              >
                {(shown.find((n) => idOf(n) === openGroupId)?.children ?? []).map((c) => (
                  <li key={idOf(c)}>
                    <span className="flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-13 text-foreground/90">
                      {text(c)}
                      {c.openInNewTab && <ExternalLink className="size-3 text-muted-foreground" aria-hidden />}
                    </span>
                  </li>
                ))}
              </m.ul>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
