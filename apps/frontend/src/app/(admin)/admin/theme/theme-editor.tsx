'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { FONT_KEYS, FONT_LABELS, resolveFontKey } from '@titan/shared';
import type { ColorSet, FontKey, ThemeTokens } from '@titan/shared';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Eye,
  Moon,
  Palette,
  RotateCcw,
  Rocket,
  ShieldCheck,
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
  Field,
  FieldGrid,
  FormSection,
  FormSkeleton,
  TextInput,
} from '@/components/admin/admin-form';
import {
  ColorField,
  FormLayout,
  SaveDock,
  SectionNav,
  StatusChip,
} from '@/components/admin/form-page';
import { PillTabs, SegmentedIconToggle } from '@/components/admin/admin-ui';
import { Reveal } from '@/components/ui/motion';
import { toast } from '@/components/ui/toast';
import { apiProxyFetch } from '@/hooks/use-api-proxy';
import { ease, spring } from '@/lib/motion';

const COLOR_GROUPS: { titleKey: string; keys: (keyof ColorSet)[] }[] = [
  { titleKey: 'brand', keys: ['primary', 'secondary', 'accent'] },
  { titleKey: 'surfaces', keys: ['background', 'card', 'muted'] },
  { titleKey: 'text', keys: ['foreground', 'cardForeground', 'mutedForeground'] },
  { titleKey: 'bordersAccents', keys: ['border', 'ring'] },
];

const COLOR_LABEL_KEY: Record<keyof ColorSet, string> = {
  background: 'tokBackground',
  foreground: 'tokForeground',
  card: 'tokCard',
  cardForeground: 'tokCardForeground',
  muted: 'tokMuted',
  mutedForeground: 'tokMutedForeground',
  border: 'tokBorder',
  primary: 'tokPrimary',
  secondary: 'tokSecondary',
  accent: 'tokAccent',
  ring: 'tokRing',
};

/** Quiet sentence-case label used throughout the editor. */
const LABEL_CLASS = 'block text-xs font-medium text-muted-foreground';

/** Short tag shown under each font so admins know what they're picking. */
const FONT_KIND_KEY: Record<FontKey, string> = {
  inter: 'kindSans',
  'space-grotesk': 'kindGrotesk',
  'jetbrains-mono': 'kindMono',
  'source-serif': 'kindSerif',
};

/**
 * A visual font picker: every font renders its own name and specimen, so the
 * choice is made by looking rather than by reading a dropdown.
 */
function FontPicker({
  field,
  label,
  value,
  onChange,
}: {
  field: 'sans' | 'display';
  label: string;
  value: FontKey;
  onChange: (key: FontKey) => void;
}) {
  const t = useTranslations('theme');
  const active = resolveFontKey(value);
  return (
    <div>
      <p id={`font-${field}-label`} className={cn(LABEL_CLASS, 'mb-2')}>
        {label}
      </p>
      <div
        role="radiogroup"
        aria-labelledby={`font-${field}-label`}
        className="grid grid-cols-2 gap-2"
        dir="ltr"
      >
        {FONT_KEYS.map((key) => {
          const selected = active === key;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(key)}
              className={cn(
                'relative flex min-w-0 flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-start transition-[border-color,box-shadow,background-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]',
                selected
                  ? 'border-primary/40 bg-primary/[0.04] shadow-xs'
                  : 'border-border/70 bg-card hover:border-border-strong hover:shadow-sm',
              )}
            >
              {selected && (
                <m.span
                  layoutId={`font-check-${field}`}
                  transition={spring.smooth}
                  className="absolute end-2 top-2 grid size-4 place-items-center rounded-full bg-primary text-primary-foreground"
                  aria-hidden="true"
                >
                  <Check className="size-2.5" strokeWidth={3} />
                </m.span>
              )}
              <span
                className="text-xl leading-none text-foreground"
                style={{ fontFamily: FONT_CSS_VARS[key] }}
                aria-hidden="true"
              >
                Ag
              </span>
              <span className="w-full truncate text-xs font-medium text-foreground">
                {FONT_LABELS[key]}
              </span>
              <span className="text-2xs text-muted-foreground">{t(FONT_KIND_KEY[key] as 'kindSans')}</span>
            </button>
          );
        })}
      </div>
      <p
        dir="ltr"
        className="mt-2.5 truncate text-start text-sm text-muted-foreground"
        style={{ fontFamily: FONT_CSS_VARS[active] }}
      >
        Ag · The quick fox
      </p>
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
/** A field label with its unit set apart (units are LTR tokens). */
function Unit({ label, unit }: { label: string; unit: string }) {
  return (
    <>
      {label}{' '}
      <span dir="ltr" className="font-normal text-muted-foreground">
        {unit}
      </span>
    </>
  );
}

/** WCAG AA threshold for normal-size text. */
const AA = 4.5;

/** Pass / fail chip for one text-on-background pair. */
function ContrastChip({ ratio }: { ratio: number | null }) {
  const t = useTranslations('theme');
  if (ratio === null) return <StatusChip tone="archived">—</StatusChip>;
  const pass = ratio >= AA;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-2xs font-medium transition-colors duration-300',
        pass ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive',
      )}
    >
      {pass ? <Check className="size-3" strokeWidth={3} /> : <AlertTriangle className="size-3" />}
      <span className="font-mono tabular-nums" dir="ltr">
        {ratio.toFixed(1)}:1
      </span>
      {pass ? t('aaPass') : t('aaFail')}
    </span>
  );
}

/** Which other token each text token is measured against. */
const CONTRAST_AGAINST: Partial<Record<keyof ColorSet, keyof ColorSet>> = {
  foreground: 'background',
  cardForeground: 'card',
  mutedForeground: 'background',
};

/**
 * One colour token: the kit's `ColorField` (swatch + picker + validated hex),
 * with the WCAG verdict for text tokens shown in the hint so a bad pair is
 * visible at the control that causes it.
 */
function TokenField({
  token,
  colors,
  onChange,
}: {
  token: keyof ColorSet;
  colors: ColorSet;
  onChange: (v: string) => void;
}) {
  const t = useTranslations('theme');
  const against = CONTRAST_AGAINST[token];
  const hint = against ? (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <ContrastChip ratio={contrast(colors[token], colors[against])} />
      <span>{t('contrastOnToken', { token: t(COLOR_LABEL_KEY[against] as 'tokBackground') })}</span>
    </span>
  ) : token === 'primary' ? (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <ContrastChip ratio={contrast(colors.primary, contrastForeground(colors.primary))} />
      <span>{t('contrastPrimary')}</span>
    </span>
  ) : undefined;
  return (
    <ColorField
      label={t(COLOR_LABEL_KEY[token] as 'tokBackground')}
      value={colors[token]}
      onChange={onChange}
      presets={[]}
      hint={hint}
    />
  );
}

/**
 * A theme can be perfectly valid as data and completely unreadable in practice:
 * a foreground close to its background, or a primary that swallows white text.
 * These are the pairs the storefront actually relies on.
 */
function ContrastReport({ colors }: { colors: ColorSet }) {
  const t = useTranslations('theme');
  const checks = [
    { key: 'body', label: t('contrastBody'), ratio: contrast(colors.foreground, colors.background) },
    { key: 'card', label: t('contrastCard'), ratio: contrast(colors.cardForeground, colors.card) },
    {
      // The storefront paints `var(--primary-foreground)` on the primary colour,
      // and that token is derived by `contrastForeground`, which already picks
      // dark or light text for readability. The real resolved colour is measured.
      key: 'primary',
      label: t('contrastPrimary'),
      ratio: contrast(colors.primary, contrastForeground(colors.primary)),
    },
    {
      key: 'muted',
      label: t('contrastMuted'),
      ratio: contrast(colors.mutedForeground, colors.background),
    },
  ];

  const failing = checks.filter((c) => c.ratio !== null && c.ratio < AA);
  const unknown = checks.filter((c) => c.ratio === null);

  return (
    <FormSection
      id="contrast"
      title={t('contrast')}
      icon={ShieldCheck}
      description={t('contrastDesc')}
      badge={
        failing.length === 0 && unknown.length === 0 ? (
          <span className="text-success">{t('aaPass')}</span>
        ) : undefined
      }
    >
      <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/70">
        {checks.map((c) => (
          <li key={c.key} className="flex items-center justify-between gap-3 bg-card px-3.5 py-2.5">
            <span className="min-w-0 truncate text-xs text-foreground">{c.label}</span>
            <ContrastChip ratio={c.ratio} />
          </li>
        ))}
      </ul>
      <AnimatePresence initial={false}>
        {failing.length > 0 && (
          <m.p key="warn" {...noteMotion} className="overflow-hidden text-xs leading-relaxed text-warning">
            <span className="block pt-3">{t('contrastWarn', { count: failing.length })}</span>
          </m.p>
        )}
        {unknown.length > 0 && (
          <m.p key="unknown" {...noteMotion} className="overflow-hidden text-xs text-muted-foreground">
            <span className="block pt-2">{t('contrastUnknown')}</span>
          </m.p>
        )}
      </AnimatePresence>
    </FormSection>
  );
}

const noteMotion = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 'auto', transition: { duration: 0.24, ease: ease.emerge } },
  exit: { opacity: 0, height: 0, transition: { duration: 0.16, ease: ease.exit } },
} as const;

/** The live storefront preview, shared by the rail (xl) and the stacked layout. */
function PreviewPanel({
  previewVars,
  previewMode,
  setPreviewMode,
  tokens,
}: {
  previewVars: React.CSSProperties;
  previewMode: 'light' | 'dark';
  setPreviewMode: (k: 'light' | 'dark') => void;
  tokens: ThemeTokens;
}) {
  const t = useTranslations('theme');
  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-medium tracking-[-0.015em] text-foreground">
            <Eye className="size-4 text-primary" />
            {t('preview')}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{t('previewHint')}</p>
        </div>
        <SegmentedIconToggle
          label={t('previewMode')}
          value={previewMode}
          onChange={(k: 'light' | 'dark') => setPreviewMode(k)}
          options={[
            { key: 'light', icon: Sun, label: t('lightPalette') },
            { key: 'dark', icon: Moon, label: t('darkPalette') },
          ]}
        />
      </div>

      {/* The preview root re-declares every `--c-*` channel, so Tailwind token
          utilities inside it (bg-card, text-primary, border-border…) resolve to
          the draft palette rather than the admin's own. */}
      <div className="bg-muted/40 p-4 sm:p-6" style={previewVars}>
        <ThemePreview />
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border/70 px-5 py-3 text-xs text-muted-foreground">
        <span>
          {previewMode === 'light' ? t('lightPalette') : t('darkPalette')}
        </span>
        <span dir="ltr" className="truncate">
          {FONT_LABELS[resolveFontKey(tokens.fonts.display)]} / {FONT_LABELS[resolveFontKey(tokens.fonts.sans)]}
        </span>
      </div>
    </div>
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
  const [failed, setFailed] = useState(false);
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
  const colorsInvalid = useMemo(() => {
    const hex = /^#[0-9a-fA-F]{6}$/;
    return [current.light, current.dark].some((set) => Object.values(set).some((v) => !hex.test(v)));
  }, [current]);

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

  const discard = () => {
    if (!persisted) return;
    setDraft(persisted);
    previewTokens(persisted);
  };

  const saveDraft = async (): Promise<boolean> => {
    setSaving(true);
    setFailed(false);
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
      setFailed(true);
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

  const preview = (
    <PreviewPanel
      previewVars={previewVars}
      previewMode={previewMode}
      setPreviewMode={setPreviewMode}
      tokens={current}
    />
  );

  return (
    <div className="w-full">
      <AdminCommandBar
        trail={[{ label: t('title') }]}
        // The status lives in the page header as a chip; the bar carries commands only.
        live={false}
        actions={
          <>
            <a
              href="/"
              target="_blank"
              rel="noreferrer noopener"
              title={t('viewCustomerSite')}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/70 bg-card px-3 text-13 font-medium text-foreground shadow-xs transition hover:border-border-strong hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
            >
              <Eye className="size-4 text-muted-foreground" />
              <span className="hidden sm:inline">{t('viewCustomer')}</span>
            </a>
            <BarButton icon={<RotateCcw className="size-4" />} disabled={saving} onClick={() => void onReset()}>
              {t('reset')}
            </BarButton>
          </>
        }
        primary={
          <BarPrimaryButton
            icon={<Rocket className="size-4" strokeWidth={2.5} />}
            disabled={saving}
            onClick={() => void onPublish()}
          >
            {t('publish')}
          </BarPrimaryButton>
        }
      />

      <div className="space-y-6 pt-6">
        <div className="mx-auto w-full max-w-[1600px]">
          <AdminPageHeader
            title={t('title')}
            description={t('subtitle')}
            badge={
              status === 'published' ? (
                <StatusChip tone="live">{t('publishedBadge')}</StatusChip>
              ) : (
                <StatusChip tone="draft">{t('draftBadge')}</StatusChip>
              )
            }
          />
        </div>

        <FormLayout
          className="max-w-[1600px] xl:grid-cols-[minmax(0,34rem)_minmax(0,1fr)]"
          aside={
            <div className="flex flex-col gap-4 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto xl:overscroll-contain">
              <SectionNav
                className="max-w-[17rem]"
                items={[
                  { id: 'typography', label: t('typography'), icon: Type },
                  { id: 'shape', label: t('shape'), icon: Sliders },
                  { id: 'colors', label: t('colors'), icon: Palette, invalid: colorsInvalid },
                  { id: 'contrast', label: t('contrast'), icon: ShieldCheck },
                ]}
              />
              {preview}
            </div>
          }
        >
          <Reveal>
            <FormSection
              id="typography"
              title={t('typography')}
              icon={Type}
              description={t('typographyDesc')}
            >
              <div className="grid gap-6 sm:grid-cols-2">
                {(
                  [
                    ['sans', t('bodyFont')],
                    ['display', t('displayFont')],
                  ] as const
                ).map(([field, label]) => (
                  <FontPicker
                    key={field}
                    field={field}
                    label={label}
                    value={current.fonts[field]}
                    onChange={(key) =>
                      patch((tk) => ({
                        ...tk,
                        fonts: { ...tk.fonts, [field]: key },
                      }))
                    }
                  />
                ))}
              </div>
            </FormSection>
          </Reveal>

          <Reveal delay={0.04}>
            <FormSection id="shape" title={t('shape')} icon={Sliders} description={t('shapeDesc')}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-3 rounded-xl border border-border/70 bg-muted/30 p-3">
                  <Field label={<Unit label={t('radius')} unit="px" />}>
                    {(a) => (
                      <TextInput
                        {...a}
                        type="number"
                        min={0}
                        max={32}
                        dir="ltr"
                        value={String(current.radius)}
                        onChange={(e) => patch((tk) => ({ ...tk, radius: Number(e.target.value) }))}
                        className="text-center font-mono"
                      />
                    )}
                  </Field>
                  <div className="flex justify-center">
                    <m.div
                      className="size-11 border-2 border-primary/30 bg-primary/10"
                      animate={{ borderRadius: current.radius }}
                      transition={spring.smooth}
                    />
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-border/70 bg-muted/30 p-3">
                  <Field label={<Unit label={t('blur')} unit="px" />}>
                    {(a) => (
                      <TextInput
                        {...a}
                        type="number"
                        min={0}
                        // Matches `themeTokensSchema` (`glass.blur: max(30)`).
                        max={30}
                        dir="ltr"
                        value={String(current.glass.blur)}
                        onChange={(e) =>
                          patch((tk) => ({
                            ...tk,
                            glass: { ...tk.glass, blur: Number(e.target.value) },
                          }))
                        }
                        className="text-center font-mono"
                      />
                    )}
                  </Field>
                  <div className="flex justify-center">
                    <div
                      className="size-11 rounded-lg border border-border/70 bg-primary/10"
                      style={{ backdropFilter: `blur(${current.glass.blur}px)` }}
                    />
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-border/70 bg-muted/30 p-3">
                  <Field label={<Unit label={t('opacity')} unit="%" />}>
                    {(a) => (
                      <TextInput
                        {...a}
                        type="number"
                        min={0}
                        max={100}
                        dir="ltr"
                        value={String(current.glass.opacity)}
                        onChange={(e) =>
                          patch((tk) => ({
                            ...tk,
                            glass: { ...tk.glass, opacity: Number(e.target.value) },
                          }))
                        }
                        className="text-center font-mono"
                      />
                    )}
                  </Field>
                  <div className="flex items-center gap-1.5 pt-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <m.div
                        className="h-1.5 rounded-full bg-primary"
                        initial={false}
                        animate={{ width: `${Math.min(100, Math.max(0, current.glass.opacity))}%` }}
                        transition={spring.smooth}
                      />
                    </div>
                    <span className="font-mono text-2xs tabular-nums text-muted-foreground" dir="ltr">
                      {current.glass.opacity}%
                    </span>
                  </div>
                </div>
              </div>
            </FormSection>
          </Reveal>

          <Reveal delay={0.08}>
            <FormSection
              id="colors"
              title={t('colors')}
              icon={Palette}
              description={t('colorsDesc')}
              actions={
                <PillTabs
                  value={colorMode}
                  onChange={(k: 'light' | 'dark') => setColorMode(k)}
                  options={[
                    { key: 'light', label: t('lightPalette') },
                    { key: 'dark', label: t('darkPalette') },
                  ]}
                />
              }
            >
              <AnimatePresence mode="wait" initial={false}>
                <m.div
                  key={colorMode}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.24, ease: ease.emerge } }}
                  exit={{ opacity: 0, y: -4, transition: { duration: 0.14, ease: ease.exit } }}
                  className="space-y-6"
                >
                  {COLOR_GROUPS.map((group) => (
                    <div key={group.titleKey}>
                      <p className="mb-3 flex items-center gap-3 text-xs font-medium text-muted-foreground">
                        {t(group.titleKey as 'brand')}
                        <span className="h-px flex-1 bg-border/70" aria-hidden="true" />
                      </p>
                      <FieldGrid cols={2}>
                        {group.keys.map((key) => (
                          <TokenField
                            key={`${colorMode}-${key}`}
                            token={key}
                            colors={activeColors}
                            onChange={(v) =>
                              patch((tk) => ({
                                ...tk,
                                [colorMode]: { ...tk[colorMode], [key]: v },
                              }))
                            }
                          />
                        ))}
                      </FieldGrid>
                    </div>
                  ))}
                </m.div>
              </AnimatePresence>
            </FormSection>
          </Reveal>

          <Reveal delay={0.12}>
            <ContrastReport colors={activeColors} />
          </Reveal>

          {/* Below xl the rail is hidden, so the preview follows the controls. */}
          <div className="xl:hidden">{preview}</div>
        </FormLayout>
      </div>

      <SaveDock
        mode="edit"
        dirty={dirty}
        saving={saving}
        failed={failed}
        onSave={() => void saveDraft()}
        onDiscard={discard}
        saveLabel={t('saveDraftBtn')}
      />
    </div>
  );
}

/**
 * A miniature storefront in the Ivory & Clay idiom: paper background, serif
 * headline, clay used only for the single CTA and small accents, hairline
 * cards with soft shadows. Every colour comes from the draft palette.
 */
function ThemePreview() {
  return (
    <div
      dir="ltr"
      className="overflow-hidden rounded-xl border border-border bg-background text-foreground shadow-sm transition-colors duration-300"
      style={{ fontFamily: 'var(--font-family-sans)' }}
    >
      {/* Navigation */}
      <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-full bg-primary font-display text-sm font-medium text-primary-foreground">
            T
          </span>
          <span className="font-display text-base font-medium tracking-[-0.015em] text-foreground">
            TITANS
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs">
          {['Academy', 'Products'].map((item, i) => (
            <span
              key={item}
              className={cn(
                'relative rounded-full px-2.5 py-1',
                i === 0 ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground',
              )}
            >
              {item}
            </span>
          ))}
          <span className="ms-1 rounded-full bg-primary px-3 py-1 font-medium text-primary-foreground shadow-xs">
            Enroll
          </span>
        </div>
      </div>

      {/* Hero */}
      <div className="relative px-6 pb-8 pt-10">
        <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
          Design · Build · Manufacture
        </p>
        <h3 className="mt-3 text-balance font-display text-3xl font-medium leading-[1.1] tracking-[-0.022em] text-foreground sm:text-[2.25rem]">
          Engineering precision
          <br />
          at every layer
        </h3>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          Tokens drive every surface — switch light or dark, or tweak the primary color.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-xs">
            Primary action
            <ArrowRight className="size-3.5" />
          </span>
          <span className="inline-flex items-center rounded-lg border border-border bg-card px-4 py-2 text-xs font-medium text-foreground shadow-xs">
            Secondary
          </span>
        </div>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-3 gap-3 px-6">
        {['Precision', 'Speed', 'Support'].map((f, i) => (
          <m.div
            key={f}
            whileHover={{ y: -3 }}
            transition={spring.smooth}
            className="rounded-xl border border-border/70 bg-card p-4 text-card-foreground shadow-xs transition-shadow hover:shadow-lg"
          >
            <div
              className={cn(
                'mb-3 grid size-8 place-items-center rounded-lg',
                i === 1 ? 'bg-accent/10 text-accent' : 'bg-primary/10 text-primary',
              )}
            >
              <Palette className="size-4" />
            </div>
            <p className="font-display text-base font-medium tracking-[-0.015em]">{f}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Consistent, themeable surfaces.
            </p>
          </m.div>
        ))}
      </div>

      {/* Muted well + card */}
      <div className="grid grid-cols-2 gap-3 p-6">
        <div className="rounded-xl bg-muted p-4">
          <p className="text-xs font-medium text-muted-foreground">Muted</p>
          <p className="mt-1 font-display text-base font-medium text-foreground">Soft surfaces</p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-border">
            <div className="h-full w-3/5 rounded-full bg-primary" />
          </div>
        </div>
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">Card</p>
          <p className="mt-1 flex items-center gap-1.5 font-display text-base font-medium text-foreground">
            <span className="size-2 rounded-full bg-accent" />
            Accent dot
          </p>
        </div>
      </div>
    </div>
  );
}
