'use client';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { AnimatePresence, m } from 'framer-motion';
import { ease, spring } from '@/lib/motion';
import {
  EMAIL_CATEGORY_LABELS,
  type EmailBlock,
  type EmailBlockType,
  type EmailLayout,
  type EmailTemplateDetail,
} from '@titan/shared';
import { AdminCommandBar, AdminPageHeader, BarPrimaryButton } from '@/components/admin/admin-chrome';
import {
  Field,
  FormSection,
  FormSkeleton,
  SelectField,
  SwitchField,
  TextField,
  TextInput,
  TextArea,
} from '@/components/admin/admin-form';
import { ColorField, SaveDock, StatusChip } from '@/components/admin/form-page';
import {
  DragHandle,
  SortableItem,
  SortableList,
  arrayMove,
  useSortableItem,
} from '@/components/admin/sortable-list';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Skeleton } from '@/components/ui/skeleton';
import { Reveal } from '@/components/ui/motion';
import { toast } from '@/components/ui/toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertTriangle,
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Braces,
  CheckCircle2,
  Code,
  Columns2,
  Eye,
  Heading,
  Image as ImageIcon,
  Layers,
  Loader2,
  Minus,
  Monitor,
  MousePointerClick,
  MoveVertical,
  PanelBottom,
  Plus,
  Send,
  Settings2,
  ShieldAlert,
  Smartphone,
  Table2,
  Tablet,
  Trash2,
  Type,
  type LucideIcon,
} from 'lucide-react';

/** Blocks an admin may add. `raw-html` is intentionally absent until P1 ships
 *  the sanitizer; offering a button that always fails would be worse. */
const ADDABLE: EmailBlockType[] = [
  'heading',
  'text',
  'button',
  'image',
  'data-table',
  'columns',
  'spacer',
  'divider',
  'footer',
];

const BLOCK_LABEL: Record<EmailBlockType, string> = {
  heading: 'blockHeading',
  text: 'blockText',
  button: 'blockButton',
  image: 'blockImage',
  'data-table': 'blockDataTable',
  columns: 'blockColumns',
  spacer: 'blockSpacer',
  divider: 'blockDivider',
  footer: 'blockFooter',
  'raw-html': 'blockRawHtml',
};

const BLOCK_ICON: Record<EmailBlockType, LucideIcon> = {
  heading: Heading,
  text: Type,
  button: MousePointerClick,
  image: ImageIcon,
  'data-table': Table2,
  columns: Columns2,
  spacer: MoveVertical,
  divider: Minus,
  footer: PanelBottom,
  'raw-html': Code,
};

const WIDTHS = { mobile: 375, tablet: 640, desktop: 700 } as const;
type WidthKey = keyof typeof WIDTHS;

const WIDTH_ICON: Record<WidthKey, LucideIcon> = {
  mobile: Smartphone,
  tablet: Tablet,
  desktop: Monitor,
};

/**
 * Width labels are spelled out rather than built from the width key. The
 * runtime-message-keys test verifies that every `t('…')` lookup resolves, and a
 * template string defeats that check — so the builder's viewport labels follow
 * the same explicit-labelKey convention.
 */
const WIDTH_LABEL: Record<WidthKey, 'widthMobile' | 'widthTablet' | 'widthDesktop'> = {
  mobile: 'widthMobile',
  tablet: 'widthTablet',
  desktop: 'widthDesktop',
};

const STATUS_LABEL: Record<string, 'status_draft' | 'status_published' | 'status_archived'> = {
  draft: 'status_draft',
  published: 'status_published',
  archived: 'status_archived',
};

const STATUS_TONE: Record<string, 'draft' | 'live' | 'archived'> = {
  draft: 'draft',
  published: 'live',
  archived: 'archived',
};

interface TriggerInfo {
  key: string;
  label: string;
  description: string;
  variables: Array<{ path: string; type: string; required: boolean; label: string; example: string }>;
  samplePayload: Record<string, unknown>;
  bindings: Array<{ tenantId: string | null; templateId: string; locale: string | null; enabled: boolean }>;
}

interface LintResult {
  used: string[];
  allowed: string[];
  unknown: string[];
  unused: string[];
  valid: boolean;
}

let seq = 0;
function newId(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

function defaultBlock(type: EmailBlockType): EmailBlock {
  const id = newId(type.slice(0, 3));
  switch (type) {
    case 'heading':
      return { id, type, props: { text: 'Heading', level: 2, align: 'left', color: '#1a1a1a' } } as EmailBlock;
    case 'text':
      return {
        id,
        type,
        props: { html: 'Write your message here.', align: 'left', color: '#1a1a1a', fontSize: 16, lineHeight: 1.6 },
      } as EmailBlock;
    case 'button':
      return { id, type, props: { label: 'Continue', url: 'https://example.com', align: 'center', variant: 'primary' } } as EmailBlock;
    case 'image':
      return { id, type, props: { url: 'https://example.com/logo.png', alt: 'Baroot CNC Solutions', width: 200, height: 60, align: 'center' } } as EmailBlock;
    case 'spacer':
      return { id, type, props: { height: 16 } } as EmailBlock;
    case 'divider':
      return { id, type, props: { color: '#dfe4ea' } } as EmailBlock;
    case 'data-table':
      return {
        id,
        type,
        props: { source: '', mode: 'columns', columns: [{ key: 'title', label: 'Item' }], align: 'left' },
      } as EmailBlock;
    case 'columns':
      return { id, type, props: { columns: [] } } as EmailBlock;
    case 'footer':
      return { id, type, props: { text: 'You are receiving this email.', showUnsubscribe: false } } as EmailBlock;
    default:
      return { id, type: 'text', props: { html: '', align: 'left', color: '#1a1a1a', fontSize: 16, lineHeight: 1.6 } } as EmailBlock;
  }
}

/** One line that says what a block currently contains, for the collapsed row. */
function blockSummary(block: EmailBlock): string {
  const p = block.props as Record<string, unknown>;
  const clip = (s: string) => (s.length > 72 ? `${s.slice(0, 72)}…` : s);
  switch (block.type) {
    case 'heading':
      return clip(String(p.text ?? ''));
    case 'text':
      return clip(String(p.html ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
    case 'button':
      return clip(String(p.label ?? ''));
    case 'image':
      return clip(String(p.alt || p.url || ''));
    case 'spacer':
      return `${Number(p.height ?? 0)}px`;
    case 'divider':
      return String(p.color ?? '');
    case 'data-table':
      return clip(String(p.source ?? ''));
    case 'columns':
      return `${((p.columns as unknown[]) ?? []).length}`;
    case 'footer':
      return clip(String(p.text ?? ''));
    default:
      return '';
  }
}

interface Snapshot {
  layout: EmailLayout;
  subject: string;
  preheader: string;
}

export function EmailTemplateEditor({ templateId }: { templateId: string }) {
  const t = useTranslations('admin.email');

  const [template, setTemplate] = useState<EmailTemplateDetail | null>(null);
  const [layout, setLayout] = useState<EmailLayout | null>(null);
  const [subject, setSubject] = useState('');
  const [preheader, setPreheader] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [width, setWidth] = useState<WidthKey>('desktop');
  const [pane, setPane] = useState<'edit' | 'preview'>('edit');

  const [triggers, setTriggers] = useState<TriggerInfo[]>([]);
  const [boundTrigger, setBoundTrigger] = useState<string>('');

  const [preview, setPreview] = useState<{ html: string; text: string; subject: string } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [showText, setShowText] = useState(false);
  const [lint, setLint] = useState<LintResult | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // What the server holds. `dirty` is a real comparison against this, so editing
  // a field and typing it back does not leave the dock asking to save.
  const [savedSnap, setSavedSnap] = useState('');

  // ---- load -------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setLoadStatus(null);
    (async () => {
      try {
        const [tpl, trig] = await Promise.all([
          api.get<{ data: EmailTemplateDetail }>(`/admin/email/templates/${templateId}`),
          api.get<{ data: TriggerInfo[] }>('/admin/email/triggers'),
        ]);
        if (cancelled) return;
        const list = trig?.data ?? [];
        setTriggers(list);
        const d = tpl?.data;
        if (d) {
          setTemplate(d);
          setLayout(d.layout);
          setSubject(d.subjectTemplate ?? '');
          setPreheader(d.preheaderTemplate ?? '');
          setSavedSnap(
            JSON.stringify({
              layout: d.layout,
              subject: d.subjectTemplate ?? '',
              preheader: d.preheaderTemplate ?? '',
            } satisfies Snapshot),
          );
          // An existing tenant binding wins over the system default so the
          // editor lints against the variables this template may actually use.
          const own = list.find((x) =>
            x.bindings.some((b) => b.templateId === templateId && b.tenantId !== null),
          );
          setBoundTrigger(own?.key ?? list.find((x) => x.bindings.some((b) => b.templateId === templateId))?.key ?? '');
        }
      } catch (e) {
        if (!cancelled) {
          setLoadStatus((e as { status?: number })?.status ?? null);
          setError(e instanceof Error ? e.message : t('loadError'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [templateId, t, reloadKey]);

  const trigger = useMemo(() => triggers.find((x) => x.key === boundTrigger) ?? null, [triggers, boundTrigger]);

  const currentSnap = useMemo(
    () => (layout ? JSON.stringify({ layout, subject, preheader } satisfies Snapshot) : ''),
    [layout, subject, preheader],
  );
  const dirty = Boolean(layout) && currentSnap !== savedSnap;

  // ---- preview + lint ----------------------------------------------------
  const refresh = useCallback(async () => {
    if (!layout) return;
    setRendering(true);
    try {
      const res = await api.post<{
        data: { html: string; text: string; subject: string } | null;
        error?: { message: string };
      }>('/admin/email/preview', {
        layout,
        subjectTemplate: subject,
        preheaderTemplate: preheader || null,
        payload: trigger?.samplePayload ?? {},
        triggerKey: boundTrigger || null,
      });
      if (res?.error) {
        setPreviewError(res.error.message);
        setPreview(null);
      } else {
        setPreviewError(null);
        setPreview(res?.data ?? null);
      }
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : t('renderError'));
    }

    try {
      const l = await api.post<{ data: LintResult }>('/admin/email/lint', {
        layout,
        triggerKey: boundTrigger || null,
      });
      setLint(l?.data ?? null);
    } catch {
      // Linting is advisory; a failure here must not block editing.
    } finally {
      setRendering(false);
    }
  }, [layout, subject, preheader, trigger, boundTrigger, t]);

  useEffect(() => {
    if (!layout) return;
    const handle = setTimeout(() => void refresh(), 400);
    return () => clearTimeout(handle);
  }, [layout, subject, preheader, boundTrigger, refresh]);

  function mutate(fn: (draft: EmailLayout) => void) {
    setLayout((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  }

  function patchBlock(id: string, props: Record<string, unknown>) {
    mutate((d) => {
      const b = d.blocks.find((x) => x.id === id);
      if (b) b.props = { ...b.props, ...props };
    });
  }

  const reorder = useCallback((from: number, to: number) => {
    setLayout((prev) => {
      if (!prev) return prev;
      return { ...prev, blocks: arrayMove(prev.blocks, from, to) };
    });
  }, []);

  function removeBlock(id: string) {
    mutate((d) => {
      d.blocks = d.blocks.filter((x) => x.id !== id);
    });
    if (selected === id) setSelected(null);
  }

  function addBlock(type: EmailBlockType) {
    const b = defaultBlock(type);
    mutate((d) => {
      d.blocks.push(b);
    });
    setSelected(b.id);
  }

  // ---- actions -----------------------------------------------------------
  async function saveDraftInternal(showToast: boolean) {
    if (!layout) return;
    const snap = currentSnap;
    setSaving(true);
    setSaveFailed(false);
    setError(null);
    try {
      await api.patch(`/admin/email/templates/${templateId}`, {
        layout,
        subjectTemplate: subject,
        preheaderTemplate: preheader || null,
      });
      setSavedSnap(snap);
      if (showToast) toast({ type: 'ok', title: t('saved') });
    } catch (e) {
      const message = e instanceof Error ? e.message : t('saveError');
      setError(message);
      setSaveFailed(true);
      if (showToast) toast({ type: 'err', title: t('saveError'), description: message });
      throw e;
    } finally {
      setSaving(false);
    }
  }

  async function saveDraft() {
    try {
      await saveDraftInternal(true);
    } catch {
      // The inline banner already carries the failure; the toast above mirrors it.
    }
  }

  function discard() {
    try {
      const s = JSON.parse(savedSnap) as Snapshot;
      setLayout(s.layout);
      setSubject(s.subject);
      setPreheader(s.preheader);
      setSelected(null);
      setError(null);
    } catch {
      /* snapshot is always our own JSON */
    }
  }

  async function publish() {
    setPublishing(true);
    setError(null);
    try {
      await saveDraftInternal(false);
      await api.post(`/admin/email/templates/${templateId}/publish`, {
        triggerKey: boundTrigger || undefined,
      });
      const fresh = await api.get<{ data: EmailTemplateDetail }>(`/admin/email/templates/${templateId}`);
      if (fresh?.data) setTemplate(fresh.data);
      toast({ type: 'ok', title: t('publishedToast') });
    } catch (e) {
      const message = e instanceof Error ? e.message : t('saveError');
      setError(message);
      toast({ type: 'err', title: t('publishFailed'), description: message });
    } finally {
      setPublishing(false);
    }
  }

  const trail = [
    { label: t('templatesTitle'), href: '/admin/email' },
    { label: template?.name ?? t('editor') },
  ];

  if (loading) {
    return (
      <div className="w-full">
        <AdminCommandBar trail={trail} live={false} />
        <div className="mx-auto w-full max-w-[1500px] space-y-6 pt-6" aria-busy="true">
          <div className="space-y-3 pt-2">
            <Skeleton className="h-9 w-72" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <FormSkeleton fields={3} />
            <Skeleton className="h-[28rem] w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!layout || !template) {
    const forbidden = loadStatus === 403;
    return (
      <div className="w-full">
        <AdminCommandBar trail={trail} live={false} />
        <div className="mx-auto w-full max-w-3xl pt-10">
          <div className="rounded-xl border border-border/70 bg-card shadow-xs">
            {forbidden ? (
              <EmptyState
                icon={ShieldAlert}
                title={t('forbiddenTitle')}
                description={t('forbiddenBody')}
                action={
                  <a
                    href="/admin/email"
                    className="pressable inline-flex h-9 items-center rounded-lg border border-border/80 bg-card px-3 text-13 font-medium text-foreground shadow-xs transition-colors hover:bg-muted"
                  >
                    {t('backToTemplates')}
                  </a>
                }
              />
            ) : (
              <ErrorState
                title={t('loadError')}
                description={error ?? undefined}
                onRetry={() => setReloadKey((k) => k + 1)}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  const readOnly = template.isSystem;
  const blockKeys = layout.blocks.map((b) => b.id);
  const statusTone = STATUS_TONE[template.status] ?? 'draft';

  return (
    <div className="w-full">
      <AdminCommandBar
        trail={trail}
        live={false}
        primary={
          !readOnly ? (
            <BarPrimaryButton
              onClick={() => void publish()}
              disabled={saving || publishing}
              icon={publishing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            >
              {t('publish')}
            </BarPrimaryButton>
          ) : undefined
        }
      />

      <div className="space-y-6 pt-6">
        <div className="mx-auto w-full max-w-[1500px]">
          <AdminPageHeader
            title={template.name}
            description={
              <span dir="ltr" className="font-mono text-xs">
                {template.slug}
              </span>
            }
            badge={
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip tone={statusTone}>{t(STATUS_LABEL[template.status] ?? 'status_draft')}</StatusChip>
                {template.status === 'published' && (
                  <span className="font-mono text-xs text-muted-foreground" dir="ltr">
                    v{template.version}
                  </span>
                )}
                {template.isSystem && (
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    {t('systemBadge')}
                  </span>
                )}
              </div>
            }
          />
        </div>

        <div className="mx-auto w-full max-w-[1500px] space-y-4 empty:hidden">
          <AnimatePresence initial={false}>
            {error && (
              <m.div
                key="error"
                role="alert"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.24, ease: ease.emerge } }}
                exit={{ opacity: 0, transition: { duration: 0.14 } }}
                className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/[0.06] px-4 py-3 text-sm text-destructive"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </m.div>
            )}
          </AnimatePresence>
          {readOnly && (
            <div className="rounded-xl border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning">
              {t('systemReadOnly')}
            </div>
          )}
        </div>

        {/* Below xl the two panes become a switch; at xl both are on screen. */}
        <div className="mx-auto w-full max-w-[1500px] xl:hidden">
          <Segmented
            value={pane}
            onChange={setPane}
            options={[
              { value: 'edit', label: t('paneEdit') },
              { value: 'preview', label: t('preview') },
            ]}
          />
        </div>

        <div className="mx-auto grid w-full max-w-[1500px] items-start gap-6 pb-28 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          {/* -------------------------------------------------- editing pane */}
          <div className={cn('min-w-0 flex-col gap-6', pane === 'edit' ? 'flex' : 'hidden xl:flex')}>
            <Reveal>
              <FormSection
                id="details"
                icon={Settings2}
                title={t('detailsTitle')}
                description={t('detailsHint')}
              >
                <div className="space-y-5">
                  <dl className="grid grid-cols-3 gap-3 rounded-lg border border-border/60 bg-surface-sunken/50 p-3 text-xs">
                    <Meta label={t('fieldCategory')}>{EMAIL_CATEGORY_LABELS[template.category] ?? template.category}</Meta>
                    <Meta label={t('colVersion')}>
                      <span dir="ltr">{template.status === 'published' ? `v${template.version}` : '—'}</span>
                    </Meta>
                    <Meta label={t('colUpdated')}>{new Date(template.updatedAt).toLocaleDateString()}</Meta>
                  </dl>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <TextField
                      label={t('subject')}
                      value={subject}
                      disabled={readOnly}
                      onChange={(e) => setSubject(e.target.value)}
                    />
                    <TextField
                      label={t('preheader')}
                      hint={t('preheaderHint')}
                      value={preheader}
                      disabled={readOnly}
                      onChange={(e) => setPreheader(e.target.value)}
                    />
                  </div>
                  <SelectField
                    label={t('bindTrigger')}
                    hint={trigger?.description}
                    value={boundTrigger}
                    onChange={(e) => setBoundTrigger(e.target.value)}
                  >
                    <option value="">{t('noTrigger')}</option>
                    {triggers.map((x) => (
                      <option key={x.key} value={x.key}>
                        {x.label}
                      </option>
                    ))}
                  </SelectField>
                </div>
              </FormSection>
            </Reveal>

            <Reveal delay={0.04}>
              <FormSection
                id="blocks"
                icon={Layers}
                title={t('blocks')}
                description={t('blocksHint')}
                badge={t('blockCount', { count: layout.blocks.length })}
                actions={
                  !readOnly ? (
                    <AddBlockMenu onAdd={addBlock}>
                      <button
                        type="button"
                        className="pressable inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-13 font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                      >
                        <Plus className="size-4" />
                        {t('addBlock')}
                      </button>
                    </AddBlockMenu>
                  ) : undefined
                }
              >
                {layout.blocks.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/80 bg-surface-sunken/40 px-6 py-10 text-center">
                    <span className="flex size-11 items-center justify-center rounded-xl border border-border/70 bg-card text-muted-foreground shadow-xs">
                      <Layers className="size-5" />
                    </span>
                    <div>
                      <p className="font-display text-base font-medium">{t('emptyBlocksTitle')}</p>
                      <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
                        {t('emptyBlocksHint')}
                      </p>
                    </div>
                    {!readOnly && (
                      <div className="flex flex-wrap justify-center gap-1.5">
                        {(['heading', 'text', 'button'] as const).map((type) => {
                          const Icon = BLOCK_ICON[type];
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() => addBlock(type)}
                              className="pressable inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card px-3 py-1.5 text-xs font-medium shadow-xs transition-colors hover:border-border-strong hover:bg-muted/60"
                            >
                              <Icon className="size-3.5 text-muted-foreground" />
                              {t(BLOCK_LABEL[type] as never)}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <SortableList keys={blockKeys} onMove={reorder} className="space-y-2" aria-label={t('blocks')}>
                    <AnimatePresence initial={false}>
                      {layout.blocks.map((b) => (
                        <SortableItem
                          key={b.id}
                          id={b.id}
                          initial={{ opacity: 0, y: 10, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.16, ease: ease.exit } }}
                        >
                          <BlockCard
                            block={b}
                            open={selected === b.id}
                            readOnly={readOnly}
                            onToggle={() => setSelected((cur) => (cur === b.id ? null : b.id))}
                            onRemove={() => removeBlock(b.id)}
                            onChange={(p) => patchBlock(b.id, p)}
                          />
                        </SortableItem>
                      ))}
                    </AnimatePresence>
                  </SortableList>
                )}
              </FormSection>
            </Reveal>

            <Reveal delay={0.08}>
              <FormSection
                id="variables"
                icon={Braces}
                title={t('variables')}
                description={t('variablesHint')}
                bodyClassName="p-0 sm:p-0"
              >
                {lint && lint.unknown.length > 0 && (
                  <div className="border-b border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                    <div className="mb-1 font-medium">{t('unknownVariables')}</div>
                    <ul className="space-y-0.5 font-mono" dir="ltr">
                      {lint.unknown.map((u) => (
                        <li key={u}>{`{{${u}}}`}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {!trigger && <p className="px-4 py-4 text-xs text-muted-foreground sm:px-5">{t('noTrigger')}</p>}

                {trigger && (
                  <ul className="max-h-96 divide-y divide-border/60 overflow-y-auto">
                    {trigger.variables.map((v) => {
                      const unknown = lint?.unknown.includes(v.path) ?? false;
                      return (
                        <li key={v.path} className="px-4 py-2.5 sm:px-5">
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              disabled={readOnly}
                              onClick={() => insertToken(v.path)}
                              dir="ltr"
                              className="truncate rounded-md bg-primary/[0.07] px-1.5 py-0.5 text-start font-mono text-xs font-medium text-primary transition-colors hover:bg-primary/15 disabled:opacity-50"
                              title={t('insert')}
                            >
                              {`{{${v.path}}}`}
                            </button>
                            <span
                              className={cn(
                                'shrink-0 rounded-full px-2 py-0.5 text-2xs font-medium',
                                v.required ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground',
                              )}
                            >
                              {v.required ? t('required') : t('optional')}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {v.label} · {v.type}
                            {unknown && <span className="ms-1 text-destructive">— {t('unknownVariables')}</span>}
                          </div>
                          <div className="mt-0.5 truncate font-mono text-2xs text-muted-foreground/70" dir="ltr">
                            {t('example')}: {v.example}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {lint && lint.valid && (
                  <p className="flex items-center gap-1.5 border-t border-border/60 px-4 py-2.5 text-xs text-success sm:px-5">
                    <CheckCircle2 className="size-3.5" />
                    {t('validTemplate')}
                  </p>
                )}
              </FormSection>
            </Reveal>

            <p className="text-xs leading-relaxed text-muted-foreground">{t('publishHint')}</p>
          </div>

          {/* ------------------------------------------------- preview pane */}
          <div
            className={cn(
              'min-w-0 xl:sticky xl:top-24',
              pane === 'preview' ? 'block' : 'hidden xl:block',
            )}
          >
            <Reveal delay={0.06}>
              <section
                aria-label={t('preview')}
                className="flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
                  <h2 className="flex items-center gap-2 font-display text-[1.0625rem] font-medium tracking-[-0.015em]">
                    <Eye className="size-4 text-muted-foreground" />
                    {t('preview')}
                    <AnimatePresence initial={false}>
                      {rendering && (
                        <m.span
                          key="rendering"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="inline-flex items-center gap-1 font-sans text-2xs font-normal text-muted-foreground"
                        >
                          <Loader2 className="size-3 animate-spin" />
                          {t('rendering')}
                        </m.span>
                      )}
                    </AnimatePresence>
                  </h2>
                  <div className="flex items-center gap-2">
                    <div role="group" aria-label={t('previewWidth')} className="flex items-center gap-0.5 rounded-lg bg-muted/70 p-0.5">
                      {(Object.keys(WIDTHS) as WidthKey[]).map((k) => {
                        const Icon = WIDTH_ICON[k];
                        return (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setWidth(k)}
                            aria-pressed={width === k}
                            title={t(WIDTH_LABEL[k])}
                            className={cn(
                              'relative flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors',
                              width === k ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                            )}
                          >
                            {width === k && (
                              <m.span
                                layoutId="email-preview-width"
                                aria-hidden="true"
                                className="absolute inset-0 rounded-md bg-card shadow-xs"
                                transition={spring.smooth}
                              />
                            )}
                            <Icon className="relative size-3.5" />
                            <span className="relative hidden sm:inline">{t(WIDTH_LABEL[k])}</span>
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowText((v) => !v)}
                      aria-pressed={showText}
                      className={cn(
                        'h-7 rounded-md px-2 text-xs font-medium transition-colors',
                        showText ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      {t('showText')}
                    </button>
                  </div>
                </div>

                {/* The inbox row: what the recipient sees before opening. */}
                <div className="border-b border-border/60 bg-surface-sunken/40 px-4 py-2.5">
                  <p className="truncate text-13 font-medium text-foreground">
                    {preview?.subject || subject || t('noSubject')}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{preheader || t('noPreheader')}</p>
                </div>

                <AnimatePresence initial={false}>
                  {previewError && (
                    <m.div
                      key="preview-error"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto', transition: { duration: 0.24, ease: ease.emerge } }}
                      exit={{ opacity: 0, height: 0, transition: { duration: 0.14 } }}
                      className="overflow-hidden"
                    >
                      <div className="flex items-start gap-2 border-b border-destructive/20 bg-destructive/[0.06] px-4 py-3 text-sm text-destructive">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                        <div className="min-w-0">
                          <div className="font-medium">{t('renderError')}</div>
                          <div className="break-words font-mono text-xs" dir="ltr">
                            {previewError}
                          </div>
                        </div>
                      </div>
                    </m.div>
                  )}
                </AnimatePresence>

                {showText ? (
                  // dir="ltr": the plain-text alternative is a foreign-language island.
                  // Inside an RTL page its own direction keeps indentation and URLs
                  // readable rather than letting the bidi algorithm reorder them.
                  <pre
                    dir="ltr"
                    className="h-[min(44rem,calc(100vh-18rem))] min-h-80 overflow-auto whitespace-pre-wrap p-4 font-mono text-xs"
                  >
                    {preview?.text ?? ''}
                  </pre>
                ) : (
                  <div className="flex min-h-80 justify-center overflow-x-auto bg-surface-sunken/60 p-4 sm:p-5">
                    <iframe
                      title={t('previewFrameTitle')}
                      // sandboxed with no allow-scripts: a template can never run
                      // code while being previewed.
                      sandbox=""
                      srcDoc={preview?.html ?? ''}
                      style={{ width: WIDTHS[width], border: 0, background: '#fff' }}
                      className="h-[min(44rem,calc(100vh-20rem))] min-h-72 max-w-full rounded-lg shadow-md ring-1 ring-border/60 transition-[width] duration-300 ease-out"
                    />
                  </div>
                )}
              </section>
            </Reveal>
          </div>
        </div>
      </div>

      {!readOnly && (
        <SaveDock
          mode="edit"
          dirty={dirty}
          saving={saving && !publishing}
          failed={saveFailed}
          onSave={() => void saveDraft()}
          onDiscard={discard}
          saveLabel={t('saveDraft')}
          savingLabel={t('saving')}
        />
      )}
    </div>
  );

  function insertToken(path: string) {
    // Captured from the render closure, so narrow it explicitly: the null check
    // in the body of the component does not narrow inside this nested function.
    const draft = layout;
    if (!draft) return;
    const token = `{{${path}}}`;
    const target = selected
      ? draft.blocks.find((b) => b.id === selected)
      : draft.blocks.find((b) => b.type === 'text' || b.type === 'heading');
    if (!target) return;
    const props = target.props as Record<string, unknown>;
    const field = target.type === 'heading' ? 'text' : 'html';
    patchBlock(target.id, { [field]: `${String(props[field] ?? '')}${token}` });
  }
}

/* ── Small pieces ────────────────────────────────────────────────────────── */

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-2xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-13 text-foreground">{children}</dd>
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: ReactNode; icon?: ReactNode; ariaLabel?: string }>;
}) {
  return (
    <div role="group" className="inline-flex items-center gap-0.5 rounded-lg bg-muted/70 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          aria-label={o.ariaLabel}
          onClick={() => onChange(o.value)}
          className={cn(
            'relative flex h-8 items-center gap-1.5 rounded-md px-3 text-13 font-medium transition-colors',
            value === o.value ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {value === o.value && (
            <m.span
              layoutId={`seg-${options.map((x) => x.value).join('-')}`}
              aria-hidden="true"
              className="absolute inset-0 rounded-md bg-card shadow-xs"
              transition={spring.smooth}
            />
          )}
          <span className="relative flex items-center gap-1.5">
            {o.icon}
            {o.label}
          </span>
        </button>
      ))}
    </div>
  );
}

function AddBlockMenu({ children, onAdd }: { children: ReactNode; onAdd: (type: EmailBlockType) => void }) {
  const t = useTranslations('admin.email');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="grid min-w-64 grid-cols-2 gap-0.5">
        {ADDABLE.map((type) => {
          const Icon = BLOCK_ICON[type];
          return (
            <DropdownMenuItem key={type} onSelect={() => onAdd(type)}>
              <Icon />
              {t(BLOCK_LABEL[type] as never)}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BlockCard({
  block,
  open,
  readOnly,
  onToggle,
  onRemove,
  onChange,
}: {
  block: EmailBlock;
  open: boolean;
  readOnly: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onChange: (props: Record<string, unknown>) => void;
}) {
  const t = useTranslations('admin.email');
  const { moveBy, index, count, dragging } = useSortableItem();
  const Icon = BLOCK_ICON[block.type];
  const summary = blockSummary(block);
  const iconBtn =
    'flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30';

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border bg-card transition-[border-color,box-shadow] duration-200',
        open ? 'border-primary/40 shadow-sm' : 'border-border/70 shadow-xs hover:border-border',
        dragging && 'shadow-lg ring-1 ring-primary/30',
      )}
    >
      <div className="flex items-center gap-1 px-1.5 py-1.5">
        {!readOnly && <DragHandle label={t('dragToReorder')} />}
        <button
          type="button"
          onClick={onToggle}
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
            <span className="block text-13 font-medium">{t(BLOCK_LABEL[block.type] as never)}</span>
            <span dir="auto" className="block truncate text-xs text-muted-foreground">{summary || t('blockEmpty')}</span>
          </span>
        </button>
        {!readOnly && (
          <div className="flex shrink-0 items-center">
            <button type="button" className={iconBtn} onClick={() => moveBy(-1)} disabled={index === 0} aria-label={t('moveUp')}>
              <ArrowUp className="size-3.5" />
            </button>
            <button
              type="button"
              className={iconBtn}
              onClick={() => moveBy(1)}
              disabled={index === count - 1}
              aria-label={t('moveDown')}
            >
              <ArrowDown className="size-3.5" />
            </button>
            <button
              type="button"
              className={cn(iconBtn, 'hover:bg-destructive/10 hover:text-destructive')}
              onClick={onRemove}
              aria-label={t('removeBlock')}
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            key="inspector"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1, transition: { duration: 0.28, ease: ease.emerge } }}
            exit={{ height: 0, opacity: 0, transition: { duration: 0.18, ease: ease.exit } }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/60 bg-surface-sunken/30 p-4">
              <BlockFields block={block} onChange={onChange} readOnly={readOnly} />
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AlignControl({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('admin.email');
  const items = [
    { v: 'left', Icon: AlignLeft, label: t('alignLeft') },
    { v: 'center', Icon: AlignCenter, label: t('alignCenter') },
    { v: 'right', Icon: AlignRight, label: t('alignRight') },
  ] as const;
  return (
    <Field label={t('labelAlign')}>
      {() => (
        <div role="group" className="inline-flex items-center gap-0.5 rounded-lg bg-muted/70 p-0.5">
          {items.map(({ v, Icon, label }) => (
            <button
              key={v}
              type="button"
              disabled={disabled}
              aria-pressed={value === v}
              aria-label={label}
              title={label}
              onClick={() => onChange(v)}
              className={cn(
                'flex h-8 w-9 items-center justify-center rounded-md transition-colors disabled:opacity-50',
                value === v ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>
      )}
    </Field>
  );
}

function BlockFields({
  block,
  onChange,
  readOnly,
}: {
  block: EmailBlock;
  onChange: (props: Record<string, unknown>) => void;
  readOnly?: boolean;
}) {
  const t = useTranslations('admin.email');
  const te = useTranslations('ui.emailTemplateEditor');
  const p = block.props as Record<string, unknown>;
  const align = () => (
    <AlignControl value={String(p.align ?? 'left')} onChange={(x) => onChange({ align: x })} disabled={readOnly} />
  );
  const cols = (): Array<{ key: string; label: string }> =>
    (p.columns as Array<{ key: string; label: string }>) ?? [];

  // https:// is the only scheme the renderer keeps; merge tags are expanded per send.
  const insecureUrl = (value: string) =>
    value.length > 0 && !/^https:\/\//i.test(value) && !value.includes('{{');

  return (
    <div className="space-y-4">
      {block.type === 'heading' && (
        <>
          <TextField
            label={t('labelText')}
            value={String(p.text ?? '')}
            disabled={readOnly}
            onChange={(e) => onChange({ text: e.target.value })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label={t('labelLevel')}
              value={String(p.level ?? 2)}
              disabled={readOnly}
              onChange={(e) => onChange({ level: Number(e.target.value) })}
            >
              {[1, 2, 3].map((l) => (
                <option key={l} value={String(l)}>
                  H{l}
                </option>
              ))}
            </SelectField>
            {align()}
          </div>
        </>
      )}

      {block.type === 'text' && (
        <>
          {typeof p.label === 'string' && p.label.length > 0 && (
            <TextField
              label={t('labelText')}
              value={String(p.label ?? '')}
              disabled={readOnly}
              onChange={(e) => onChange({ label: e.target.value })}
            />
          )}
          <Field label={t('labelHtml')} hint={te('allowedHtmlHint')}>
            {(a) => (
              <TextArea
                {...a}
                dir="ltr"
                rows={5}
                value={String(p.html ?? '')}
                disabled={readOnly}
                onChange={(e) => onChange({ html: e.target.value })}
                className="font-mono text-xs"
              />
            )}
          </Field>
          {align()}
        </>
      )}

      {block.type === 'button' && (
        <>
          <TextField
            label={t('labelText')}
            value={String(p.label ?? '')}
            disabled={readOnly}
            onChange={(e) => onChange({ label: e.target.value })}
          />
          <TextField
            label={t('labelUrl')}
            dir="ltr"
            hint={te('httpsOnlyHint')}
            error={insecureUrl(String(p.url ?? '')) ? te('httpsOnlyHint') : undefined}
            value={String(p.url ?? '')}
            disabled={readOnly}
            onChange={(e) => onChange({ url: e.target.value })}
            className="font-mono text-xs"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label={t('labelVariant')}
              value={String(p.variant ?? 'primary')}
              disabled={readOnly}
              onChange={(e) => onChange({ variant: e.target.value })}
            >
              {(['primary', 'secondary', 'link'] as const).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </SelectField>
            {align()}
          </div>
        </>
      )}

      {block.type === 'image' && (
        <>
          <TextField
            label={t('labelUrl')}
            dir="ltr"
            error={insecureUrl(String(p.url ?? '')) ? te('httpsOnlyHint') : undefined}
            value={String(p.url ?? '')}
            disabled={readOnly}
            onChange={(e) => onChange({ url: e.target.value })}
            className="font-mono text-xs"
          />
          <TextField
            label={t('labelAlt')}
            hint={te('imageAltHint')}
            value={String(p.alt ?? '')}
            disabled={readOnly}
            onChange={(e) => onChange({ alt: e.target.value })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={t('labelWidth')}
              type="number"
              value={Number(p.width ?? 600)}
              disabled={readOnly}
              onChange={(e) => onChange({ width: Number(e.target.value) })}
            />
            <TextField
              label={t('labelHeight')}
              type="number"
              value={Number(p.height ?? 150)}
              disabled={readOnly}
              onChange={(e) => onChange({ height: Number(e.target.value) })}
            />
          </div>
          {align()}
        </>
      )}

      {block.type === 'spacer' && (
        <TextField
          label={t('labelHeightPx')}
          type="number"
          value={Number(p.height ?? 16)}
          disabled={readOnly}
          onChange={(e) => onChange({ height: Number(e.target.value) })}
        />
      )}

      {block.type === 'divider' && (
        <ColorField
          label={t('labelColor')}
          value={String(p.color ?? '#dfe4ea')}
          onChange={(color) => onChange({ color })}
          presets={['#DFE4EA', '#B65433', '#141413', '#7A5C3E']}
        />
      )}

      {block.type === 'data-table' && (
        <>
          <TextField
            label={t('labelSource')}
            hint={te('payloadPathHint')}
            dir="ltr"
            value={String(p.source ?? '')}
            disabled={readOnly}
            onChange={(e) => onChange({ source: e.target.value })}
            className="font-mono text-xs"
            placeholder="order.items"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label={t('labelMode')}
              value={String(p.mode ?? 'columns')}
              disabled={readOnly}
              onChange={(e) => onChange({ mode: e.target.value })}
            >
              <option value="columns">columns</option>
              <option value="keyvalue">key / value</option>
            </SelectField>
            {align()}
          </div>
          <Field label={t('labelColumns')}>
            {() => (
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {cols().map((c, i) => (
                    <m.div
                      key={i}
                      layout="position"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                      className="flex items-center gap-1.5"
                    >
                      <TextInput
                        value={c.key}
                        dir="ltr"
                        placeholder={t('columnKey')}
                        aria-label={t('columnKey')}
                        className="font-mono text-xs"
                        disabled={readOnly}
                        onChange={(e) => {
                          const next = [...cols()];
                          next[i] = { ...next[i]!, key: e.target.value };
                          onChange({ columns: next });
                        }}
                      />
                      <TextInput
                        value={c.label}
                        placeholder={t('columnLabel')}
                        aria-label={t('columnLabel')}
                        className="text-xs"
                        disabled={readOnly}
                        onChange={(e) => {
                          const next = [...cols()];
                          next[i] = { ...next[i]!, label: e.target.value };
                          onChange({ columns: next });
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => onChange({ columns: cols().filter((_, x) => x !== i) })}
                        disabled={readOnly}
                        aria-label={t('removeBlock')}
                        className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </m.div>
                  ))}
                </AnimatePresence>
                <button
                  type="button"
                  onClick={() => onChange({ columns: [...cols(), { key: '', label: '' }] })}
                  disabled={readOnly}
                  className="pressable inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-border-strong px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-50"
                >
                  <Plus className="size-3.5" />
                  {t('addColumn')}
                </button>
              </div>
            )}
          </Field>
        </>
      )}

      {block.type === 'columns' && (
        <TextField
          label={t('labelColumns')}
          hint={te('twoUpColumnsHint')}
          dir="ltr"
          placeholder={te('widthsPlaceholder')}
          className="font-mono text-xs"
          value={((p.columns as Array<{ width: number }>) ?? []).map((c) => c.width).join(', ')}
          disabled={readOnly}
          onChange={(e) => {
            const widths = e.target.value
              .split(',')
              .map((x) => Number(x.trim()))
              .filter((n) => Number.isFinite(n) && n > 0);
            if (widths.length < 2) return;
            const prev = (p.columns as Array<{ width: number; blocks: EmailBlock[] }>) ?? [];
            onChange({
              columns: widths.map((w, i) => ({
                width: w,
                blocks: prev[i]?.blocks ?? [defaultBlock('text') as EmailBlock],
              })),
            });
          }}
        />
      )}

      {block.type === 'footer' && (
        <>
          <TextField
            label={t('footerText')}
            value={String(p.text ?? '')}
            disabled={readOnly}
            onChange={(e) => onChange({ text: e.target.value })}
          />
          <SwitchField
            label={t('showUnsubscribe')}
            description={te('unsubscribeHint')}
            checked={Boolean(p.showUnsubscribe)}
            disabled={readOnly}
            onCheckedChange={(v) => onChange({ showUnsubscribe: v })}
          />
        </>
      )}
    </div>
  );
}
