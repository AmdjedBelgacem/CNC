'use client';

import { forwardRef, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  ArrowUp,
  Check,
  ChevronDown,
  Code2,
  ExternalLink,
  ImagePlus,
  Loader2,
  MousePointerClick,
  RotateCcw,
  Settings2,
  Sparkles,
  SquarePen,
  Wand2,
  X,
  LayoutTemplate,
  FilePlus2,
  Paintbrush,
} from 'lucide-react';
import { getBlockDefinition } from '@titan/shared';
import { cn } from '@/lib/utils';
import { ease, spring } from '@/lib/motion';
import { toast } from '@/components/ui/toast';
import { useBuilderPuck } from '@/lib/builder/use-builder-puck';
import { useOpenPage } from '../use-open-page';
import { useBuilderUI } from '../builder-ui-store';
import { prepareImage, useAiChat, type AssistantTurn, type Turn } from './ai-chat-store';
import { AiSettingsDialog } from './ai-settings-dialog';

/**
 * The AI builder: describe a change, paste code or drop a screenshot, and the page is built or
 * edited in the canvas as one undoable step. Docked where the inspector sits, so the canvas
 * stays in view while the AI works.
 */
export const AiBuilderPanel = forwardRef<HTMLElement>(function AiBuilderPanel(_props, ref) {
  const t = useTranslations('builder.ai');
  const setAiOpen = useBuilderUI((state) => state.setAiOpen);
  const { slug, openPage } = useOpenPage();
  const slugRef = useRef(slug);
  slugRef.current = slug;

  const turns = useAiChat((state) => state.conversations[slug]) ?? EMPTY;
  const running = useAiChat((state) => Boolean(state.running[slug]));
  const send = useAiChat((state) => state.send);
  const undo = useAiChat((state) => state.undo);
  const clear = useAiChat((state) => state.clear);

  const selected = useBuilderPuck((state) => state.selectedItem) as
    | { type: string; props?: Record<string, unknown> }
    | null
    | undefined;
  const [useSelection, setUseSelection] = useState(true);
  const selectionLabel = useMemo(() => describeNode(selected), [selected]);
  const selectedId = typeof selected?.props?.id === 'string' ? selected.props.id : undefined;

  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [code, setCode] = useState('');
  const [codeOpen, setCodeOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Follow the conversation as steps tick and replies land.
  useEffect(() => {
    const el = scrollRef.current;
    // The empty state reads top-down; only a conversation follows its newest message.
    if (el && turns.length > 0) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [turns]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !settingsOpen) setAiOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setAiOpen, settingsOpen]);

  const addFiles = useCallback(
    async (files: Iterable<File>) => {
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        try {
          const url = await prepareImage(file);
          setImages((list) => (list.length >= 3 ? list : [...list, url]));
        } catch (error) {
          toast({ type: 'err', title: t('imageFailed'), description: error instanceof Error ? error.message : undefined });
        }
      }
    },
    [t],
  );

  const submit = useCallback(
    (override?: string) => {
      const prompt = (override ?? text).trim() || (images.length ? t('defaultCopyPrompt') : code.trim() ? t('defaultCodePrompt') : '');
      if (!prompt || running) return;
      const scoped = useSelection && selectedId ? selectedId : undefined;
      void send({
        slug,
        text: prompt,
        images,
        code,
        selectedId: scoped,
        scope: scoped ? selectionLabel : undefined,
        currentSlug: () => slugRef.current,
      });
      setText('');
      setImages([]);
      setCode('');
      setCodeOpen(false);
    },
    [text, images, code, running, useSelection, selectedId, send, slug, selectionLabel, t],
  );

  const canSend = !running && Boolean(text.trim() || images.length || code.trim());

  return (
    <m.aside
      ref={ref}
      initial={{ opacity: 0, x: 14 }}
      animate={{ opacity: 1, x: 0, transition: spring.gentle }}
      exit={{ opacity: 0, x: 10, transition: { duration: 0.16, ease: ease.exit } }}
      aria-label={t('title')}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('Files')) {
          event.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        void addFiles(event.dataTransfer.files);
      }}
      className="relative flex min-h-0 w-[23rem] shrink-0 flex-col self-stretch overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm max-lg:absolute max-lg:inset-y-2 max-lg:end-2 max-lg:z-40 max-lg:w-[min(23rem,calc(100vw-1rem))] max-lg:shadow-xl"
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
        <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-sm">
          <Sparkles className="size-3.5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight text-foreground">{t('title')}</p>
          <p className="truncate text-2xs text-muted-foreground">{t('subtitle')}</p>
        </div>
        {turns.length > 0 && (
          <HeaderButton title={t('newChat')} onClick={() => clear(slug)} disabled={running}>
            <SquarePen className="size-3.5" aria-hidden="true" />
          </HeaderButton>
        )}
        <HeaderButton title={t('settings')} onClick={() => setSettingsOpen(true)}>
          <Settings2 className="size-3.5" aria-hidden="true" />
        </HeaderButton>
        <HeaderButton title={t('close')} onClick={() => setAiOpen(false)}>
          <X className="size-3.5" aria-hidden="true" />
        </HeaderButton>
      </div>

      {/* Conversation */}
      <div ref={scrollRef} className="scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
        {turns.length === 0 ? (
          <EmptyState onPick={(prompt) => { setText(prompt); inputRef.current?.focus(); }} onAttach={() => fileRef.current?.click()} onCode={() => setCodeOpen(true)} />
        ) : (
          <div className="flex flex-col gap-3">
            {turns.map((turn) =>
              turn.role === 'user' ? (
                <UserBubble key={turn.id} turn={turn} />
              ) : (
                <AssistantCard
                  key={turn.id}
                  turn={turn}
                  onUndo={() => undo(slug, turn.id)}
                  onOpenPage={(target) => openPage(target)}
                  onRetry={() => {
                    const index = turns.findIndex((item) => item.id === turn.id);
                    const prev = turns[index - 1];
                    if (prev && prev.role === 'user') submit(prev.text);
                  }}
                />
              ),
            )}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border/60 bg-surface-sunken/40 p-2.5">
        {selectedId && (
          <button
            type="button"
            onClick={() => setUseSelection((value) => !value)}
            className={cn(
              'mb-2 flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-medium transition-colors',
              useSelection
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground line-through',
            )}
            title={useSelection ? t('scopeOff') : t('scopeOn')}
          >
            <MousePointerClick className="size-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{t('scope', { block: selectionLabel })}</span>
          </button>
        )}

        <AnimatePresence initial={false}>
          {images.length > 0 && (
            <m.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-2 flex gap-2 overflow-hidden"
            >
              {images.map((url, index) => (
                <div key={index} className="group relative size-14 overflow-hidden rounded-lg border border-border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="size-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImages((list) => list.filter((_, i) => i !== index))}
                    className="absolute end-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                    aria-label={t('removeImage')}
                  >
                    <X className="size-2.5" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </m.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {codeOpen && (
            <m.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-2 overflow-hidden">
              <div className="flex items-center justify-between pb-1">
                <span className="text-2xs font-medium text-muted-foreground">{t('codeLabel')}</span>
                <button type="button" className="text-2xs text-muted-foreground hover:text-foreground" onClick={() => { setCode(''); setCodeOpen(false); }}>
                  {t('removeCode')}
                </button>
              </div>
              <textarea
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder={t('codePlaceholder')}
                spellCheck={false}
                dir="ltr"
                className="h-28 w-full resize-y rounded-lg border border-border bg-card px-2.5 py-2 font-mono text-2xs text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
              />
            </m.div>
          )}
        </AnimatePresence>

        <div className="rounded-xl border border-border bg-card shadow-xs transition focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                submit();
              }
            }}
            onPaste={(event) => {
              const files = [...event.clipboardData.files].filter((file) => file.type.startsWith('image/'));
              if (files.length) {
                event.preventDefault();
                void addFiles(files);
              }
            }}
            rows={3}
            placeholder={selectedId && useSelection ? t('placeholderSelected') : t('placeholder')}
            className="block max-h-48 min-h-[4.5rem] w-full resize-none bg-transparent px-3 pt-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
          />
          <div className="flex items-center gap-1 px-1.5 pb-1.5">
            <ComposerButton title={t('attachImage')} onClick={() => fileRef.current?.click()} disabled={images.length >= 3}>
              <ImagePlus className="size-4" aria-hidden="true" />
            </ComposerButton>
            <ComposerButton title={t('pasteCode')} active={codeOpen} onClick={() => setCodeOpen((open) => !open)}>
              <Code2 className="size-4" aria-hidden="true" />
            </ComposerButton>
            <span className="ms-auto truncate text-2xs text-muted-foreground/70">{t('enterHint')}</span>
            <m.button
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={() => submit()}
              disabled={!canSend}
              aria-label={t('send')}
              className="ms-1 flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition disabled:opacity-40"
            >
              {running ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ArrowUp className="size-4" aria-hidden="true" />}
            </m.button>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          hidden
          onChange={(event) => {
            if (event.target.files) void addFiles(event.target.files);
            event.target.value = '';
          }}
        />
      </div>

      <AnimatePresence>
        {dragging && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-2 z-10 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/60 bg-card/90 text-sm font-medium text-primary backdrop-blur-sm"
          >
            <ImagePlus className="size-6" aria-hidden="true" />
            {t('dropHint')}
          </m.div>
        )}
      </AnimatePresence>

      <AiSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </m.aside>
  );
});

const EMPTY: Turn[] = [];

function describeNode(node: { type: string; props?: Record<string, unknown> } | null | undefined): string {
  if (!node) return '';
  const label = getBlockDefinition(node.type)?.label ?? node.type;
  const text = ['text', 'label', 'title', 'heading'].map((key) => node.props?.[key]).find((value) => typeof value === 'string' && value.trim()) as
    | string
    | undefined;
  return text ? `${label} · “${text.length > 28 ? `${text.slice(0, 28)}…` : text}”` : label;
}

/* -------------------------------------------------------------- pieces */

function HeaderButton({ title, onClick, disabled, children }: { title: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function ComposerButton({ title, onClick, disabled, active, children }: { title: string; onClick: () => void; disabled?: boolean; active?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-40',
        active && 'bg-primary/10 text-primary',
      )}
    >
      {children}
    </button>
  );
}

function EmptyState({ onPick, onAttach, onCode }: { onPick: (prompt: string) => void; onAttach: () => void; onCode: () => void }) {
  const t = useTranslations('builder.ai');
  const ideas = [
    { icon: LayoutTemplate, title: t('idea.landing'), prompt: t('idea.landingPrompt') },
    { icon: Paintbrush, title: t('idea.restyle'), prompt: t('idea.restylePrompt') },
    { icon: FilePlus2, title: t('idea.newPage'), prompt: t('idea.newPagePrompt') },
    { icon: Wand2, title: t('idea.section'), prompt: t('idea.sectionPrompt') },
  ];
  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="px-1">
        <p className="font-display text-lg font-medium leading-snug text-foreground">{t('emptyTitle')}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t('emptyBody')}</p>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {ideas.map(({ icon: Icon, title, prompt }, index) => (
          <m.button
            key={title}
            type="button"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0, transition: { ...spring.smooth, delay: index * 0.04 } }}
            whileHover={{ y: -1 }}
            onClick={() => onPick(prompt)}
            className="flex items-start gap-3 rounded-xl border border-border/70 bg-background p-3 text-start transition-colors hover:border-primary/30 hover:bg-primary/5"
          >
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-3.5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-foreground">{title}</span>
              <span className="mt-0.5 line-clamp-2 block text-2xs leading-relaxed text-muted-foreground">{prompt}</span>
            </span>
          </m.button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onAttach} className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border px-3 py-3 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:text-primary">
          <ImagePlus className="size-4" aria-hidden="true" />
          {t('copyScreenshot')}
        </button>
        <button type="button" onClick={onCode} className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border px-3 py-3 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:text-primary">
          <Code2 className="size-4" aria-hidden="true" />
          {t('copyCode')}
        </button>
      </div>
      <p className="px-1 text-2xs leading-relaxed text-muted-foreground/80">{t('safetyNote')}</p>
    </div>
  );
}

function UserBubble({ turn }: { turn: Extract<Turn, { role: 'user' }> }) {
  const t = useTranslations('builder.ai');
  return (
    <m.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, transition: spring.smooth }} className="ms-6 flex flex-col items-end gap-1.5">
      {turn.scope && (
        <span className="flex max-w-full items-center gap-1 truncate rounded-full bg-muted px-2 py-0.5 text-2xs text-muted-foreground">
          <MousePointerClick className="size-3 shrink-0" aria-hidden="true" />
          {turn.scope}
        </span>
      )}
      {turn.images.length > 0 && (
        <div className="flex gap-1.5">
          {turn.images.map((url, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={index} src={url} alt="" className="size-16 rounded-lg border border-border object-cover" />
          ))}
        </div>
      )}
      {turn.codeChars > 0 && (
        <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-mono text-2xs text-muted-foreground">
          <Code2 className="size-3" aria-hidden="true" />
          {t('codeChip', { count: turn.codeChars })}
        </span>
      )}
      <p className="whitespace-pre-wrap rounded-2xl rounded-ee-md bg-primary px-3 py-2 text-sm leading-relaxed text-primary-foreground">{turn.text}</p>
    </m.div>
  );
}

function AssistantCard({
  turn,
  onUndo,
  onOpenPage,
  onRetry,
}: {
  turn: AssistantTurn;
  onUndo: () => void;
  onOpenPage: (slug: string) => void;
  onRetry: () => void;
}) {
  const t = useTranslations('builder.ai');
  const [showWarnings, setShowWarnings] = useState(false);
  const seconds = turn.elapsedMs ? Math.max(1, Math.round(turn.elapsedMs / 1000)) : null;
  return (
    <m.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, transition: spring.smooth }} className="me-2 rounded-2xl rounded-es-md border border-border/70 bg-background p-3">
      <ol className="flex flex-col gap-1.5">
        {turn.steps.map((step) => (
          <li key={step.key} className="flex items-center gap-2 text-xs">
            <StepIcon state={step.state} />
            <span className={cn('text-foreground', step.state === 'done' && 'text-muted-foreground')}>{step.label}</span>
            {step.detail && <span className="truncate text-2xs text-muted-foreground">· {step.detail}</span>}
          </li>
        ))}
      </ol>

      {turn.status === 'running' && seconds !== null && (
        <p className="mt-2 text-2xs text-muted-foreground">{t('working', { seconds })}</p>
      )}

      {turn.status === 'error' && (
        <div className="mt-2.5 rounded-lg bg-destructive/10 px-2.5 py-2 text-xs leading-relaxed text-destructive">
          <p>{turn.error}</p>
          <button type="button" onClick={onRetry} className="mt-1.5 inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline">
            <RotateCcw className="size-3" aria-hidden="true" />
            {t('retry')}
          </button>
        </div>
      )}

      {turn.status === 'done' && (
        <>
          {turn.reply && <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{turn.reply}</p>}

          {turn.notApplied && <p className="mt-2 text-xs text-warning">{t('notApplied')}</p>}

          {turn.warnings && turn.warnings.length > 0 && (
            <div className="mt-2">
              <button type="button" onClick={() => setShowWarnings((v) => !v)} className="flex items-center gap-1 text-2xs font-medium text-warning">
                <AlertTriangle className="size-3" aria-hidden="true" />
                {t('warnings', { count: turn.warnings.length })}
                <ChevronDown className={cn('size-3 transition-transform', showWarnings && 'rotate-180')} aria-hidden="true" />
              </button>
              {showWarnings && (
                <ul className="mt-1 list-disc space-y-0.5 ps-4 text-2xs leading-relaxed text-muted-foreground">
                  {turn.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {turn.previous !== undefined && (
              <button
                type="button"
                onClick={onUndo}
                disabled={turn.undone}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-2xs font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
              >
                <RotateCcw className="size-3" aria-hidden="true" />
                {turn.undone ? t('undone') : t('undo')}
              </button>
            )}
            {turn.createdPage && (
              <button
                type="button"
                onClick={() => onOpenPage(turn.createdPage!.slug)}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-2xs font-medium text-primary-foreground transition hover:opacity-90"
              >
                <ExternalLink className="size-3" aria-hidden="true" />
                {t('openPage', { title: turn.createdPage.title })}
              </button>
            )}
            {turn.previous !== undefined && !turn.undone && <span className="text-2xs text-muted-foreground">{t('appliedDraft')}</span>}
          </div>

          {turn.usage && (
            <p className="mt-2.5 border-t border-border/60 pt-2 text-2xs text-muted-foreground/80" title={turn.model}>
              {t('usage', {
                calls: turn.usage.calls,
                tokens: formatTokens(turn.usage.inputTokens + turn.usage.outputTokens),
                cached: formatTokens(turn.usage.cachedTokens),
                seconds: seconds ?? 0,
              })}
            </p>
          )}
        </>
      )}
    </m.div>
  );
}

function StepIcon({ state }: { state: AssistantTurn['steps'][number]['state'] }) {
  if (state === 'running') return <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" aria-hidden="true" />;
  if (state === 'error') return <X className="size-3.5 shrink-0 text-destructive" aria-hidden="true" />;
  return (
    <span className="flex size-3.5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
      <Check className="size-2.5" aria-hidden="true" />
    </span>
  );
}

function formatTokens(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  return String(value);
}
