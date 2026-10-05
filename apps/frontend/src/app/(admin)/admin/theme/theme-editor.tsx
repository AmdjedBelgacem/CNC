'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { FONT_KEYS, FONT_LABELS, resolveFontKey } from '@titan/shared';
import type { ColorSet, FontKey, ThemeTokens } from '@titan/shared';
import {
  Check,
  Copy,
  Save,
  Eye,
  Moon,
  Palette,
  RotateCcw,
  Rocket,
  Sliders,
  Sun,
  Type,
} from 'lucide-react';
import { useTheme } from '@/components/providers/theme-provider';
import { themeTokensToInlineVars, FONT_CSS_VARS, contrastForeground } from '@/lib/builder/theme-css';
import {
  AdminCommandBar,
  AdminPageHeader,
  BarButton,
  BarPrimaryButton,
} from '@/components/admin/admin-chrome';
import {
  FormSection,
  FormSkeleton,
  TextInput,
  SelectInput,
} from '@/components/admin/admin-form';
import { PillTabs, SegmentedIconToggle, StatusPill } from '@/components/admin/admin-ui';
import { toast } from '@/components/ui/toast';
import { apiProxyFetch } from '@/hooks/use-api-proxy';

const COLOR_GROUPS: { titleKey: string; keys: (keyof ColorSet)[] }[] = [
  { titleKey: 'brand', keys: ['primary', 'secondary', 'accent'] },
  { titleKey: 'surfaces', keys: ['background', 'card', 'muted'] },
  { titleKey: 'text', keys: ['foreground', 'cardForeground', 'mutedForeground'] },
  { titleKey: 'bordersAccents', keys: ['border', 'ring'] },
];

const COLOR_LABELS: Record<keyof ColorSet, string> = {
  background: 'Background',
  foreground: 'Foreground',
  card: 'Card',
  cardForeground: 'Card FG',
  muted: 'Muted',
  mutedForeground: 'Muted FG',
  border: 'Border',
  primary: 'Primary',
  secondary: 'Secondary',
  accent: 'Accent',
  ring: 'Ring',
};

/** One colour token: a picker, an editable hex field and a copy affordance. */
function ColorSwatch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const valid = /^#[0-9a-fA-F]{6}$/.test(value);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 transition hover:border-border-strong">
      <label className="relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-border shadow-xs">
        <span className="absolute inset-0" style={{ backgroundColor: valid ? value : '#888' }} />
        <input
          type="color"
          value={valid ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
          aria-label={`${label} colour picker`}
        />
      </label>

      <div className="min-w-0 flex-1">
        <label
          htmlFor={`token-${label}`}
          className="block truncate text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {label}
        </label>
        {/* Hex codes are LTR-only tokens: without an explicit direction the bidi
            algorithm reorders their neutrals and "#C2410C" paints as "#C2410C#". */}
        <TextInput
          id={`token-${label}`}
          dir="ltr"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          invalid={!valid}
          className="mt-0.5 h-7 border-0 bg-transparent p-0 font-mono text-xs shadow-none focus:ring-0"
        />
      </div>

      <button
        type="button"
        onClick={copy}
        className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        title={`Copy ${label}`}
        aria-label={`Copy ${label} hex value`}
      >
        {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Contrast checks                                                     */
/* ------------------------------------------------------------------ */

function channelLuminance(hex: string): number | null {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
  const n = parseInt(hex.slice(1), 16);
  const ch = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * ch((n >> 16) & 255) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255)
  );
}

function contrast(a: string, b: string): number | null {
  const la = channelLuminance(a);
  const lb = channelLuminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * A theme can be perfectly valid as data and completely unreadable in practice:
 * a foreground close to its background, or a primary that swallows white text.
 * These are the pairs the storefront actually relies on.
 */
function ContrastReport({ colors }: { colors: ColorSet }) {
  const t = useTranslations('theme');
  const checks = [
    {
      key: 'body',
      label: t('contrastBody', { default: 'Body text on background' }),
      ratio: contrast(colors.foreground, colors.background),
    },
    {
      key: 'card',
      label: t('contrastCard', { default: 'Card text on card' }),
      ratio: contrast(colors.cardForeground, colors.card),
    },
    {
      // The storefront paints `var(--primary-foreground)` on the primary colour,
      // and that token is derived by `contrastForeground`, which already picks
      // dark or light text for readability. Comparing primary against
      // cardForeground instead reported a failure for a pair the product never
      // renders, so the real resolved colour is measured here.
      key: 'primary',
      label: t('contrastPrimary', { default: 'Label on primary' }),
      ratio: contrast(colors.primary, contrastForeground(colors.primary)),
    },
    {
      key: 'muted',
      label: t('contrastMuted', { default: 'Muted text on background' }),
      ratio: contrast(colors.mutedForeground, colors.background),
    },
  ];

  const failing = checks.filter((c) => c.ratio !== null && c.ratio < 4.5);
  const unknown = checks.filter((c) => c.ratio === null);

  return (
    <FormSection
      title={t('contrast', { default: 'Contrast' })}
      icon={Check}
      description={t('contrastDesc', {
        default: 'WCAG ratio for the pairs the storefront depends on.',
      })}
    >
      <ul className="space-y-2">
        {checks.map((c) => {
          const passing = c.ratio !== null && c.ratio >= 4.5;
          return (
            <li
              key={c.key}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2"
            >
              <span className="min-w-0 truncate text-2xs font-semibold text-foreground">{c.label}</span>
              {c.ratio === null ? (
                <StatusPill label="—" tone="slate" dot={false} />
              ) : (
                <span
                  className={cn(
                    'shrink-0 font-mono text-2xs font-bold tabular-nums',
                    passing ? 'text-success' : 'text-destructive',
                  )}
                >
                  {c.ratio.toFixed(1)}:1 {passing ? 'AA' : 'low'}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {failing.length > 0 && (
        <p className="mt-3 text-2xs leading-relaxed text-warning">
          {t('contrastWarn', {
            count: failing.length,
            default:
              '{count, plural, one {# pair falls below} other {# pairs fall below}} the 4.5:1 AA threshold. Text may be hard to read.',
          })}
        </p>
      )}
      {unknown.length > 0 && (
        <p className="mt-2 text-2xs text-muted-foreground">
          {t('contrastUnknown', {
            default: 'Some tokens are not valid hex values yet, so they were not measured.',
          })}
        </p>
      )}
    </FormSection>
  );
}

export function ThemeEditor() {
  const t = useTranslations('theme');
  const { tokens: appliedTokens, previewTokens } = useTheme();
  const originalTokens = useRef(appliedTokens);
  const [persisted, setPersisted] = useState<ThemeTokens | null>(null);
  const [draft, setDraft] = useState<ThemeTokens | null>(null);
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [colorMode, setColorMode] = useState<'light' | 'dark'>('light');
  const [previewMode, setPreviewMode] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await apiProxyFetch('/api/proxy/builder/themes');
        if (!response.ok) throw new Error('Failed to load the tenant theme');
        const theme = (await response.json()) as {
          tokens: ThemeTokens;
          status: 'draft' | 'published';
        };
        if (cancelled) return;
        setPersisted(theme.tokens);
        setDraft(theme.tokens);
        setStatus(theme.status);
        previewTokens(theme.tokens);
      } catch (error) {
        if (!cancelled) {
          setPersisted(originalTokens.current);
          setDraft(originalTokens.current);
          toast({
            type: 'err',
            title: t('loadFailed'),
            description: error instanceof Error ? error.message : undefined,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      previewTokens(originalTokens.current);
    };
  }, [previewTokens, t]);

  const current = draft ?? persisted ?? appliedTokens;
  const activeColors = colorMode === 'light' ? current.light : current.dark;
  const dirty = useMemo(
    () => persisted !== null && JSON.stringify(current) !== JSON.stringify(persisted),
    [current, persisted],
  );

  const previewVars = useMemo(
    () => themeTokensToInlineVars(current, previewMode),
    [current, previewMode],
  );

  // Preview the exact tenant tokens across the admin UI while editing. Drafts
  // persist through the builder API; only Publish changes what customers see.
  const patch = (fn: (t: ThemeTokens) => ThemeTokens) => {
    const next = fn(current);
    setDraft(next);
    previewTokens(next);
  };

  const saveDraft = async (): Promise<boolean> => {
    setSaving(true);
    try {
      const response = await apiProxyFetch('/api/proxy/builder/themes', {
        method: 'PUT',
        body: JSON.stringify({ tokens: current }),
      });
      if (!response.ok) throw new Error('Failed to save the tenant theme');
      const theme = (await response.json()) as { tokens: ThemeTokens; status: 'draft' };
      setPersisted(theme.tokens);
      setDraft(theme.tokens);
      setStatus(theme.status);
      toast({ type: 'ok', title: t('savedOk') });
      return true;
    } catch (error) {
      toast({
        type: 'err',
        title: t('saveFailed'),
        description: error instanceof Error ? error.message : undefined,
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const onPublish = async () => {
    setSaving(true);
    try {
      const saved = await apiProxyFetch('/api/proxy/builder/themes', {
        method: 'PUT',
        body: JSON.stringify({ tokens: current }),
      });
      if (!saved.ok) throw new Error('Failed to save the tenant theme');
      const response = await apiProxyFetch('/api/proxy/builder/themes/publish', {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to publish the tenant theme');
      const theme = (await response.json()) as { tokens: ThemeTokens; status: 'published' };
      setPersisted(theme.tokens);
      setDraft(theme.tokens);
      setStatus(theme.status);
      originalTokens.current = theme.tokens;
      previewTokens(theme.tokens);
      toast({ type: 'ok', title: t('publishOk') });
    } catch (error) {
      toast({
        type: 'err',
        title: t('publishFailed'),
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const onReset = async () => {
    if (!window.confirm(t('resetConfirm'))) return;
    setSaving(true);
    try {
      const response = await apiProxyFetch('/api/proxy/builder/themes/reset', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to reset the tenant theme');
      const theme = (await response.json()) as { tokens: ThemeTokens; status: 'draft' };
      setPersisted(theme.tokens);
      setDraft(theme.tokens);
      setStatus(theme.status);
      previewTokens(theme.tokens);
      toast({ type: 'ok', title: t('resetOk') });
    } catch (error) {
      toast({
        type: 'err',
        title: t('saveFailed'),
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };
  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1500px] pt-6">
        <FormSkeleton fields={6} />
      </div>
    );
  }

  return (
    <div className="w-full">
      <AdminCommandBar
        trail={[{ label: 'Baroot CNC Solutions' }, { label: t('title') }]}
        live={status === 'published' ? t('publishedBadge', { default: 'Published' }) : t('draftBadge', { default: 'Draft' })}
        actions={
          <>
            <a
              href="/"
              target="_blank"
              rel="noreferrer noopener"
              title={t('viewCustomerSite', { default: 'View customer site' })}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-13 font-semibold text-foreground shadow-xs transition hover:bg-muted active:scale-[0.98]"
            >
              <Eye className="size-4" />
              <span className="hidden sm:inline">{t('viewCustomer', { default: 'Customer site' })}</span>
            </a>
            <BarButton icon={<RotateCcw className="size-4" />} disabled={saving} onClick={() => void onReset()}>
              {t('reset', { default: 'Reset' })}
            </BarButton>
          </>
        }
        primary={
          <>
            <BarButton
              icon={<Save className="size-4" />}
              disabled={saving || !dirty}
              onClick={() => void saveDraft()}
            >
              {t('saveDraft', { default: 'Save draft' })}
            </BarButton>
            <BarPrimaryButton
              icon={<Rocket className="size-4" strokeWidth={2.5} />}
              disabled={saving}
              onClick={() => void onPublish()}
            >
              {t('publish', { default: 'Publish' })}
            </BarPrimaryButton>
          </>
        }
      />

      <div className="mx-auto w-full max-w-[1600px] space-y-6 pt-6">
        <AdminPageHeader
          title={t('title')}
          description={t('subtitle', {
            default: 'Colors, typography and shape for the customer experience',
          })}
          badge={
            dirty ? (
              <span className="inline-flex items-center gap-2 self-start rounded-full border border-warning/40 bg-warning/10 px-3 py-1.5 text-xs font-semibold text-warning md:self-auto">
                <span className="size-1.5 rounded-full bg-warning" aria-hidden="true" />
                {t('unsavedDraft', { default: 'Unsaved draft' })}
              </span>
            ) : undefined
          }
        />

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,520px)_minmax(0,1fr)]">
          {/* ------------------------------------------------------ controls */}
          <div className="space-y-5">
            <FormSection
              title={t('typography')}
              icon={Type}
              description={t('typographyDesc', { default: 'Fonts used across the site' })}
            >
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    ['sans', t('bodyFont', { default: 'Body' })],
                    ['display', t('displayFont', { default: 'Display' })],
                  ] as const
                ).map(([field, label]) => (
                  <div key={field} className="rounded-xl border border-border bg-muted/25 p-3">
                    <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {label}
                    </label>
                    <SelectInput
                      value={current.fonts[field]}
                      dir="ltr"
                      onChange={(e) =>
                        patch((tk) => ({
                          ...tk,
                          fonts: { ...tk.fonts, [field]: e.target.value as FontKey },
                        }))
                      }
                    >
                      {FONT_KEYS.map((key) => (
                        <option key={key} value={key}>
                          {FONT_LABELS[key]}
                        </option>
                      ))}
                    </SelectInput>
                    <p
                      dir="ltr"
                      className="mt-2 truncate text-start text-2xs text-muted-foreground"
                      style={{ fontFamily: FONT_CSS_VARS[resolveFontKey(current.fonts[field])] }}
                    >
                      Ag · The quick fox
                    </p>
                  </div>
                ))}
              </div>
            </FormSection>

            <FormSection
              title={t('shape')}
              icon={Sliders}
              description={t('shapeDesc', { default: 'Corner radius and glass effect' })}
            >
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-border bg-muted/25 p-3">
                  <label
                    htmlFor="theme-radius"
                    className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {t('radius', { default: 'Radius' })}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <TextInput
                      id="theme-radius"
                      type="number"
                      min={0}
                      max={32}
                      value={String(current.radius)}
                      onChange={(e) =>
                        patch((tk) => ({ ...tk, radius: Number(e.target.value) }))
                      }
                      className="text-center font-mono text-sm"
                    />
                    <span className="text-2xs text-muted-foreground">px</span>
                  </div>
                  <div className="mt-3 flex justify-center">
                    <div
                      className="size-11 border-2 border-primary/30 bg-primary/10"
                      style={{ borderRadius: current.radius }}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-muted/25 p-3">
                  <label
                    htmlFor="theme-blur"
                    className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {t('blur', { default: 'Blur' })}
                  </label>
                  <TextInput
                    id="theme-blur"
                    type="number"
                    min={0}
                    max={64}
                    value={String(current.glass.blur)}
                    onChange={(e) =>
                      patch((tk) => ({
                        ...tk,
                        glass: { ...tk.glass, blur: Number(e.target.value) },
                      }))
                    }
                    className="text-center font-mono text-sm"
                  />
                  <div className="mt-3 flex justify-center">
                    <div
                      className="size-11 border border-border bg-primary/10"
                      style={{ backdropFilter: `blur(${current.glass.blur}px)` }}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-muted/25 p-3">
                  <label
                    htmlFor="theme-opacity"
                    className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {t('opacity', { default: 'Opacity' })}
                  </label>
                  <TextInput
                    id="theme-opacity"
                    type="number"
                    min={0}
                    max={100}
                    value={String(current.glass.opacity)}
                    onChange={(e) =>
                      patch((tk) => ({
                        ...tk,
                        glass: { ...tk.glass, opacity: Number(e.target.value) },
                      }))
                    }
                    className="text-center font-mono text-sm"
                  />
                  <div className="mt-3 flex items-center gap-1.5">
                    <div className="h-1.5 flex-1 rounded-md bg-muted">
                      <div
                        className="h-1.5 rounded-md bg-primary transition-all"
                        style={{ width: `${current.glass.opacity}%` }}
                      />
                    </div>
                    <span className="text-2xs font-medium tabular-nums text-muted-foreground">
                      {current.glass.opacity}%
                    </span>
                  </div>
                </div>
              </div>
            </FormSection>

            <FormSection
              title={t('colors')}
              icon={Palette}
              description={t('colorsDesc', { default: 'Light and dark palettes' })}
              bodyClassName="p-0"
            >
              <PillTabs
                value={colorMode}
                onChange={(k: 'light' | 'dark') => setColorMode(k)}
                options={[
                  { key: 'light', label: t('lightPalette', { default: 'Light' }) },
                  { key: 'dark', label: t('darkPalette', { default: 'Dark' }) },
                ]}
              />

              {/* Palette at a glance. The previous version packed eleven swatches
                  into one row per column, so every label was truncated to four
                  characters and read as noise. */}
              <div className="border-b border-border px-5 py-4">
                <p className="mb-3 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('palette', { default: 'Palette' })}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {(Object.keys(activeColors) as (keyof ColorSet)[]).map((key) => (
                    <div
                      key={key}
                      title={`${COLOR_LABELS[key]}: ${activeColors[key]}`}
                      className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5"
                    >
                      <span
                        className="size-5 shrink-0 rounded-md border border-border shadow-xs"
                        style={{ backgroundColor: activeColors[key] }}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-2xs font-semibold text-foreground">
                          {COLOR_LABELS[key]}
                        </span>
                        <span
                          dir="ltr"
                          className="block truncate font-mono text-2xs text-muted-foreground"
                        >
                          {activeColors[key]}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-5 p-5">
                {COLOR_GROUPS.map((group) => (
                  <div key={group.titleKey}>
                    <p className="mb-2 flex items-center gap-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <span className="h-px flex-1 bg-border" aria-hidden="true" />
                      {t(group.titleKey as 'brand')}
                      <span className="h-px flex-1 bg-border" aria-hidden="true" />
                    </p>
                    <div className="space-y-2">
                      {group.keys.map((key) => (
                        <ColorSwatch
                          key={`${colorMode}-${key}`}
                          label={COLOR_LABELS[key]}
                          value={activeColors[key]}
                          onChange={(v) =>
                            patch((tk) => ({
                              ...tk,
                              [colorMode]: { ...tk[colorMode], [key]: v },
                            }))
                          }
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </FormSection>

            <ContrastReport colors={activeColors} />
          </div>

          {/* ------------------------------------------------------- preview */}
          {/* Sticky, so a colour changed at the bottom of a long list is still
              visible while it is being changed. */}
          <div className="xl:sticky xl:top-24">
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
                <div>
                  <h2 className="flex items-center gap-2 text-13 font-semibold text-foreground">
                    <Eye className="size-4 text-primary" />
                    {t('preview', { default: 'Live preview' })}
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t('previewHint', {
                      default:
                        'Colors update instantly here. Publish to apply them for customers.',
                    })}
                  </p>
                </div>
                <SegmentedIconToggle
                  label={t('previewMode', { default: 'Preview mode' })}
                  value={previewMode}
                  onChange={(k: 'light' | 'dark') => setPreviewMode(k)}
                  options={[
                    { key: 'light', icon: Sun, label: t('lightPalette', { default: 'Light' }) },
                    { key: 'dark', icon: Moon, label: t('darkPalette', { default: 'Dark' }) },
                  ]}
                />
              </div>

              <div className="p-5" style={previewVars}>
                <div
                  className="overflow-hidden border"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                    borderRadius: 'var(--border-radius)',
                  }}
                >
                  <div
                    className="flex items-center justify-between gap-3 px-5 py-3"
                    style={{ borderBottom: '1px solid var(--border)' }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="flex size-7 items-center justify-center rounded-lg text-2xs font-bold text-white"
                        style={{ backgroundColor: 'var(--primary)' }}
                      >
                        T
                      </span>
                      <span
                        className="text-sm font-bold"
                        style={{ color: 'var(--foreground)', fontFamily: 'var(--font-display)' }}
                      >
                        TITANS
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {['Academy', 'Products', 'Enroll'].map((item, i) => (
                        <span
                          key={item}
                          className="rounded-md px-2.5 py-1 text-2xs font-semibold"
                          style={
                            i === 2
                              ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }
                              : { border: '1px solid var(--border)', color: 'var(--foreground)' }
                          }
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-5">
                    <div
                      className="px-5 py-8"
                      style={{
                        backgroundColor: 'var(--primary)',
                        borderRadius: 'var(--border-radius)',
                      }}
                    >
                      <p
                        className="text-2xs font-semibold uppercase tracking-widest"
                        style={{ color: 'var(--primary-foreground)', opacity: 0.85 }}
                      >
                        Design · Build · Manufacture
                      </p>
                      <h3
                        className="mt-2 text-2xl font-bold leading-tight"
                        style={{ color: 'var(--primary-foreground)', fontFamily: 'var(--font-display)' }}
                      >
                        Engineering precision
                        <br />
                        at every layer
                      </h3>
                      <p
                        className="mt-2 max-w-md text-sm"
                        style={{ color: 'var(--primary-foreground)', opacity: 0.9 }}
                      >
                        Tokens drive every surface — switch light or dark, or tweak
                        the primary color.
                      </p>
                      <div className="mt-4 flex gap-2">
                        <span
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                          style={{ backgroundColor: 'var(--primary-foreground)', color: 'var(--primary)' }}
                        >
                          Primary action
                        </span>
                        <span
                          className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                          style={{
                            borderColor: 'var(--primary-foreground)',
                            color: 'var(--primary-foreground)',
                          }}
                        >
                          Secondary
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-3">
                      {['Precision', 'Speed', 'Support'].map((f) => (
                        <div
                          key={f}
                          className="p-4"
                          style={{
                            backgroundColor: 'var(--card)',
                            color: 'var(--card-foreground)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--border-radius)',
                          }}
                        >
                          <div
                            className="mb-3 flex size-8 items-center justify-center rounded-lg text-white"
                            style={{ backgroundColor: 'var(--primary)' }}
                          >
                            <Palette className="size-4" />
                          </div>
                          <p className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
                            {f}
                          </p>
                          <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            Consistent, themeable surfaces.
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div
                        className="p-4"
                        style={{ backgroundColor: 'var(--muted)', borderRadius: 'var(--border-radius)' }}
                      >
                        <p
                          className="text-2xs font-semibold uppercase tracking-widest"
                          style={{ color: 'var(--muted-foreground)' }}
                        >
                          Muted
                        </p>
                        <p className="mt-1 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                          Soft surfaces
                        </p>
                        <div
                          className="mt-3 h-1.5 w-full overflow-hidden rounded-full"
                          style={{ backgroundColor: 'var(--border)' }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{ width: '60%', backgroundColor: 'var(--primary)' }}
                          />
                        </div>
                      </div>
                      <div
                        className="p-4"
                        style={{
                          backgroundColor: 'var(--card)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--border-radius)',
                        }}
                      >
                        <p
                          className="text-2xs font-semibold uppercase tracking-widest"
                          style={{ color: 'var(--muted-foreground)' }}
                        >
                          Card
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: 'var(--accent)' }}
                          />
                          Accent dot
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-border px-5 py-2.5 text-2xs text-muted-foreground">
                {t('preview')} ·{' '}
                {previewMode === 'light' ? t('lightPalette', { default: 'Light' }) : t('darkPalette', { default: 'Dark' })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
