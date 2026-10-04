'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  BarChart3,
  TriangleAlert,
  Bot,
  Check,
  Copy,
  Palette,
  RotateCcw,
  Save,
  Sparkles,
  Store,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ErrorBanner } from '@/components/admin/admin-ui';
import { useAuthStore } from '@/stores/auth-store';
import { PlatformAlertSettings } from './platform-alert-settings';
import { toast } from '@/components/ui/toast';
import {
  AdminCommandBar,
  AdminPageHeader,
  BarIconButton,
  BarPrimaryButton,
} from '@/components/admin/admin-chrome';
import {
  Field,
  FormSection,
  FormSkeleton,
  TextAreaField,
  TextField,
  TextInput,
} from '@/components/admin/admin-form';

/* Settings is grouped by concern and, for branding, needs to be *seen* rather
 * than described: the live preview renders a storefront header from the values
 * currently in the form, so a colour or font choice is judged by what it looks
 * like instead of by reading a hex value. */

interface TenantProfile {
  id: string;
  slug: string;
  name: string | null;
  description: string | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  fontFamily?: string | null;
  domain?: string | null;
  settings?: { analytics?: { gaMeasurementId?: string | null; snapchatPixelId?: string | null } } | null;
}

type FormState = {
  [K in Exclude<keyof TenantProfile, 'id' | 'slug' | 'settings'>]: string;
} & {
  gaMeasurementId: string;
  snapchatPixelId: string;
};

const EMPTY: FormState = {
  name: '',
  description: '',
  logoUrl: '',
  faviconUrl: '',
  primaryColor: '#C2410C',
  secondaryColor: '#333F4C',
  accentColor: '#0F766E',
  fontFamily: '',
  domain: '',
  gaMeasurementId: '',
  snapchatPixelId: '',
};

const FONT_SUGGESTIONS = [
  'Inter',
  'Geist',
  'Roboto',
  'Open Sans',
  'IBM Plex Sans',
  'Playfair Display',
  'JetBrains Mono',
];

const HEX = /^#[0-9a-fA-F]{6}$/;

const SECTIONS = [
  { key: 'identity', icon: Store, superAdminOnly: false },
  { key: 'branding', icon: Palette, superAdminOnly: false },
  { key: 'analytics', icon: BarChart3, superAdminOnly: false },
  { key: 'integrations', icon: Bot, superAdminOnly: false },
  { key: 'platformAlerts', icon: TriangleAlert, superAdminOnly: true },
] as const;

type SectionKey = (typeof SECTIONS)[number]['key'];

/** Relative luminance, used to warn about unreadable brand colours. */
function luminance(hex: string): number {
  if (!HEX.test(hex)) return 0;
  const n = parseInt(hex.slice(1), 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

/** WCAG contrast against white, which is what sits behind header text. */
function contrastWithWhite(hex: string): number {
  return (1.05 / (luminance(hex) + 0.05));
}

export default function AdminSettingsPage() {
  const tAdmin = useTranslations('admin');
  const t = useTranslations('admin.settingsPage');
  const tCommon = useTranslations('common');

  const [profile, setProfile] = useState<TenantProfile | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [active, setActive] = useState<SectionKey>('identity');
  // Platform alerting is a super-admin responsibility: the backend refuses
  // everyone else, so the section must not be offered to them either.
  const role = useAuthStore((s) => s.user?.role) ?? '';
  const isSuperAdmin = role === 'super_admin';
  // Memoised so the scroll-spy effect can depend on it without re-registering
  // its listener on every render.
  const sections = useMemo(
    () => SECTIONS.filter((s) => !s.superAdminOnly || isSuperAdmin),
    [isSuperAdmin],
  );
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/proxy/admin/tenant', { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}`);
      const data: TenantProfile = await res.json();
      setProfile(data);
      setForm({
        name: data.name ?? '',
        description: data.description ?? '',
        logoUrl: data.logoUrl ?? '',
        faviconUrl: data.faviconUrl ?? '',
        primaryColor: data.primaryColor ?? '#C2410C',
        secondaryColor: data.secondaryColor ?? '#333F4C',
        accentColor: data.accentColor ?? '#0F766E',
        fontFamily: data.fontFamily ?? '',
        domain: data.domain ?? '',
        gaMeasurementId: data.settings?.analytics?.gaMeasurementId ?? '',
        snapchatPixelId: data.settings?.analytics?.snapchatPixelId ?? '',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('loadFailed', { default: 'Failed to load' }));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const prevGa = profile?.settings?.analytics?.gaMeasurementId ?? '';
  const prevSnap = profile?.settings?.analytics?.snapchatPixelId ?? '';

  const dirty = useMemo(() => {
    if (!profile) return false;
    return (
      form.name !== (profile.name ?? '') ||
      form.description !== (profile.description ?? '') ||
      form.logoUrl !== (profile.logoUrl ?? '') ||
      form.faviconUrl !== (profile.faviconUrl ?? '') ||
      form.primaryColor !== (profile.primaryColor ?? '') ||
      form.secondaryColor !== (profile.secondaryColor ?? '') ||
      form.accentColor !== (profile.accentColor ?? '') ||
      form.fontFamily !== (profile.fontFamily ?? '') ||
      form.domain !== (profile.domain ?? '') ||
      form.gaMeasurementId !== prevGa ||
      form.snapchatPixelId !== prevSnap
    );
  }, [form, profile, prevGa, prevSnap]);

  const hexValid = useMemo(
    () => ['primaryColor', 'secondaryColor', 'accentColor'].every((k) => HEX.test(form[k as keyof FormState])),
    [form],
  );

  const analyticsValid = useMemo(() => {
    const ga = form.gaMeasurementId.trim();
    const snap = form.snapchatPixelId.trim();
    return (ga === '' || /^G-[A-Z0-9]{4,}$/i.test(ga)) && (snap === '' || /^\d{5,}$/.test(snap));
  }, [form.gaMeasurementId, form.snapchatPixelId]);

  const domainValid = useMemo(() => {
    const d = form.domain.trim();
    return d === '' || /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(d);
  }, [form.domain]);

  const canSave = dirty && hexValid && analyticsValid && domainValid && !!form.name.trim();

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    if (!profile || !canSave) return;
    setSaving(true);
    try {
      // Only changed whitelisted fields are sent, so a partial save can never
      // blank something the form does not own.
      const patch: Record<string, unknown> = {};
      const keys: (keyof FormState)[] = [
        'name',
        'description',
        'logoUrl',
        'faviconUrl',
        'primaryColor',
        'secondaryColor',
        'accentColor',
        'fontFamily',
        'domain',
      ];
      for (const key of keys) {
        const before = profile ? ((profile[key as keyof TenantProfile] as string | null) ?? '') : '';
        if (form[key] !== before) patch[key] = form[key];
      }
      const ga = form.gaMeasurementId.trim();
      const snap = form.snapchatPixelId.trim();
      if (ga !== prevGa || snap !== prevSnap) {
        patch.analytics = { gaMeasurementId: ga, snapchatPixelId: snap };
      }
      if (Object.keys(patch).length === 0) {
        setSaving(false);
        return;
      }
      const res = await fetch('/api/proxy/admin/tenant', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? `${res.status}`);
      }
      toast({ type: 'ok', title: t('savedToast', { default: 'Settings saved' }) });
      void load();
    } catch (e) {
      toast({
        type: 'err',
        title: t('saveFailed', { default: 'Save failed' }),
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const copySlug = async () => {
    try {
      await navigator.clipboard.writeText(profile?.slug ?? '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast({ type: 'err', title: t('copyFailed', { default: 'Could not copy' }) });
    }
  };

  // Highlight the section nearest the top of the viewport as the user scrolls.
  useEffect(() => {
    if (loading) return;
    const onScroll = () => {
      let current: SectionKey = 'identity';
      for (const s of sections) {
        const el = sectionRefs.current[s.key];
        if (el && el.getBoundingClientRect().top <= 120) current = s.key;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [loading, sections]);

  const scrollTo = (key: SectionKey) => {
    const el = sectionRefs.current[key];
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActive(key);
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1500px] pt-6">
        <FormSkeleton fields={5} />
      </div>
    );
  }

  return (
    <div className="w-full">
      <AdminCommandBar
        trail={[{ label: 'Titans of CNC' }, { label: tAdmin('settings', { default: 'Settings' })}]}
        live={
          dirty
            ? t('unsaved', { default: 'Unsaved changes' })
            : t('allSaved', { default: 'All changes saved' })
        }
        actions={
          dirty ? (
            <BarIconButton
              title={t('discard', { default: 'Discard changes' })}
              onClick={() => void load()}
            >
              <RotateCcw className="size-4" />
            </BarIconButton>
          ) : undefined
        }
        primary={
          <BarPrimaryButton
            icon={<Save className="size-4" strokeWidth={2.5} />}
            disabled={!canSave || saving}
            onClick={() => void save()}
          >
            {saving ? t('saving', { default: 'Saving…' }) : t('saveChanges', { default: 'Save changes' })}
          </BarPrimaryButton>
        }
      />

      <div className="mx-auto w-full max-w-[1500px] space-y-6 pt-6">
        <AdminPageHeader
          title={tAdmin('settings', { default: 'Settings' })}
          description={t('description', {
            default:
              'Tenant identity, brand appearance, measurement and connected tools for this workspace.',
          })}
          badge={
            <span className="inline-flex items-center gap-2 self-start rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground md:self-auto">
              <Store className="size-4" />
              {profile?.slug ?? '—'}
            </span>
          }
        />

        {error && <ErrorBanner message={error} onRetry={() => load()} retryLabel={tCommon('retry')} />}

        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          {/* Section nav */}
          <nav
            aria-label={t('sections', { default: 'Settings sections' })}
            className="hidden lg:block"
          >
            <div className="sticky top-24 space-y-1">
              {sections.map((s) => {
                const Icon = s.icon;
                const isActive = active === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => scrollTo(s.key)}
                    aria-current={isActive ? 'true' : undefined}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-start text-13 font-semibold transition',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <Icon className={cn('size-4', isActive ? 'text-primary' : 'text-muted-foreground')} />
                    {t(`nav.${s.key}`, { default: s.key })}
                  </button>
                );
              })}

              <div className="mt-4 rounded-xl border border-border bg-card p-3">
                <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('tenantSlug', { default: 'Tenant slug' })}
                </p>
                <p className="mt-1 truncate font-mono text-xs text-foreground">{profile?.slug ?? '—'}</p>
                <button
                  type="button"
                  onClick={() => void copySlug()}
                  className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1.5 text-2xs font-semibold text-foreground transition hover:bg-muted"
                >
                  {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
                  {copied ? t('copied', { default: 'Copied' }) : t('copy', { default: 'Copy' })}
                </button>
              </div>
            </div>
          </nav>

          <div className="min-w-0 space-y-6">
            {/* ---------------- Identity ---------------- */}
            <section
              ref={(el) => {
                sectionRefs.current.identity = el;
              }}
              className="scroll-mt-24"
            >
              <FormSection
                title={t('identity.title', { default: 'Identity' })}
                icon={Store}
                description={t('identity.desc', {
                  default: 'How this workspace is named and addressed across the platform.',
                })}
              >
                <div className="space-y-4">
                  <TextField
                    label={t('identity.name', { default: 'Name' })}
                    required
                    value={form.name}
                    onChange={(e) => set({ name: e.target.value })}
                    error={!form.name.trim() ? t('identity.nameRequired', { default: 'A name is required.' }) : undefined}
                  />
                  <TextAreaField
                    label={t('identity.description', { default: 'Description' })}
                    hint={t('identity.descriptionHint', {
                      default: 'Shown in page metadata and wherever the workspace is introduced.',
                    })}
                    rows={3}
                    value={form.description}
                    onChange={(e) => set({ description: e.target.value })}
                  />
                  <TextField
                    label={t('identity.domain', { default: 'Custom domain' })}
                    hint={t('identity.domainHint', {
                      default: 'Leave blank to use the default address.',
                    })}
                    value={form.domain}
                    onChange={(e) => set({ domain: e.target.value })}
                    placeholder="academy.example.com"
                    dir="ltr"
                    spellCheck={false}
                    error={
                      !domainValid ? t('identity.domainInvalid', { default: 'Enter a valid hostname.' }) : undefined
                    }
                  />
                </div>
              </FormSection>
            </section>

            {/* ---------------- Branding ---------------- */}
            <section
              ref={(el) => {
                sectionRefs.current.branding = el;
              }}
              className="scroll-mt-24"
            >
              <FormSection
                title={t('branding.title', { default: 'Branding' })}
                icon={Palette}
                description={t('branding.desc', {
                  default: 'Colours, logo and typography applied across the storefront.',
                })}
                bodyClassName="p-0"
              >
                <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-5 p-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <TextField
                        label={t('branding.logo', { default: 'Logo URL' })}
                        value={form.logoUrl}
                        onChange={(e) => set({ logoUrl: e.target.value })}
                        placeholder="https://…/logo.png"
                        dir="ltr"
                        spellCheck={false}
                      />
                      <TextField
                        label={t('branding.favicon', { default: 'Favicon URL' })}
                        value={form.faviconUrl}
                        onChange={(e) => set({ faviconUrl: e.target.value })}
                        placeholder="https://…/favicon.png"
                        dir="ltr"
                        spellCheck={false}
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      {(
                        [
                          ['primaryColor', t('branding.primary', { default: 'Primary' })],
                          ['secondaryColor', t('branding.secondary', { default: 'Secondary' })],
                          ['accentColor', t('branding.accent', { default: 'Accent' })],
                        ] as const
                      ).map(([key, label]) => {
                        const value = form[key];
                        const valid = HEX.test(value);
                        const lowContrast = valid && contrastWithWhite(value) < 3;
                        return (
                          <Field
                            key={key}
                            label={label}
                            error={!valid ? t('branding.hexInvalid', { default: 'Use a 6-digit hex value.' }) : undefined}
                            hint={
                              lowContrast
                                ? t('branding.lowContrast', {
                                    default: 'Too light for white text on this colour.',
                                  })
                                : undefined
                            }
                          >
                            {(a) => (
                              <div className="flex items-center gap-2">
                                <span className="relative shrink-0">
                                  <input
                                    type="color"
                                    value={valid ? value : '#000000'}
                                    onChange={(e) => set({ [key]: e.target.value } as Partial<FormState>)}
                                    aria-label={label}
                                    className="size-10 cursor-pointer rounded-xl border border-border bg-transparent p-1"
                                  />
                                </span>
                                <TextInput
                                  {...a}
                                  value={value}
                                  onChange={(e) => set({ [key]: e.target.value } as Partial<FormState>)}
                                  dir="ltr"
                                  spellCheck={false}
                                  className="font-mono"
                                />
                              </div>
                            )}
                          </Field>
                        );
                      })}
                    </div>

                    <Field
                      label={t('branding.font', { default: 'Font family' })}
                      hint={t('branding.fontHint', {
                        default: 'Applied to storefront headings and body copy.',
                      })}
                    >
                      {(a) => (
                        <>
                          <TextInput
                            {...a}
                            list="font-suggestions"
                            value={form.fontFamily}
                            onChange={(e) => set({ fontFamily: e.target.value })}
                            dir="ltr"
                            placeholder={t('branding.fontPlaceholder', { default: 'e.g. Inter' })}
                          />
                          <datalist id="font-suggestions">
                            {FONT_SUGGESTIONS.map((f) => (
                              <option key={f} value={f} />
                            ))}
                          </datalist>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {FONT_SUGGESTIONS.map((f) => (
                              <button
                                key={f}
                                type="button"
                                onClick={() => set({ fontFamily: f })}
                                className={cn(
                                  'rounded-lg border px-2 py-1 text-2xs font-semibold transition',
                                  form.fontFamily === f
                                    ? 'border-primary/40 bg-primary/10 text-primary'
                                    : 'border-border bg-background text-muted-foreground hover:text-foreground',
                                )}
                              >
                                {f}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </Field>
                  </div>

                  <BrandPreview
                    name={form.name || t('preview.placeholderName', { default: 'Your academy' })}
                    tagline={form.description}
                    logoUrl={form.logoUrl}
                    primary={HEX.test(form.primaryColor) ? form.primaryColor : '#C2410C'}
                    secondary={HEX.test(form.secondaryColor) ? form.secondaryColor : '#333F4C'}
                    accent={HEX.test(form.accentColor) ? form.accentColor : '#0F766E'}
                    fontFamily={form.fontFamily}
                  />
                </div>
              </FormSection>
            </section>

            {/* ---------------- Analytics ---------------- */}
            <section
              ref={(el) => {
                sectionRefs.current.analytics = el;
              }}
              className="scroll-mt-24"
            >
              <FormSection
                title={t('analytics.title', { default: 'Analytics & pixels' })}
                icon={BarChart3}
                description={t('analytics.desc', {
                  default: 'Measurement IDs for this workspace. Leave a field blank to disable it.',
                })}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    label={t('analytics.ga', { default: 'GA4 Measurement ID' })}
                    value={form.gaMeasurementId}
                    onChange={(e) => set({ gaMeasurementId: e.target.value })}
                    placeholder="G-XXXXXXXXXX"
                    dir="ltr"
                    spellCheck={false}
                    className="font-mono"
                    error={
                      form.gaMeasurementId.trim() !== '' && !/^G-[A-Z0-9]{4,}$/i.test(form.gaMeasurementId.trim())
                        ? t('analytics.gaInvalid', { default: 'Expected a value like G-ABC1234.' })
                        : undefined
                    }
                  />
                  <TextField
                    label={t('analytics.snapchat', { default: 'Snapchat Pixel ID' })}
                    value={form.snapchatPixelId}
                    onChange={(e) => set({ snapchatPixelId: e.target.value })}
                    placeholder="123456789012"
                    dir="ltr"
                    spellCheck={false}
                    inputMode="numeric"
                    className="font-mono"
                    error={
                      form.snapchatPixelId.trim() !== '' && !/^\d{5,}$/.test(form.snapchatPixelId.trim())
                        ? t('analytics.snapInvalid', { default: 'Must be empty or digits only.' })
                        : undefined
                    }
                  />
                </div>
              </FormSection>
            </section>

            {/* ---------------- Integrations ---------------- */}
            <section
              ref={(el) => {
                sectionRefs.current.integrations = el;
              }}
              className="scroll-mt-24"
            >
              <FormSection
                title={t('integrations.title', { default: 'Tools & integrations' })}
                icon={Sparkles}
                description={t('integrations.desc', {
                  default: 'Deeper configuration lives in each tool.',
                })}
                bodyClassName="p-3"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <IntegrationCard
                    href="/admin/settings/ai-assistant"
                    icon={Bot}
                    title={tAdmin('aiAssistant', { default: 'AI Assistant' })}
                    description={tAdmin('aiAssistantLink', {
                      default: 'Configure provider, access, retrieval, and indexing',
                    })}
                    actionLabel={tAdmin('configure', { default: 'Configure' })}
                  />
                  <IntegrationCard
                    href="/admin/theme"
                    icon={Palette}
                    title={tAdmin('theme', { default: 'Theme' })}
                    description={tAdmin('themeEditorLink', {
                      default: 'Manage colors & typography in Theme Editor',
                    })}
                    actionLabel={t('open', { default: 'Open' })}
                  />
                </div>
              </FormSection>
            </section>

            {isSuperAdmin && (
              <section
                id="section-platformAlerts"
                ref={(el) => {
                  sectionRefs.current.platformAlerts = el;
                }}
                className="scroll-mt-28"
              >
                <PlatformAlertSettings />
              </section>
            )}

            {/* Validation summary, so a blocked save explains itself. */}
            {dirty && !canSave && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/8 px-4 py-3"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                <div className="text-xs text-foreground">
                  <p className="font-semibold">
                    {t('cannotSave', { default: 'Some changes still need attention' })}
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 ps-4 text-muted-foreground">
                    {!form.name.trim() && <li>{t('identity.nameRequired', { default: 'A name is required.' })}</li>}
                    {!hexValid && <li>{t('branding.hexInvalid', { default: 'Use a 6-digit hex value.' })}</li>}
                    {!domainValid && <li>{t('identity.domainInvalid', { default: 'Enter a valid hostname.' })}</li>}
                    {!analyticsValid && <li>{t('analytics.fixIds', { default: 'Check the measurement IDs.' })}</li>}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Live brand preview                                                  */
/* ------------------------------------------------------------------ */
function BrandPreview({
  name,
  tagline,
  logoUrl,
  primary,
  secondary,
  accent,
  fontFamily,
}: {
  name: string;
  tagline?: string;
  logoUrl: string;
  primary: string;
  secondary: string;
  accent: string;
  fontFamily: string;
}) {
  const t = useTranslations('admin.settingsPage');
  // White text sits on the primary colour, so the preview is honest about
  // whether that combination is actually readable.
  const readable = contrastWithWhite(primary) >= 3;

  return (
    <div className="border-t border-border bg-muted/25 p-5 lg:border-s lg:border-t-0">
      <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Sparkles className="size-3" />
        {t('preview.label', { default: 'Live preview' })}
      </p>

      <div className="mt-3 overflow-hidden rounded-xl border border-border bg-background shadow-xs">
        <div
          className="flex items-center justify-between gap-3 px-4 py-3"
          style={{ backgroundColor: primary, fontFamily: fontFamily || undefined }}
        >
          <div className="flex min-w-0 items-center gap-2">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="size-7 rounded-lg bg-white/90 object-contain p-0.5" />
            ) : (
              <span
                className="flex size-7 items-center justify-center rounded-lg text-2xs font-bold"
                style={{ backgroundColor: accent }}
              >
                {name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span
              className={cn(
                'truncate text-sm font-bold',
                readable ? 'text-white' : 'text-black',
              )}
            >
              {name}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className="rounded-md px-2 py-1 text-2xs font-semibold"
              style={{ backgroundColor: accent, color: readable ? '#fff' : '#000' }}
            >
              {t('preview.cta', { default: 'Enroll' })}
            </span>
          </div>
        </div>

        <div className="space-y-2 p-4" style={{ fontFamily: fontFamily || undefined }}>
          <p className="text-2xs font-semibold uppercase tracking-wider" style={{ color: accent }}>
            {t('preview.section', { default: 'Featured' })}
          </p>
          <p className="text-sm font-semibold text-foreground">
            {t('preview.headline', { default: 'Precision CNC training' })}
          </p>
          <p className="line-clamp-2 text-2xs text-muted-foreground">
            {tagline || t('preview.taglinePlaceholder', { default: 'Your description appears here.' })}
          </p>
          <div className="flex items-center gap-1.5 pt-1">
            <span className="h-1.5 w-10 rounded-full" style={{ backgroundColor: primary }} />
            <span className="h-1.5 w-6 rounded-full" style={{ backgroundColor: secondary }} />
            <span className="h-1.5 w-3 rounded-full" style={{ backgroundColor: accent }} />
          </div>
        </div>
      </div>

      {!readable && (
        <p className="mt-2 flex items-start gap-1.5 text-2xs text-warning">
          <AlertTriangle className="mt-px size-3 shrink-0" />
          {t('preview.lowContrast', {
            default: 'This primary colour is too light for white text.',
          })}
        </p>
      )}
    </div>
  );
}

function IntegrationCard({
  href,
  icon: Icon,
  title,
  description,
  actionLabel,
}: {
  href: string;
  icon: typeof Bot;
  title: string;
  description: string;
  actionLabel: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition hover:border-primary/40 hover:bg-muted/40"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/60 text-primary">
          <Icon className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-foreground">{title}</span>
          <span className="block truncate text-xs text-muted-foreground">{description}</span>
        </span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 text-2xs font-semibold text-primary">
        {actionLabel}
        <span aria-hidden="true" className="transition group-hover:translate-x-0.5">
          →
        </span>
      </span>
    </Link>
  );
}
