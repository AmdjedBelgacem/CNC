'use client';

/**
 * Builder chrome.
 *
 * The previous toolbar put fifteen controls in one 48px row: exit, page picker,
 * undo, redo, add block, layers, inspector, saved sections, preview, viewport,
 * status, history, reset, save, publish. All the same weight, no grouping, and
 * the viewport switcher and publish status sat inside `hidden xl:flex` — so on
 * any laptop below 1280px the two controls you most need while designing simply
 * were not there.
 *
 * The replacement is two tiers with a real hierarchy:
 *
 *   identity + lifecycle   exit · page (with live status) ······ save · publish
 *   working tools          history │ insert │ view │ panels ······ page meta · more
 *
 * Tier one answers "what am I editing, and is it live". Tier two is the toolbox.
 * Nothing is hidden behind a breakpoint any more, and the rare destructive
 * actions moved into an overflow menu so the bar stays calm.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { PageManager } from '@/components/builder/page-manager';
import { PublishChecklist } from '@/components/builder/publish-checklist';
import { useBuilderPuck } from '@/lib/builder/use-builder-puck';
import {
  ArrowLeft,
  CircleAlert,
  Eye,
  History,
  Keyboard,
  Loader2,
  Monitor,
  MoreHorizontal,
  PanelLeft,
  PanelRight,
  Redo2,
  Rocket,
  RotateCcw,
  Save,
  Smartphone,
  Tablet,
  Undo2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMediaQuery, IS_DESKTOP_QUERY } from '@/lib/use-media-query';
import { Button } from '@/components/ui/button';
import { builderActions } from './builder-actions';
import { useBuilderUI } from './builder-ui-store';
import { AddBlockMenu } from './add-block-menu';
import { SavedSectionsActions } from './saved-sections-actions';
import { BlockProductivity } from './block-productivity';

export const VIEWPORTS = [
  { label: 'Desktop', labelKey: 'viewportDesktop', width: 1280, icon: Monitor },
  { label: 'Tablet', labelKey: 'viewportTablet', width: 768, icon: Tablet },
  { label: 'Mobile', labelKey: 'viewportMobile', width: 390, icon: Smartphone },
];

/* -------------------------------------------------------------------------- */
/* Primitives                                                                 */
/* -------------------------------------------------------------------------- */

function Divider() {
  return <span aria-hidden="true" className="mx-0.5 h-5 w-px shrink-0 bg-border" />;
}

/** A labelled group of tools. The label is the affordance, not decoration. */
function Group({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('flex shrink-0 items-center gap-0.5', className)}
    >
      {children}
    </div>
  );
}

function IconButton({
  title,
  disabled,
  active,
  onClick,
  children,
  className,
  haspopup,
  expanded,
}: {
  title: string;
  disabled?: boolean;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  /** Declares what this button opens, e.g. "menu" for the overflow menu. */
  haspopup?: 'menu' | 'dialog' | 'listbox' | 'true';
  expanded?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-haspopup={haspopup}
      aria-expanded={expanded}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-md transition',
        active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent hover:text-muted-foreground',
        className,
      )}
    >
      {children}
    </button>
  );
}

function MenuItem({
  icon: Icon,
  label,
  hint,
  danger,
  onSelect,
}: {
  icon: typeof History;
  label: string;
  hint?: string;
  danger?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className={cn(
        'flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-start transition',
        danger ? 'hover:bg-destructive/10' : 'hover:bg-muted',
      )}
    >
      <Icon
        className={cn('mt-0.5 size-4 shrink-0', danger ? 'text-destructive' : 'text-muted-foreground')}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        <span className={cn('block text-13 font-medium', danger ? 'text-destructive' : 'text-foreground')}>
          {label}
        </span>
        {hint && <span className="mt-0.5 block text-2xs text-muted-foreground">{hint}</span>}
      </span>
    </button>
  );
}

/** A menu that closes on outside click, Escape, or selection. */
function useDismissableMenu(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}

/* -------------------------------------------------------------------------- */
/* Page switcher                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The page being edited, with its publish state, and the list to switch to.
 *
 * The state chip is on the trigger rather than buried in a corner, because
 * "is this page live or is it still my draft" is the first question when you open
 * the builder — and the old bar hid that answer below 1280px.
 */
function ViewportSwitcher({
  currentWidth,
  setViewport,
}: {
  currentWidth: number | undefined;
  setViewport: (width: number) => void;
}) {
  const tb = useTranslations('builder');
  return (
    <div className="flex shrink-0 items-center rounded-md border border-border bg-background p-0.5">
      {VIEWPORTS.map((viewport) => {
        const active = currentWidth === viewport.width;
        const label = tb(`canvas.${viewport.labelKey}`, { default: viewport.label });
        return (
          <button
            key={viewport.label}
            type="button"
            onClick={() => setViewport(viewport.width)}
            aria-pressed={active}
            title={tb('canvas.viewportTitle', { label, width: viewport.width })}
            className={cn(
              'flex size-7 items-center justify-center rounded-[4px] transition',
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <viewport.icon className="size-3.5" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Overflow                                                                   */
/* -------------------------------------------------------------------------- */

/** The shortcut sheet, referenced from the overflow menu. */
export function ShortcutSheet({ onClose }: { onClose: () => void }) {
  const tb = useTranslations('builder');
  const rows: Array<[string, string]> = [
    ['⌘S', tb('shortcut.save')],
    ['⌘Z', tb('shortcut.undo')],
    ['⇧⌘Z', tb('shortcut.redo')],
    ['⌘I', tb('shortcut.preview')],
    ['⌘K', tb('shortcut.search', { default: tb('shortcut.layers') })],
  ];
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={tb('shortcut.close')}
        onClick={onClose}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={tb('more.shortcuts')}
        className="relative w-full max-w-sm overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-13 font-semibold text-foreground">{tb('more.shortcuts')}</h2>
          <IconButton title={tb('shortcut.close')} onClick={onClose}>
            <span aria-hidden="true">✕</span>
          </IconButton>
        </header>
        <dl className="divide-y divide-border">
          {rows.map(([keys, label]) => (
            <div key={keys} className="flex items-center justify-between gap-4 px-4 py-2.5">
              <dt className="text-2xs text-muted-foreground">{label}</dt>
              <dd>
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-2xs font-medium text-foreground">
                  {keys}
                </kbd>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Header                                                                     */
/* -------------------------------------------------------------------------- */

export function BuilderHeader() {
  const tb = useTranslations('builder');
  const dispatch = useBuilderPuck((state) => state.dispatch);
  const previewMode = useBuilderPuck((state) => state.appState.ui.previewMode);
  const currentWidth = useBuilderPuck((state) => state.appState.ui.viewports?.current?.width);
  const history = useBuilderPuck((state) => state.history);
  const isDesktop = useMediaQuery(IS_DESKTOP_QUERY);
  const dirty = useBuilderUI((state) => state.dirty);
  const saving = useBuilderUI((state) => state.saving);
  const structureOpen = useBuilderUI((state) => state.structureOpen);
  const toggleStructure = useBuilderUI((state) => state.toggleStructure);
  const inspectorOpen = useBuilderUI((state) => state.inspectorOpen);
  const setInspectorOpen = useBuilderUI((state) => state.setInspectorOpen);
  const setPublishOpen = useBuilderUI((state) => state.setPublishOpen);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const pageStatus = useBuilderUI((state) => state.status);

  const setViewport = (width: number) =>
    dispatch({
      type: 'setUi',
      ui: (ui: any) => ({ viewports: { ...ui.viewports, current: { width, height: 'auto' } } }),
    } as never);
  const togglePreview = () =>
    dispatch({
      type: 'setUi',
      ui: (ui: { previewMode: string }) => ({
        previewMode: ui.previewMode === 'edit' ? 'interactive' : 'edit',
      }),
    } as never);

  const saveLabel = tb('shortcut.save');

  return (
    <header className="shrink-0 border-b border-border bg-card">
      {/* Tier one — what am I editing, and is it live. */}
      <div className="flex h-12 items-center gap-1.5 px-2 sm:px-3">
        <Link
          href="/"
          title={tb('editor.exitBuilderTitle', { default: tb('more.exit') })}
          aria-label={tb('more.exit')}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="flip-rtl size-4" aria-hidden="true" />
        </Link>

        <div className="min-w-0 flex-1 sm:flex-none">
          <PageManager />
        </div>

        <div className="ms-auto flex shrink-0 items-center gap-1.5">
          {isDesktop && dirty && (
            <span className="hidden items-center gap-1.5 text-2xs text-warning lg:flex">
              <CircleAlert className="size-3" aria-hidden="true" />
              {tb('editor.unsavedChanges', { default: tb('page.editing') })}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-8 shrink-0 gap-1.5 px-2.5 sm:px-3"
            disabled={saving || !dirty}
            onClick={() => void builderActions.current?.saveDraft()}
            title={`${saveLabel} (⌘S)`}
          >
            {saving ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="size-3.5" aria-hidden="true" />
            )}
            <span className="hidden min-[420px]:inline">
              {tb('editor.save', { default: saveLabel })}
            </span>
          </Button>
          <Button
            size="sm"
            className="h-8 shrink-0 gap-1.5 px-2.5 sm:px-3"
            disabled={saving}
            onClick={() => setPublishOpen(true)}
          >
            <Rocket className="size-3.5" aria-hidden="true" />
            <span className="hidden min-[420px]:inline">
              {tb('editor.publish', { default: tb('page.statusPublished') })}
            </span>
          </Button>
        </div>
      </div>

      {/* Tier two — the toolbox. Always mounted, never behind a breakpoint. */}
      <div className="scrollbar-thin flex h-11 items-center gap-1.5 overflow-x-auto border-t border-border px-2 sm:px-3">
        <Group label={tb('group.tools')}>
          <IconButton
            title={`${tb('shortcut.undo')} (⌘Z)`}
            disabled={!history.hasPast}
            onClick={() => history.back()}
          >
            <Undo2 className="size-4" aria-hidden="true" />
          </IconButton>
          <IconButton
            title={`${tb('shortcut.redo')} (⇧⌘Z)`}
            disabled={!history.hasFuture}
            onClick={() => history.forward()}
          >
            <Redo2 className="size-4" aria-hidden="true" />
          </IconButton>
        </Group>

        <Divider />

        <Group label={tb('group.insert')}>
          <AddBlockMenu />
          <SavedSectionsActions />
        </Group>

        <Divider />

        {/* `relative` anchors the find-results popover. */}
        <div className="relative flex min-w-0 items-center">
          <BlockProductivity />
        </div>

        <Divider />

        <Group label={tb('group.view')}>
          <IconButton
            title={`${tb('shortcut.preview')} (⌘I)`}
            active={previewMode === 'interactive'}
            onClick={togglePreview}
          >
            <Eye className="size-4" aria-hidden="true" />
          </IconButton>
          {/* Always visible. The old bar hid this below xl, which is every
              laptop short of 1280px — the width you are designing at. */}
          <ViewportSwitcher currentWidth={currentWidth} setViewport={setViewport} />
        </Group>

        <Divider />

        <Group label={tb('group.panels')}>
          <IconButton
            title={
              structureOpen
                ? tb('editor.hideLayers', { default: tb('shortcut.layers') })
                : tb('editor.showLayers', { default: tb('shortcut.layers') })
            }
            active={structureOpen}
            onClick={toggleStructure}
          >
            <PanelLeft className="size-4" aria-hidden="true" />
          </IconButton>
          <IconButton
            title={
              inspectorOpen
                ? tb('editor.hideInspector', { default: tb('shortcut.inspector') })
                : tb('editor.showInspector', { default: tb('shortcut.inspector') })
            }
            active={inspectorOpen}
            onClick={() => setInspectorOpen(!inspectorOpen)}
          >
            <PanelRight className="size-4" aria-hidden="true" />
          </IconButton>
        </Group>

        <div className="ms-auto flex shrink-0 items-center gap-2.5 ps-2">
          {/* The page's version and publish state already sit on the switcher in
              tier one, so this row carries only what is not shown elsewhere. */}
          <PublishChecklist page={pageStatus} />
          <OverflowMenu onOpenShortcuts={() => setShortcutsOpen(true)} />
        </div>
      </div>

      {shortcutsOpen && <ShortcutSheet onClose={() => setShortcutsOpen(false)} />}
    </header>
  );
}

function OverflowMenu({ onOpenShortcuts }: { onOpenShortcuts: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismissableMenu(open, () => setOpen(false));
  const tb = useTranslations('builder');
  const setResetOpen = useBuilderUI((state) => state.setResetOpen);
  return (
    <div ref={ref} className="relative shrink-0">
      <IconButton
        title={tb('more.menu')}
        active={open}
        haspopup="menu"
        expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal className="size-4" aria-hidden="true" />
      </IconButton>
      {open && (
        <div
          role="menu"
          className="absolute end-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-xl border border-border bg-popover p-1.5 shadow-lg"
        >
          <MenuItem
            icon={History}
            label={tb('more.history')}
            onSelect={() => {
              setOpen(false);
              void builderActions.current?.openVersions();
            }}
          />
          <MenuItem
            icon={RotateCcw}
            label={tb('more.reset')}
            hint={tb('more.resetHint')}
            danger
            onSelect={() => {
              setOpen(false);
              setResetOpen(true);
            }}
          />
          <div className="my-1 h-px bg-border" />
          <MenuItem
            icon={Keyboard}
            label={tb('more.shortcuts')}
            onSelect={() => {
              setOpen(false);
              onOpenShortcuts();
            }}
          />
          <div className="my-1 h-px bg-border" />
          <MenuItem
            icon={ArrowLeft}
            label={tb('more.exit')}
            onSelect={() => {
              window.location.href = '/';
            }}
          />
        </div>
      )}
    </div>
  );
}
