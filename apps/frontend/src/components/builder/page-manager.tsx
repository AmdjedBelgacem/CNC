'use client';

/**
 * Page manager: the page list, plus create / duplicate / disable / delete.
 *
 * Replaces a switcher that iterated `BUILDER_PAGE_DEFS` — a compile-time list
 * of ten seeded slugs, so a page created through the API was invisible in the
 * editor and could only be reached by typing its URL.
 *
 * The list is fetched, searched client-side (a tenant has tens of pages, not
 * thousands, and this avoids a request per keystroke), and every destructive
 * action is confirmed. Disabling is offered separately from deleting because
 * they are genuinely different: one hides a page, the other destroys its
 * version history.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  Check,
  Copy,
  Eye,
  EyeOff,
  FilePlus2,
  FileText,
  Loader2,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import type { PageRecord } from '@titan/shared';
import { normalizeSlug, validateSlug } from '@titan/shared';
import { api } from '@/lib/api-client';
import { useBuilderUI } from '@/components/builder/builder-ui-store';
import { useOpenPage } from '@/components/builder/use-open-page';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

type Template = 'blank' | 'landing' | 'content';

export interface PageManagerProps {
  /** Called after a page is chosen, so a host menu can close itself. */
  onNavigate?: () => void;
}

export function PageManager({ onNavigate }: PageManagerProps = {}) {
  const tb = useTranslations('builder');
  // The single owner of "which page is open". Writing the store directly is what
  // let the header and the editor drift apart.
  const { slug, openPage } = useOpenPage();
  const setStatus = useBuilderUI((s) => s.setStatus);
  const status = useBuilderUI((s) => s.status);

  const [open, setOpen] = useState(false);
  const [pages, setPages] = useState<PageRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [duplicating, setDuplicating] = useState<PageRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PageRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await api.get<PageRecord[]>('/builder/pages');
      setPages(rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : tb('pages.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [tb]);

  // Fetch once per open, and only if the list is empty. A `pages.length === 0`
  // guard alone is not enough: a failed or empty response leaves the length at 0
  // and the effect is free to re-request on every re-render, which reads as a
  // frozen tab. The ref makes "already asked" explicit.
  const requested = useRef(false);
  useEffect(() => {
    if (!open || requested.current || pages.length > 0) return;
    requested.current = true;
    void load();
  }, [open, pages.length, load]);

  const current = pages.find((p) => p.slug === slug);
  const live = status?.status === 'published';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pages;
    return pages.filter(
      (p) => p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q),
    );
  }, [pages, query]);

  const go = async (next: string) => {
    setOpen(false);
    onNavigate?.();
    if (next === slug) return;
    // `openPage` updates the store (which the editor's load effect watches) and the
    // URL together. The editor must not call `load` here as well: it would fetch
    // and apply every page twice.
    openPage(next);
    const target = pages.find((p) => p.slug === next);
    if (target) {
      setStatus({
        status: target.status,
        version: target.version,
        title: target.title,
        isSystem: target.isSystem,
        showInNav: target.showInNav,
      });
    }
  };

  const refresh = async () => {
    await load();
  };

  const toggleStatus = async (page: PageRecord) => {
    setBusy(page.slug);
    setError(null);
    const next = page.status === 'disabled' ? 'published' : 'disabled';
    try {
      const updated = await api.patch<PageRecord>(`/builder/pages/${page.slug}`, { status: next });
      setPages((rows) => rows.map((r) => (r.slug === page.slug ? updated : r)));
      if (page.slug === slug) {
        setStatus({
          status: updated.status,
          version: updated.version,
          title: updated.title,
          isSystem: updated.isSystem,
        });
        await refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : tb('pages.updateFailed'));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (page: PageRecord) => {
    setBusy(page.slug);
    setError(null);
    try {
      await api.delete(`/builder/pages/${page.slug}`);
      const remaining = pages.filter((p) => p.slug !== page.slug);
      setPages(remaining);
      setConfirmDelete(null);
      // Deleting the page you are standing on would leave the editor on a
      // 404, so move to the first page that is left.
      if (page.slug === slug && remaining[0]) await go(remaining[0].slug);
    } catch (e) {
      setError(e instanceof Error ? e.message : tb('pages.deleteFailed'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="relative min-w-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? 'builder-page-manager' : undefined}
          className="flex h-8 max-w-full items-center gap-2 rounded-md px-2 text-start transition hover:bg-muted"
          title={tb('page.switch')}
        >
          <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block truncate text-13 font-semibold leading-tight text-foreground">
              {current?.title ?? status?.title ?? slug}
            </span>
            <span className="flex items-center gap-1 text-2xs leading-tight">
              <span className={cn('inline-flex items-center gap-1', live ? 'text-success' : 'text-warning')}>
                <span
                  className={cn(
                    'relative inline-flex size-1.5',
                    status?.status === 'disabled' && 'opacity-40',
                  )}
                  aria-hidden="true"
                >
                  <span
                    className={cn(
                      'absolute inline-flex size-full animate-ping rounded-full opacity-60',
                      live ? 'bg-success' : 'bg-warning',
                    )}
                  />
                  <span
                    className={cn(
                      'relative inline-flex size-1.5 rounded-full',
                      live ? 'bg-success' : 'bg-warning',
                    )}
                  />
                </span>
                {status?.status === 'disabled'
                  ? tb('page.statusDisabled')
                  : live
                    ? tb('page.statusPublished')
                    : tb('page.statusDraft')}
              </span>
              {status && (
                <span className="font-mono text-muted-foreground/70">
                  {tb('page.versionLabel', { version: status.version })}
                </span>
              )}
            </span>
          </span>
        </button>

        {open && (
          <>
            <button
              type="button"
              aria-label={tb('pages.close')}
              className="fixed inset-0 z-40 cursor-default"
              onClick={() => setOpen(false)}
            />
            <div
              id="builder-page-manager"
              role="dialog"
              aria-label={tb('pages.dialogLabel')}
              className="absolute start-0 top-full z-50 mt-1 w-[min(24rem,90vw)] rounded-md border border-border bg-popover p-1 shadow-lg"
            >
              <div className="flex items-center gap-1 border-b border-border p-1">
                <Search className="ms-1 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={tb('pages.search')}
                  className="h-7 border-0 px-1 text-13 shadow-none focus-visible:ring-0"
                  aria-label={tb('pages.search')}
                />
                {loading && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
              </div>

              {error && (
                <p role="alert" className="m-1 rounded-sm bg-destructive/10 px-2 py-1 text-2xs text-destructive">
                  {error}
                </p>
              )}

              <div className="max-h-72 overflow-y-auto py-1">
                {filtered.length === 0 && !loading ? (
                  <p className="px-3 py-6 text-center text-2xs text-muted-foreground">
                    {pages.length === 0 ? tb('pages.empty') : tb('pages.noMatches')}
                  </p>
                ) : (
                  filtered.map((page) => {
                    const active = page.slug === slug;
                    const disabled = page.status === 'disabled';
                    return (
                      <div
                        key={page.id}
                        className={cn(
                          'group flex items-center gap-1 rounded-sm px-1 hover:bg-muted',
                          active && 'bg-muted',
                          disabled && 'opacity-60',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => void go(page.slug)}
                          aria-current={active ? 'page' : undefined}
                          className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-start"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate text-13 font-medium text-foreground">
                                {page.title}
                              </span>
                              {active && <Check className="size-3 shrink-0 text-primary" aria-hidden />}
                            </span>
                            <span className="block truncate font-mono text-2xs text-muted-foreground">
                              /{page.slug}
                            </span>
                          </span>
                          <span
                            className={cn(
                              'shrink-0 rounded-sm px-1.5 py-0.5 text-2xs font-medium',
                              page.status === 'published'
                                ? 'bg-success/15 text-success'
                                : page.status === 'disabled'
                                  ? 'bg-muted text-muted-foreground'
                                  : 'bg-warning/15 text-warning',
                            )}
                          >
                            {page.status === 'published'
                              ? tb('page.statusPublished')
                              : page.status === 'disabled'
                                ? tb('page.statusDisabled')
                                : tb('page.statusDraft')}
                          </span>
                          {page.isSystem && (
                            <span
                              className="shrink-0 rounded-sm bg-secondary px-1.5 py-0.5 text-2xs text-secondary-foreground"
                              title={tb('page.systemHint')}
                            >
                              {tb('page.system')}
                            </span>
                          )}
                        </button>

                        <div className="flex shrink-0 items-center opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                          <IconAction
                            label={page.status === 'disabled' ? tb('pages.enable') : tb('pages.disable')}
                            onClick={() => void toggleStatus(page)}
                            disabled={busy === page.slug}
                          >
                            {page.status === 'disabled' ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                          </IconAction>
                          <IconAction label={tb('pages.duplicate')} onClick={() => setDuplicating(page)}>
                            <Copy className="size-3.5" />
                          </IconAction>
                          <IconAction
                            label={tb('pages.delete')}
                            onClick={() => setConfirmDelete(page)}
                            disabled={page.isSystem}
                            danger
                            title={page.isSystem ? tb('page.systemHint') : undefined}
                          >
                            <Trash2 className="size-3.5" />
                          </IconAction>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="border-t border-border p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-full justify-start text-13"
                  onClick={() => setCreating(true)}
                >
                  <Plus className="size-3.5" />
                  {tb('pages.create')}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {creating && (
        <CreatePageDialog
          onClose={() => setCreating(false)}
          onCreated={async (page) => {
            setCreating(false);
            await refresh();
            await go(page.slug);
          }}
        />
      )}

      {duplicating && (
        <DuplicateDialog
          page={duplicating}
          onClose={() => setDuplicating(null)}
          onDone={async (newSlug) => {
            setDuplicating(null);
            await refresh();
            await go(newSlug);
          }}
        />
      )}

      {confirmDelete && (
        <Dialog open onOpenChange={(openState) => !openState && setConfirmDelete(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{tb('pages.deleteTitle', { title: confirmDelete.title })}</DialogTitle>
              <DialogDescription>
                {confirmDelete.version > 0
                  ? tb('pages.deleteBodyWithHistory', { version: confirmDelete.version })
                  : tb('pages.deleteBody')}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDelete(null)}>
                {tb('pages.cancel')}
              </Button>
              <Button
                variant="destructive"
                disabled={busy === confirmDelete.slug}
                onClick={() => void remove(confirmDelete)}
              >
                {busy === confirmDelete.slug ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                {tb('pages.delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function IconAction({
  label,
  onClick,
  disabled,
  danger,
  title,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-sm p-1.5 text-muted-foreground transition hover:bg-background hover:text-foreground disabled:pointer-events-none disabled:opacity-30',
        danger && 'hover:text-destructive',
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------- create */

function CreatePageDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (page: PageRecord) => void | Promise<void>;
}) {
  const tb = useTranslations('builder');
  const [title, setTitle] = useState('');
  const [rawSlug, setRawSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [template, setTemplate] = useState<Template>('landing');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derive the slug from the title until the author edits it themselves, so the
  // common case needs one field rather than two.
  const slug = slugTouched ? normalizeSlug(rawSlug) : normalizeSlug(title);
  const check = validateSlug(slug);
  const canSubmit = title.trim().length > 0 && check.ok;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const page = await api.post<PageRecord>('/builder/pages', {
        slug,
        title: title.trim(),
        template,
      });
      await onCreated(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : tb('pages.createFailed'));
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tb('pages.createTitle')}</DialogTitle>
          <DialogDescription>{tb('pages.createDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pm-title">{tb('pages.fieldTitle')}</Label>
            <Input
              id="pm-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={tb('pages.titlePlaceholder')}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pm-slug">{tb('pages.fieldSlug')}</Label>
            <div className="flex items-center gap-1">
              <span className="font-mono text-13 text-muted-foreground">/</span>
              <Input
                id="pm-slug"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setRawSlug(e.target.value);
                }}
                className="font-mono text-13"
                dir="ltr"
              />
            </div>
            {check.ok ? (
              <p className="text-2xs text-muted-foreground">
                {tb('pages.urlPreview', { url: `/${slug}` })}
              </p>
            ) : (
              <p
                role="alert"
                className="flex items-start gap-1 text-2xs text-destructive"
              >
                <AlertTriangle className="mt-px size-3 shrink-0" aria-hidden />
                {check.reason === 'reserved'
                  ? tb('pages.slugReserved', { slug: check.slug })
                  : check.reason === 'empty'
                    ? tb('pages.slugEmpty')
                    : tb('pages.slugFormat')}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>{tb('pages.fieldTemplate')}</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['blank', 'landing', 'content'] as Template[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTemplate(value)}
                  aria-pressed={template === value}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-md border px-2 py-2.5 text-2xs transition',
                    template === value
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-border text-muted-foreground hover:bg-muted',
                  )}
                >
                  {value === 'blank' ? (
                    <FileText className="size-4" aria-hidden />
                  ) : value === 'landing' ? (
                    <FilePlus2 className="size-4" aria-hidden />
                  ) : (
                    <FileText className="size-4" aria-hidden />
                  )}
                  <span className="font-medium">{tb(`pages.template.${value}`)}</span>
                  <span className="text-center leading-tight opacity-70">
                    {tb(`pages.templateHint.${value}`)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-sm bg-destructive/10 px-2 py-1 text-2xs text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {tb('pages.cancel')}
          </Button>
          <Button disabled={!canSubmit || busy} onClick={() => void submit()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {tb('pages.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------------------------------- duplicate */

function DuplicateDialog({
  page,
  onClose,
  onDone,
}: {
  page: PageRecord;
  onClose: () => void;
  onDone: (newSlug: string) => void | Promise<void>;
}) {
  const tb = useTranslations('builder');
  const [title, setTitle] = useState(`${page.title} ${tb('pages.copySuffix')}`);
  const [rawSlug, setRawSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slug = slugTouched ? normalizeSlug(rawSlug) : normalizeSlug(title);
  const check = validateSlug(slug);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await api.post<PageRecord>(`/builder/pages/${page.slug}/duplicate`, {
        slug,
        title: title.trim(),
      });
      await onDone(created.slug);
    } catch (e) {
      setError(e instanceof Error ? e.message : tb('pages.duplicateFailed'));
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tb('pages.duplicateTitle')}</DialogTitle>
          <DialogDescription>{tb('pages.duplicateDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dup-title">{tb('pages.fieldTitle')}</Label>
            <Input id="dup-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dup-slug">{tb('pages.fieldSlug')}</Label>
            <div className="flex items-center gap-1">
              <span className="font-mono text-13 text-muted-foreground">/</span>
              <Input
                id="dup-slug"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setRawSlug(e.target.value);
                }}
                className="font-mono text-13"
                dir="ltr"
              />
            </div>
            {!check.ok && (
              <p role="alert" className="text-2xs text-destructive">
                {check.reason === 'reserved'
                  ? tb('pages.slugReserved', { slug: check.slug })
                  : tb('pages.slugFormat')}
              </p>
            )}
          </div>
          <p className="rounded-sm bg-secondary/50 px-2 py-1.5 text-2xs text-muted-foreground">
            {tb('pages.duplicateDraftNote')}
          </p>
          {error && (
            <p role="alert" className="rounded-sm bg-destructive/10 px-2 py-1 text-2xs text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {tb('pages.cancel')}
          </Button>
          <Button disabled={!check.ok || !title.trim() || busy} onClick={() => void submit()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />}
            {tb('pages.duplicate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
