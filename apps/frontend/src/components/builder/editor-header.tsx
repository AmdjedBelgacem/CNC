'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BUILDER_PAGE_DEFS } from '@titan/shared';
import { useBuilderPuck } from '@/lib/builder/use-builder-puck';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Eye,
  FileText,
  History,
  Loader2,
  Menu,
  Monitor,
  PanelLeft,
  PanelRight,
  Redo2,
  Rocket,
  RotateCcw,
  Save,
  Smartphone,
  Tablet,
  Undo2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMediaQuery, IS_DESKTOP_QUERY } from '@/lib/use-media-query';
import { Button } from '@/components/ui/button';
import { builderActions } from './builder-actions';
import { useBuilderUI } from './builder-ui-store';
import { AddBlockMenu } from './add-block-menu';
import { SavedSectionsActions } from './saved-sections-actions';
export const VIEWPORTS = [
  { label: 'Desktop', width: 1280, icon: Monitor },
  { label: 'Tablet', width: 768, icon: Tablet },
  { label: 'Mobile', width: 390, icon: Smartphone },
];
function ToolbarDivider() {
  return <div className="mx-1 h-5 w-px shrink-0 bg-border" />;
}
function ToolbarIconButton({
  title,
  disabled,
  active,
  onClick,
  children,
}: {
  title: string;
  disabled?: boolean;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition',
        active ? 'bg-primary/10 text-primary' : 'hover:bg-muted hover:text-foreground',
        disabled &&
          'cursor-not-allowed opacity-40 hover:bg-transparent hover:text-muted-foreground',
      )}
    >
      {' '}
      {children}{' '}
    </button>
  );
} /**
 * Page switcher — replaces the old tab strip. One compact menu for all * builder pages, with the active page shown on the trigger. On mobile it * opens as a full-width sheet under the toolbar. */
function PageSwitcher() {
  const slug = useBuilderUI((s) => s.slug);
  const setSlug = useBuilderUI((s) => s.setSlug);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);
  const current = BUILDER_PAGE_DEFS.find((d) => d.slug === slug) ?? BUILDER_PAGE_DEFS[0]!;
  const go = (s: string) => {
    setOpen(false);
    builderActions.current?.load(s);
    setSlug(s);
  };
  return (
    <div ref={rootRef} className="relative min-w-0">
      {' '}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 max-w-full items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-[13px] font-medium text-foreground transition hover:bg-muted"
        title="Switch page"
      >
        {' '}
        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />{' '}
        <span className="truncate">{current.title}</span>{' '}
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180',
          )}
        />{' '}
      </button>{' '}
      {open && (
        <div
          className={cn(
            'fixed left-3 right-3 top-[48px] z-50 w-auto overflow-hidden rounded-xl border border-border bg-popover shadow-sm ',
            'lg:absolute lg:left-0 lg:right-auto lg:top-full lg:mt-1.5 lg:w-72',
          )}
        >
          {' '}
          <p className="border-b border-border px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground/70">
            {' '}
            Pages{' '}
          </p>{' '}
          <div className="scrollbar-thin max-h-[55vh] overflow-y-auto p-1.5">
            {' '}
            {BUILDER_PAGE_DEFS.map((def) => {
              const active = def.slug === slug;
              return (
                <button
                  key={def.slug}
                  type="button"
                  onClick={() => go(def.slug)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition',
                    active ? 'bg-primary/10' : 'hover:bg-muted',
                  )}
                >
                  {' '}
                  <span className="min-w-0 flex-1">
                    {' '}
                    <span
                      className={cn(
                        'block truncate text-[13px] font-medium',
                        active ? 'text-primary' : 'text-foreground',
                      )}
                    >
                      {' '}
                      {def.title}{' '}
                    </span>{' '}
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {def.description}
                    </span>{' '}
                  </span>{' '}
                  {active && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}{' '}
                </button>
              );
            })}{' '}
          </div>{' '}
        </div>
      )}{' '}
    </div>
  );
}
function StatusPill({
  status,
  dirty,
}: {
  status: { status: string; version: number } | null;
  dirty: boolean;
}) {
  if (!status) return null;
  return (
    <span
      title={dirty ? `Last ${status.status} as v${status.version}` : undefined}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide',
        dirty
          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
          : status.status === 'published'
            ? 'bg-green-500/10 text-green-600 dark:text-green-400'
            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      )}
    >
      {' '}
      <span className="relative flex h-1.5 w-1.5">
        {' '}
        <span
          className={cn(
            'absolute inline-flex h-full w-full animate-ping rounded-full opacity-60',
            dirty || status.status !== 'published' ? 'bg-amber-500' : 'bg-green-500',
          )}
        />{' '}
        <span
          className={cn(
            'relative inline-flex h-1.5 w-1.5 rounded-full',
            dirty || status.status !== 'published' ? 'bg-amber-500' : 'bg-green-500',
          )}
        />{' '}
      </span>{' '}
      {dirty
        ? 'Unsaved changes'
        : status.status === 'published'
          ? `Published v${status.version}`
          : 'Draft'}{' '}
    </span>
  );
}
function ViewportSwitcher({
  currentWidth,
  setViewport,
}: {
  currentWidth: number | undefined;
  setViewport: (w: number) => void;
}) {
  return (
    <div className="flex shrink-0 items-center rounded-lg border border-border bg-background p-0.5">
      {' '}
      {VIEWPORTS.map((vp) => {
        const Icon = vp.icon;
        const active = currentWidth === vp.width;
        return (
          <button
            key={vp.label}
            type="button"
            title={`${vp.label} (${vp.width}px)`}
            onClick={() => setViewport(vp.width)}
            className={cn(
              'flex h-7 w-8 items-center justify-center rounded-md transition',
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {' '}
            <Icon className="h-3.5 w-3.5" />{' '}
          </button>
        );
      })}{' '}
    </div>
  );
}
function MobileExitLink() {
  return (
    <Link
      href="/"
      title="Exit builder — back to the website"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
    >
      {' '}
      <ArrowLeft className="h-4 w-4" />{' '}
    </Link>
  );
} /**
 * Unified Apple-style toolbar. Rendered via the puck override, so it replaces * Puck's default header entirely. Desktop: a single row with everything. * Mobile/tablet: a primary row (exit, page, save, publish) plus a scrollable * tools row. Only one layout is in the DOM at a time. */
export function BuilderHeader() {
  const dispatch = useBuilderPuck((s) => s.dispatch);
  const previewMode = useBuilderPuck((s) => s.appState.ui.previewMode);
  const currentWidth = useBuilderPuck((s) => s.appState.ui.viewports?.current?.width);
  const history = useBuilderPuck((s) => s.history);
  const isDesktop = useMediaQuery(IS_DESKTOP_QUERY);
  const status = useBuilderUI((s) => s.status);
  const dirty = useBuilderUI((s) => s.dirty);
  const saving = useBuilderUI((s) => s.saving);
  const structureOpen = useBuilderUI((s) => s.structureOpen);
  const toggleStructure = useBuilderUI((s) => s.toggleStructure);
  const inspectorOpen = useBuilderUI((s) => s.inspectorOpen);
  const setInspectorOpen = useBuilderUI((s) => s.setInspectorOpen);
  const setResetOpen = useBuilderUI((s) => s.setResetOpen);
  const setPublishOpen = useBuilderUI((s) => s.setPublishOpen);
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
  const savePublish = (
    <>
      {' '}
      <Button
        size="sm"
        className="h-8 shrink-0 gap-1.5 px-3"
        disabled={saving || !dirty}
        onClick={() => void builderActions.current?.saveDraft()}
        title="Save draft (⌘S)"
      >
        {' '}
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Save className="h-3.5 w-3.5" />
        )}{' '}
        Save{' '}
      </Button>{' '}
      <Button
        size="sm"
        className="h-8 shrink-0 gap-1.5 px-3"
        disabled={saving}
        onClick={() => setPublishOpen(true)}
      >
        {' '}
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Rocket className="h-3.5 w-3.5" />
        )}{' '}
        Publish{' '}
      </Button>{' '}
    </>
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false); // Close mobile menu when switching to desktop
  useEffect(() => {
    if (isDesktop) setMobileMenuOpen(false);
  }, [isDesktop]); // Close mobile menu on outside click (when open)
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        // Check if click was on the hamburger button itself
        const target = e.target as HTMLElement;
        if (target.closest('[data-builder-hamburger]')) return;
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [mobileMenuOpen]);
  if (!isDesktop) {
    return (
      <header className="relative shrink-0 border-b border-border bg-card">
        {' '}
        <div className="flex h-12 items-center gap-1.5 px-2">
          {' '}
          <MobileExitLink />{' '}
          <div className="min-w-0 flex-1">
            {' '}
            <PageSwitcher />{' '}
          </div>{' '}
          <div className="flex shrink-0 items-center gap-1">
            {' '}
            <Button
              size="sm"
              className="h-8 gap-1 px-2.5"
              disabled={saving || !dirty}
              onClick={() => void builderActions.current?.saveDraft()}
              title="Save draft (⌘S)"
            >
              {' '}
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}{' '}
              <span className="hidden min-[420px]:inline">Save</span>{' '}
            </Button>{' '}
            <Button
              size="sm"
              className="h-8 gap-1 px-2.5"
              disabled={saving}
              onClick={() => setPublishOpen(true)}
            >
              {' '}
              <Rocket className="h-3.5 w-3.5" />{' '}
              <span className="hidden min-[420px]:inline">Publish</span>{' '}
            </Button>{' '}
            <button
              type="button"
              data-builder-hamburger
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((v) => !v)}
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition',
                mobileMenuOpen
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {' '}
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}{' '}
            </button>{' '}
          </div>{' '}
        </div>{' '}
        {mobileMenuOpen && (
          <>
            {' '}
            <div
              className="fixed inset-0 z-30 bg-gray-900/70 lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />{' '}
            <div
              ref={mobileMenuRef}
              className="absolute left-2 right-2 top-[52px] z-40 max-h-[calc(100dvh_-_4rem)] overflow-y-auto rounded-2xl border border-border bg-card shadow-sm shadow-black/15"
            >
              {' '}
              <div className="p-3">
                {' '}
                <div className="mb-3 flex items-center justify-between">
                  {' '}
                  <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    View
                  </span>{' '}
                  <StatusPill status={status} dirty={dirty} />{' '}
                </div>{' '}
                <div className="mb-3 flex items-center gap-2">
                  {' '}
                  <ViewportSwitcher currentWidth={currentWidth} setViewport={setViewport} />{' '}
                  <ToolbarIconButton
                    title={previewMode === 'interactive' ? 'Back to edit' : 'Preview mode'}
                    active={previewMode === 'interactive'}
                    onClick={togglePreview}
                  >
                    {' '}
                    <Eye className="h-4 w-4" />{' '}
                  </ToolbarIconButton>{' '}
                  <span className="ml-1 text-xs text-muted-foreground">
                    {previewMode === 'interactive' ? 'Preview' : 'Edit'}
                  </span>{' '}
                </div>{' '}
                <div className="my-3 h-px bg-border" />{' '}
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Edit
                </p>{' '}
                <div className="grid grid-cols-4 gap-2">
                  {' '}
                  <button
                    type="button"
                    disabled={!history.hasPast}
                    onClick={() => history.back()}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-xl border border-border bg-background p-3 text-xs font-medium transition',
                      !history.hasPast
                        ? 'cursor-not-allowed opacity-40'
                        : 'hover:bg-muted hover:text-foreground active:scale-95',
                    )}
                  >
                    {' '}
                    <Undo2 className="h-5 w-5" /> Undo{' '}
                  </button>{' '}
                  <button
                    type="button"
                    disabled={!history.hasFuture}
                    onClick={() => history.forward()}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-xl border border-border bg-background p-3 text-xs font-medium transition',
                      !history.hasFuture
                        ? 'cursor-not-allowed opacity-40'
                        : 'hover:bg-muted hover:text-foreground active:scale-95',
                    )}
                  >
                    {' '}
                    <Redo2 className="h-5 w-5" /> Redo{' '}
                  </button>{' '}
                  <AddBlockMenu asCard />{' '}
                  <button
                    type="button"
                    onClick={() => {
                      toggleStructure();
                      setMobileMenuOpen(false);
                    }}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-xl border border-border p-3 text-xs font-medium transition active:scale-95',
                      structureOpen
                        ? 'bg-primary/10 text-primary border-primary/20'
                        : 'bg-background hover:bg-muted',
                    )}
                  >
                    {' '}
                    <PanelLeft className="h-5 w-5" /> Layers{' '}
                  </button>{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setInspectorOpen(!inspectorOpen);
                      setMobileMenuOpen(false);
                    }}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-xl border border-border p-3 text-xs font-medium transition active:scale-95',
                      inspectorOpen
                        ? 'bg-primary/10 text-primary border-primary/20'
                        : 'bg-background hover:bg-muted',
                    )}
                  >
                    {' '}
                    <PanelRight className="h-5 w-5" /> Inspector{' '}
                  </button>{' '}
                  <div className="col-span-2">
                    {' '}
                    <SavedSectionsActions />{' '}
                  </div>{' '}
                  <button
                    type="button"
                    onClick={() => {
                      void builderActions.current?.openVersions();
                      setMobileMenuOpen(false);
                    }}
                    className="flex flex-col items-center gap-1 rounded-xl border border-border bg-background p-3 text-xs font-medium transition hover:bg-muted active:scale-95"
                  >
                    {' '}
                    <History className="h-5 w-5" /> History{' '}
                  </button>{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setResetOpen(true);
                      setMobileMenuOpen(false);
                    }}
                    className="flex flex-col items-center gap-1 rounded-xl border border-border bg-background p-3 text-xs font-medium transition hover:bg-muted active:scale-95"
                  >
                    {' '}
                    <RotateCcw className="h-5 w-5" /> Reset{' '}
                  </button>{' '}
                </div>{' '}
                <div className="my-3 h-px bg-border" />{' '}
                <div className="flex gap-2">
                  {' '}
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    disabled={saving || !dirty}
                    onClick={() => {
                      void builderActions.current?.saveDraft();
                      setMobileMenuOpen(false);
                    }}
                  >
                    {' '}
                    <Save className="mr-1.5 h-3.5 w-3.5" /> Save Draft{' '}
                  </Button>{' '}
                  <Button
                    size="sm"
                    className="flex-1"
                    disabled={saving}
                    onClick={() => setPublishOpen(true)}
                  >
                    {' '}
                    <Rocket className="mr-1.5 h-3.5 w-3.5" /> Publish{' '}
                  </Button>{' '}
                </div>{' '}
              </div>{' '}
            </div>{' '}
          </>
        )}{' '}
      </header>
    );
  }
  return (
    <header className="flex h-12 shrink-0 items-center gap-1.5 overflow-visible border-b border-border bg-card px-3">
      {' '}
      <Link
        href="/"
        title="Exit builder — back to the website"
        className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        {' '}
        <ArrowLeft className="h-3.5 w-3.5" />{' '}
        <span className="hidden whitespace-nowrap xl:inline">Exit builder</span>{' '}
      </Link>{' '}
      <ToolbarDivider />{' '}
      <div className="min-w-0 max-w-44 shrink sm:max-w-56 xl:max-w-none">
        <PageSwitcher />
      </div>{' '}
      <ToolbarDivider />{' '}
      <ToolbarIconButton
        title="Undo (⌘Z)"
        disabled={!history.hasPast}
        onClick={() => history.back()}
      >
        {' '}
        <Undo2 className="h-4 w-4" />{' '}
      </ToolbarIconButton>{' '}
      <ToolbarIconButton
        title="Redo (⇧⌘Z)"
        disabled={!history.hasFuture}
        onClick={() => history.forward()}
      >
        {' '}
        <Redo2 className="h-4 w-4" />{' '}
      </ToolbarIconButton>{' '}
      <ToolbarDivider /> <AddBlockMenu />{' '}
      <ToolbarIconButton
        title={structureOpen ? 'Hide Layers' : 'Show Layers'}
        active={structureOpen}
        onClick={toggleStructure}
      >
        {' '}
        <PanelLeft className="h-4 w-4" />{' '}
      </ToolbarIconButton>{' '}
      <ToolbarIconButton
        title={inspectorOpen ? 'Hide Inspector' : 'Show Inspector'}
        active={inspectorOpen}
        onClick={() => setInspectorOpen(!inspectorOpen)}
      >
        {' '}
        <PanelRight className="h-4 w-4" />{' '}
      </ToolbarIconButton>{' '}
      <SavedSectionsActions />{' '}
      <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1.5">
        {' '}
        <ToolbarIconButton
          title="Preview mode — click links and interact with the page (⌘I)"
          active={previewMode === 'interactive'}
          onClick={togglePreview}
        >
          {' '}
          <Eye className="h-4 w-4" />{' '}
        </ToolbarIconButton>{' '}
        <div className="hidden shrink-0 items-center gap-1.5 xl:flex">
          <ViewportSwitcher currentWidth={currentWidth} setViewport={setViewport} />
          <ToolbarDivider />
          <StatusPill status={status} dirty={dirty} />
          <ToolbarDivider />
        </div>{' '}
        <ToolbarIconButton
          title="Version history"
          onClick={() => void builderActions.current?.openVersions()}
        >
          {' '}
          <History className="h-4 w-4" />{' '}
        </ToolbarIconButton>{' '}
        <ToolbarIconButton title="Reset page to default" onClick={() => setResetOpen(true)}>
          {' '}
          <RotateCcw className="h-4 w-4" />{' '}
        </ToolbarIconButton>{' '}
        {savePublish}{' '}
      </div>{' '}
    </header>
  );
}
