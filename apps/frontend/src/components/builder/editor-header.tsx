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

import { useCallback, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { PageManager } from '@/components/builder/page-manager';
import { AnchorPanel } from '@/components/builder/anchor-panel';
import { PublishChecklist } from '@/components/builder/publish-checklist';
import { useBuilderPuck } from '@/lib/builder/use-builder-puck';
import { useOpenPage } from '@/components/builder/use-open-page';
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
  Sparkles,
  Tablet,
  Undo2,
} from 'lucide-react';
import { m } from 'framer-motion';
import { cn } from '@/lib/utils';
import { spring } from '@/lib/motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  return <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-border/80" />;
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
  triggerRef,
}: {
  title: string;
  disabled?: boolean;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  /** Declares what this button opens, e.g. "menu" for the overflow menu. */
  haspopup?: 'menu' | 'dialog' | 'listbox' | 'true';
  /** Lets a portalled panel anchor itself to this button. */
  triggerRef?: React.Ref<HTMLButtonElement>;
  expanded?: boolean;
}) {
  return (
    <button
      ref={triggerRef}
      type="button"
      title={title}
      aria-label={title}
      aria-haspopup={haspopup}
      aria-expanded={expanded}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-lg transition-[background-color,color,transform] duration-150 active:scale-[0.94]',
        active
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground',
        disabled &&
          'cursor-not-allowed opacity-40 hover:bg-transparent hover:text-muted-foreground',
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
        'flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-start transition-colors',
        danger ? 'hover:bg-destructive/10' : 'hover:bg-muted/70',
      )}
    >
      <Icon
        className={cn(
          'mt-0.5 size-4 shrink-0',
          danger ? 'text-destructive' : 'text-muted-foreground',
        )}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block text-13 font-medium',
            danger ? 'text-destructive' : 'text-foreground',
          )}
        >
          {label}
        </span>
        {hint && <span className="mt-0.5 block text-2xs text-muted-foreground">{hint}</span>}
      </span>
    </button>
  );
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
    <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-border/70 bg-surface-sunken/70 p-0.5">
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
              'relative flex size-7 items-center justify-center rounded-md transition-colors active:scale-[0.94]',
              active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {active && (
              <m.span
                layoutId="builder-viewport-pill"
                aria-hidden="true"
                className="absolute inset-0 rounded-md bg-card shadow-xs ring-1 ring-border/70"
                transition={spring.snappy}
              />
            )}
            <viewport.icon className="relative size-3.5" aria-hidden="true" />
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
export function ShortcutSheet({ onClose, open = true }: { onClose: () => void; open?: boolean }) {
  const tb = useTranslations('builder');
  const rows: Array<[string, string]> = [
    ['⌘S', tb('shortcut.save')],
    ['⌘Z', tb('shortcut.undo')],
    ['⇧⌘Z', tb('shortcut.redo')],
    ['⌘I', tb('shortcut.preview')],
    ['⌘K', tb('shortcut.search', { default: tb('shortcut.layers') })],
  ];
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent size="sm" aria-label={tb('more.shortcuts')}>
        <DialogHeader>
          <DialogTitle>{tb('more.shortcuts')}</DialogTitle>
        </DialogHeader>
        <dl className="divide-y divide-border/60 border-t border-border/70 pb-2">
          {rows.map(([keys, label], index) => (
            <m.div
              key={keys}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0, transition: { ...spring.smooth, delay: 0.06 + index * 0.035 } }}
              className="flex items-center justify-between gap-4 px-5 py-2.5 sm:px-7"
            >
              <dt className="text-13 text-muted-foreground">{label}</dt>
              <dd>
                <kbd className="rounded-md border border-border/80 bg-surface-sunken px-1.5 py-0.5 font-mono text-2xs font-medium text-foreground shadow-xs">
                  {keys}
                </kbd>
              </dd>
            </m.div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
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
  const aiOpen = useBuilderUI((state) => state.aiOpen);
  const setAiOpen = useBuilderUI((state) => state.setAiOpen);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const pageStatus = useBuilderUI((state) => state.status);
  /*
   * The slug comes from the URL, not from the builder store.
   *
   * `StatusInfo` has no slug field, and deliberately: a module-level copy of the open page is
   * exactly what used to fall out of step with the route. Passing it separately keeps the URL the
   * single source of truth while giving the publish checks the fact they need — without it,
   * `collectPublishIssues` read the slug as undefined and raised "no URL slug" on every page.
   */
  const { slug: openSlug } = useOpenPage();

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
    <header className="shrink-0 bg-surface-sunken px-2 pt-1.5">
      {/* Tier one — what am I editing, and is it live. */}
      <div className="flex h-12 items-center gap-1.5 px-1 sm:px-1.5">
        <Link
          href="/"
          title={tb('editor.exitBuilderTitle', { default: tb('more.exit') })}
          aria-label={tb('more.exit')}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-card hover:text-foreground hover:shadow-xs active:scale-[0.94]"
        >
          <ArrowLeft className="flip-rtl size-4" aria-hidden="true" />
        </Link>

        <div className="min-w-0 flex-1 sm:flex-none">
          <PageManager />
        </div>

        <div className="ms-auto flex shrink-0 items-center gap-1.5">
          {isDesktop && dirty && (
            <m.span
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0, transition: spring.smooth }}
              className="hidden items-center gap-1.5 rounded-full bg-warning/10 px-2.5 py-1 text-2xs font-medium text-warning lg:flex"
            >
              <CircleAlert className="size-3" aria-hidden="true" />
              {tb('editor.unsavedChanges', { default: tb('page.editing') })}
            </m.span>
          )}
          <m.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => setAiOpen(!aiOpen)}
            aria-pressed={aiOpen}
            title={`${tb('ai.open')} (⌘J)`}
            className={cn(
              'flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold shadow-xs transition sm:px-3',
              aiOpen
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-primary/30 bg-gradient-to-r from-primary/10 to-primary/5 text-primary hover:border-primary/50 hover:from-primary/15',
            )}
          >
            <Sparkles className="size-3.5" aria-hidden="true" />
            <span className="hidden min-[520px]:inline">{tb('ai.button')}</span>
          </m.button>
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
      <div className="scrollbar-thin flex h-11 items-center gap-1.5 overflow-x-auto rounded-xl border border-border/70 bg-card px-1.5 shadow-xs sm:px-2">
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
          <PublishChecklist page={pageStatus ? { ...pageStatus, slug: openSlug } : null} />
          <OverflowMenu onOpenShortcuts={() => setShortcutsOpen(true)} />
        </div>
      </div>

      <ShortcutSheet open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </header>
  );
}

function OverflowMenu({ onOpenShortcuts }: { onOpenShortcuts: () => void }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tb = useTranslations('builder');
  const setResetOpen = useBuilderUI((state) => state.setResetOpen);
  const close = useCallback(() => setOpen(false), []);
  return (
    <div className="shrink-0">
      <IconButton
        triggerRef={triggerRef}
        title={tb('more.menu')}
        active={open}
        haspopup="menu"
        expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal className="size-4" aria-hidden="true" />
      </IconButton>
      {/* Portalled for the same reason as the block menu: the toolbox bar is `overflow-x-auto`,
          which clips an absolutely-positioned child into the 44px bar and paints it under the
          sidebar. This menu was missed on the first pass and still slid out of view. */}
      <AnchorPanel anchorRef={triggerRef} open={open} onDismiss={close} minWidth={256}>
        <div role="menu" className="max-h-[60vh] overflow-y-auto p-1.5">
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
          <div className="mx-1 my-1 h-px bg-border/70" />
          <MenuItem
            icon={Keyboard}
            label={tb('more.shortcuts')}
            onSelect={() => {
              setOpen(false);
              onOpenShortcuts();
            }}
          />
          <div className="mx-1 my-1 h-px bg-border/70" />
          <MenuItem
            icon={ArrowLeft}
            label={tb('more.exit')}
            onSelect={() => {
              window.location.href = '/';
            }}
          />
        </div>
      </AnchorPanel>
    </div>
  );
}
