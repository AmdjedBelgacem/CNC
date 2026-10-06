'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import type {
  EmailBlock,
  EmailBlockType,
  EmailLayout,
  EmailTemplateDetail,
} from '@titan/shared';
import { AdminPageHeader, BarButton, BarPrimaryButton } from '@/components/admin/admin-chrome';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Eye,
  Loader2,
  Plus,
  Send,
  Trash2,
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

const WIDTHS = { mobile: 375, tablet: 640, desktop: 700 } as const;
type WidthKey = keyof typeof WIDTHS;

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

export function EmailTemplateEditor({ templateId }: { templateId: string }) {
  const t = useTranslations('admin.email');

  const [template, setTemplate] = useState<EmailTemplateDetail | null>(null);
  const [layout, setLayout] = useState<EmailLayout | null>(null);
  const [subject, setSubject] = useState('');
  const [preheader, setPreheader] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [width, setWidth] = useState<WidthKey>('desktop');

  const [triggers, setTriggers] = useState<TriggerInfo[]>([]);
  const [boundTrigger, setBoundTrigger] = useState<string>('');

  const [preview, setPreview] = useState<{ html: string; text: string; subject: string } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [showText, setShowText] = useState(false);
  const [lint, setLint] = useState<LintResult | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);

  // ---- load -------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
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
          // An existing tenant binding wins over the system default so the
          // editor lints against the variables this template may actually use.
          const own = list.find((x) =>
            x.bindings.some((b) => b.templateId === templateId && b.tenantId !== null),
          );
          setBoundTrigger(own?.key ?? list.find((x) => x.bindings.some((b) => b.templateId === templateId))?.key ?? '');
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : t('loadError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [templateId, t]);

  const trigger = useMemo(() => triggers.find((x) => x.key === boundTrigger) ?? null, [triggers, boundTrigger]);

  // ---- preview + lint ----------------------------------------------------
  const refresh = useCallback(async () => {
    if (!layout) return;
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
    setDirty(true);
  }

  function patchBlock(id: string, props: Record<string, unknown>) {
    mutate((d) => {
      const b = d.blocks.find((x) => x.id === id);
      if (b) b.props = { ...b.props, ...props };
    });
  }

  function move(id: string, delta: number) {
    mutate((d) => {
      const i = d.blocks.findIndex((x) => x.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= d.blocks.length) return;
      const [item] = d.blocks.splice(i, 1);
      if (item) d.blocks.splice(j, 0, item);
    });
  }

  function removeBlock(id: string) {
    mutate((d) => {
      d.blocks = d.blocks.filter((x) => x.id !== id);
    });
    if (selected === id) setSelected(null);
  }

  // ---- actions -----------------------------------------------------------
  async function saveDraft() {
    if (!layout) return;
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/admin/email/templates/${templateId}`, {
        layout,
        subjectTemplate: subject,
        preheaderTemplate: preheader || null,
      });
      setSavedAt(Date.now());
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    setPublishing(true);
    setError(null);
    try {
      await saveDraft();
      await api.post(`/admin/email/templates/${templateId}/publish`, {
        triggerKey: boundTrigger || undefined,
      });
      setDirty(false);
      const fresh = await api.get<{ data: EmailTemplateDetail }>(`/admin/email/templates/${templateId}`);
      if (fresh?.data) setTemplate(fresh.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('saveError'));
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {t('loading')}
      </div>
    );
  }

  if (!layout || !template) {
    return <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">{error ?? t('loadError')}</div>;
  }

  const readOnly = template.isSystem;
  const activeBlock = layout.blocks.find((b) => b.id === selected) ?? null;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title={template.name}
        description={template.slug}
        badge={
          <div className="flex flex-wrap items-center gap-2">
            {saving && <span className="text-xs text-muted-foreground">{t('saving')}</span>}
            {savedAt && !dirty && !saving && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-3.5" />
                {t('saved')}
              </span>
            )}
            {!readOnly && (
              <>
                <BarButton onClick={saveDraft} disabled={saving}>
                  {t('saveDraft')}
                </BarButton>
                <BarPrimaryButton onClick={publish} disabled={publishing}>
                  {publishing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  {t('publish')}
                </BarPrimaryButton>
              </>
            )}
          </div>
        }
      />

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {readOnly && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
          {t('systemBadge')} — {t('noTrigger')}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_300px]">
        {/* ---------------------------------------------------- left rail */}
        <div className="space-y-4">
          <div className="rounded-lg border p-3">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">{t('blocks')}</Label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ADDABLE.map((type) => (
                <button
                  key={type}
                  disabled={readOnly}
                  onClick={() =>
                    mutate((d) => {
                      const b = defaultBlock(type);
                      d.blocks.push(b);
                      setSelected(b.id);
                    })
                  }
                  className="rounded-md border px-2 py-1 text-xs font-medium transition hover:bg-muted disabled:opacity-50"
                >
                  <Plus className="me-0.5 inline size-3" />
                  {t(BLOCK_LABEL[type] as never)}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border">
            <Label className="block border-b px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">
              {t('blocks')}
            </Label>
            {layout.blocks.length === 0 ? (
              <p className="px-3 py-4 text-xs text-muted-foreground">{t('emptyLayout')}</p>
            ) : (
              <ul className="max-h-80 overflow-y-auto">
                {layout.blocks.map((b, i) => (
                  <li
                    key={b.id}
                    className={cn(
                      'flex items-center gap-1 border-b px-2 py-1.5 text-xs last:border-b-0',
                      selected === b.id ? 'bg-primary/10' : 'hover:bg-muted/40',
                    )}
                  >
                    <button
                      onClick={() => setSelected(b.id)}
                      className="flex-1 truncate text-start font-medium"
                    >
                      {t(BLOCK_LABEL[b.type] as never)}
                    </button>
                    <button onClick={() => move(b.id, -1)} disabled={i === 0 || readOnly} aria-label={t('moveUp')}>
                      <ArrowUp className="size-3" />
                    </button>
                    <button
                      onClick={() => move(b.id, 1)}
                      disabled={i === layout.blocks.length - 1 || readOnly}
                      aria-label={t('moveDown')}
                    >
                      <ArrowDown className="size-3" />
                    </button>
                    <button onClick={() => removeBlock(b.id)} disabled={readOnly} aria-label={t('removeBlock')}>
                      <Trash2 className="size-3 text-destructive" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------- canvas */}
        <div className="space-y-4">
          <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="subject">{t('subject')}</Label>
              <Input
                id="subject"
                value={subject}
                disabled={readOnly}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setDirty(true);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="preheader">{t('preheader')}</Label>
              <Input
                id="preheader"
                value={preheader}
                disabled={readOnly}
                onChange={(e) => {
                  setPreheader(e.target.value);
                  setDirty(true);
                }}
              />
              <p className="text-[11px] text-muted-foreground">{t('preheaderHint')}</p>
            </div>
          </div>

          {previewError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div>
                <div className="font-medium">{t('renderError')}</div>
                <div className="font-mono text-xs">{previewError}</div>
              </div>
            </div>
          )}

          {activeBlock && <BlockFields block={activeBlock} onChange={(p) => patchBlock(activeBlock.id, p)} readOnly={readOnly} />}

          <div className="overflow-hidden rounded-lg border">
            <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
              <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Eye className="size-3.5" />
                {t('preview')}
              </span>
              <div className="flex items-center gap-1">
                {(Object.keys(WIDTHS) as WidthKey[]).map((k) => (
                  <button
                    key={k}
                    onClick={() => setWidth(k)}
                    className={cn(
                      'rounded px-2 py-0.5 text-xs',
                      width === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {t(WIDTH_LABEL[k])}
                  </button>
                ))}
                <button
                  onClick={() => setShowText((v) => !v)}
                  className="ms-1 rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
                >
                  {t('showText')}
                </button>
              </div>
            </div>
            {showText ? (
              // dir="ltr": the plain-text alternative is a foreign-language island.
              // Inside an RTL page its own direction keeps indentation and URLs
              // readable rather than letting the bidi algorithm reorder them.
              <pre dir="ltr" className="max-h-150 overflow-auto whitespace-pre-wrap p-4 font-mono text-xs">
                {preview?.text ?? ''}
              </pre>
            ) : (
              <div className="flex justify-center overflow-x-auto bg-muted/30 p-4">
                <iframe
                  title="email-preview"
                  // sandboxed with no allow-scripts: a template can never run
                  // code while being previewed.
                  sandbox=""
                  srcDoc={preview?.html ?? ''}
                  style={{ width: WIDTHS[width], height: 640, border: 0, background: '#fff' }}
                  className="max-w-full rounded shadow-sm"
                />
              </div>
            )}
          </div>
        </div>

        {/* ------------------------------------------------- right panel */}
        <div className="space-y-4">
          <div className="rounded-lg border p-3">
            <Label htmlFor="trigger" className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('bindTrigger')}
            </Label>
            <Select value={boundTrigger || 'none'} onValueChange={(v) => setBoundTrigger(v === 'none' ? '' : v)}>
              <SelectTrigger id="trigger" className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('noTrigger')}</SelectItem>
                {triggers.map((x) => (
                  <SelectItem key={x.key} value={x.key}>
                    {x.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {trigger && <p className="mt-2 text-[11px] text-muted-foreground">{trigger.description}</p>}
          </div>

          <div className="rounded-lg border">
            <Label className="block border-b px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">
              {t('variables')}
            </Label>

            {lint && lint.unknown.length > 0 && (
              <div className="border-b border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
                <div className="mb-1 font-medium">{t('unknownVariables')}</div>
                <ul className="space-y-0.5 font-mono">
                  {lint.unknown.map((u) => (
                    <li key={u}>{`{{${u}}}`}</li>
                  ))}
                </ul>
              </div>
            )}

            {!trigger && (
              <p className="px-3 py-2.5 text-xs text-muted-foreground">{t('noTrigger')}</p>
            )}

            {trigger && (
              <ul className="max-h-96 divide-y overflow-y-auto">
                {trigger.variables.map((v) => {
                  const unknown = lint?.unknown.includes(v.path) ?? false;
                  return (
                    <li key={v.path} className="px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          disabled={readOnly}
                          onClick={() => insertToken(v.path)}
                          className="truncate text-start font-mono text-xs font-medium text-primary hover:underline disabled:opacity-50"
                          title={t('insert')}
                        >
                          {`{{${v.path}}}`}
                        </button>
                        <span
                          className={cn(
                            'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
                            v.required
                              ? 'bg-destructive/15 text-destructive'
                              : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {v.required ? t('required') : t('optional')}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {v.label} · {v.type}
                        {unknown && <span className="ms-1 text-destructive">— {t('unknownVariables')}</span>}
                      </div>
                      <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground/70">
                        {t('example')}: {v.example}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {lint && lint.valid && (
              <p className="flex items-center gap-1.5 border-t px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-3.5" />
                {t('validTemplate')}
              </p>
            )}
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">{t('publishHint')}</p>
        </div>
      </div>
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
  const p = block.props as Record<string, unknown>;
  const align = () => (
    <Select value={String(p.align ?? 'left')} onValueChange={(x) => onChange({ align: x })} disabled={readOnly}>
      <SelectTrigger className="w-28">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(['left', 'center', 'right'] as const).map((a) => (
          <SelectItem key={a} value={a}>
            {a}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const label = (children: React.ReactNode) => (
    <Label className="text-xs uppercase tracking-wide text-muted-foreground">{children}</Label>
  );

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium">{t(BLOCK_LABEL[block.type] as never)}</span>
        {block.type !== 'footer' && align()}
      </div>

      <div className="space-y-3">
        {block.type === 'heading' && (
          <>
            <div className="space-y-1.5">
              {label(t('labelText'))}
              <Input value={String(p.text ?? '')} disabled={readOnly} onChange={(e) => onChange({ text: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              {label(t('type'))}
              <Select value={String(p.level ?? 2)} onValueChange={(v) => onChange({ level: Number(v) })} disabled={readOnly}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3].map((l) => (
                    <SelectItem key={l} value={String(l)}>
                      H{l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {block.type === 'text' && (
          <>
            {typeof p.label === 'string' && p.label.length > 0 && (
              <div className="space-y-1.5">
                {label(t('labelText'))}
                <Input value={String(p.label ?? '')} disabled={readOnly} onChange={(e) => onChange({ label: e.target.value })} />
              </div>
            )}
            <div className="space-y-1.5">
              {label(t('labelHtml'))}
              <textarea
                value={String(p.html ?? '')}
                disabled={readOnly}
                onChange={(e) => onChange({ html: e.target.value })}
                rows={4}
                className="w-full rounded-md border bg-background px-3 py-2 font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                &lt;b&gt; &lt;i&gt; &lt;u&gt; &lt;a&gt; &lt;span&gt; &lt;br&gt; only — anything else is stripped.
              </p>
            </div>
          </>
        )}

        {block.type === 'button' && (
          <>
            <div className="space-y-1.5">
              {label(t('labelText'))}
              <Input value={String(p.label ?? '')} disabled={readOnly} onChange={(e) => onChange({ label: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              {label(t('labelUrl'))}
              <Input value={String(p.url ?? '')} disabled={readOnly} onChange={(e) => onChange({ url: e.target.value })} className="font-mono text-xs" />
              <p className="text-[11px] text-muted-foreground">https:// only. A non-https link is dropped.</p>
            </div>
            <div className="space-y-1.5">
              {label(t('labelVariant'))}
              <Select value={String(p.variant ?? 'primary')} onValueChange={(v) => onChange({ variant: v })} disabled={readOnly}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['primary', 'secondary', 'link'] as const).map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {block.type === 'image' && (
          <>
            <div className="space-y-1.5">
              {label(t('labelUrl'))}
              <Input value={String(p.url ?? '')} disabled={readOnly} onChange={(e) => onChange({ url: e.target.value })} className="font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              {label(t('labelAlt'))}
              <Input value={String(p.alt ?? '')} disabled={readOnly} onChange={(e) => onChange({ alt: e.target.value })} />
              <p className="text-[11px] text-muted-foreground">Shown when images are blocked. Keep the logo non-essential.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                {label(t('labelWidth'))}
                <Input
                  type="number"
                  value={Number(p.width ?? 600)}
                  disabled={readOnly}
                  onChange={(e) => onChange({ width: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                {label(t('labelHeight'))}
                <Input
                  type="number"
                  value={Number(p.height ?? 150)}
                  disabled={readOnly}
                  onChange={(e) => onChange({ height: Number(e.target.value) })}
                />
              </div>
            </div>
          </>
        )}

        {block.type === 'spacer' && (
          <div className="space-y-1.5">
            {label(t('labelHeightPx'))}
            <Input
              type="number"
              value={Number(p.height ?? 16)}
              disabled={readOnly}
              onChange={(e) => onChange({ height: Number(e.target.value) })}
            />
          </div>
        )}

        {block.type === 'divider' && (
          <div className="space-y-1.5">
            {label(t('labelVariant'))}
            <Input
              value={String(p.color ?? '#dfe4ea')}
              disabled={readOnly}
              onChange={(e) => onChange({ color: e.target.value })}
              className="font-mono text-xs"
            />
          </div>
        )}

        {block.type === 'data-table' && (
          <>
            <div className="space-y-1.5">
              {label(t('labelSource'))}
              <Input
                value={String(p.source ?? '')}
                disabled={readOnly}
                onChange={(e) => onChange({ source: e.target.value })}
                className="font-mono text-xs"
                placeholder="order.items"
              />
              <p className="text-[11px] text-muted-foreground">A payload path, expanded per send.</p>
            </div>
            <div className="space-y-1.5">
              {label(t('type'))}
              <Select value={String(p.mode ?? 'columns')} onValueChange={(v) => onChange({ mode: v })} disabled={readOnly}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="columns">columns</SelectItem>
                  <SelectItem value="keyvalue">key / value</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              {label(t('labelColumns'))}
              <div className="space-y-1.5">
                {(p.columns as Array<{ key: string; label: string }> ?? []).map((c, i) => (
                  <div key={i} className="flex gap-1.5">
                    <Input
                      value={c.key}
                      placeholder="key"
                      className="font-mono text-xs"
                      disabled={readOnly}
                      onChange={(e) => {
                        const next = [...((p.columns as Array<{ key: string; label: string }>) ?? [])];
                        next[i] = { ...next[i]!, key: e.target.value };
                        onChange({ columns: next });
                      }}
                    />
                    <Input
                      value={c.label}
                      placeholder={t('labelText')}
                      className="text-xs"
                      disabled={readOnly}
                      onChange={(e) => {
                        const next = [...((p.columns as Array<{ key: string; label: string }>) ?? [])];
                        next[i] = { ...next[i]!, label: e.target.value };
                        onChange({ columns: next });
                      }}
                    />
                    <button
                      onClick={() =>
                        onChange({
                          columns: ((p.columns as Array<{ key: string; label: string }>) ?? []).filter((_, x) => x !== i),
                        })
                      }
                      disabled={readOnly}
                      aria-label={t('removeBlock')}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </button>
                  </div>
                ))}
                <BarButton
                  onClick={() =>
                    onChange({
                      columns: [...((p.columns as Array<{ key: string; label: string }>) ?? []), { key: '', label: '' }],
                    })
                  }
                  disabled={readOnly}
                >
                  <Plus className="size-3.5" /> {t('labelColumns')}
                </BarButton>
              </div>
            </div>
          </>
        )}

        {block.type === 'columns' && (
          <div className="space-y-2">
            {label(t('labelColumns'))}
            <p className="text-[11px] text-muted-foreground">
              Two-up columns render as a table and stack on narrow screens. Nest text or image blocks.
            </p>
            <Input
              placeholder="widths, comma separated"
              className="font-mono text-xs"
              value={((p.columns as Array<{ width: number }>) ?? []).map((c) => c.width).join(', ')}
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
                    blocks: prev[i]?.blocks ?? [
                      defaultBlock('text') as EmailBlock,
                    ],
                  })),
                });
              }}
              disabled={readOnly}
            />
          </div>
        )}

        {block.type === 'footer' && (
          <>
            <div className="space-y-1.5">
              {label(t('footerText'))}
              <Input value={String(p.text ?? '')} disabled={readOnly} onChange={(e) => onChange({ text: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={Boolean(p.showUnsubscribe)}
                disabled={readOnly}
                onChange={(e) => onChange({ showUnsubscribe: e.target.checked })}
              />
              {t('showUnsubscribe')}
            </label>
            <p className="text-[11px] text-muted-foreground">
              Transactional mail (receipts, certificates, resets) should not carry one.
            </p>
          </>
        )}
      </div>
    </div>
  );
}