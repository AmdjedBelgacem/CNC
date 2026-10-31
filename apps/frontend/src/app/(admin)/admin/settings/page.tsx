'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, m } from 'framer-motion';
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
import { api } from '@/lib/api-client';
import { ErrorBanner } from '@/components/admin/admin-ui';
import { useAuthStore } from '@/stores/auth-store';
import { PlatformAlertSettings } from './platform-alert-settings';
import { toast } from '@/components/ui/toast';
import { HoverLift, Reveal } from '@/components/ui/motion';
import { ease, spring } from '@/lib/motion';
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
  primaryColor: '#B65433',
  secondaryColor: '#3D3D3A',
  accentColor: '#4D6E58',
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
        primaryColor: data.primaryColor ?? '#B65433',
        secondaryColor: data.secondaryColor ?? '#3D3D3A',
        accentColor: data.accentColor ?? '#4D6E58',
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
      await api.patch('/admin/tenant', patch);
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
        trail={[{ label: 'Baroot CNC Solutions' }, { label: tAdmin('settings', { default: 'Settings' })}]}
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
        <Reveal>
        <AdminPageHeader
          title={tAdmin('settings', { default: 'Settings' })}
          description={t('description', {
            default:
              'Tenant identity, brand appearance, measurement and connected tools for this workspace.',
          })}
          badge={
            <span className="inline-flex items-center gap-2 self-start rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-xs md:self-auto">
              <Store className="size-3.5" />
              <span className="font-mono" dir="ltr">{profile?.slug ?? '—'}</span>
            </span>
          }
        />
        </Reveal>

        {error && <ErrorBanner message={error} onRetry={() => load()} retryLabel={tCommon('retry')} />}

        <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
          {/* Section nav */}
          <nav
            aria-label={t('sections', { default: 'Settings sections' })}
            className="hidden lg:block"
          >
            <div className="sticky top-24 space-y-0.5">
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
                      'relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start text-13 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isActive
                        ? 'text-foreground'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                    )}
                  >
                    {isActive && (
                      <m.span
                        layoutId="settings-nav-active"
                        transition={spring.smooth}
                        className="absolute inset-0 rounded-lg border border-border/70 bg-card shadow-xs"
                        aria-hidden="true"
                      >
                        <span className="absolute inset-y-2 start-0 w-0.5 rounded-full bg-primary" />
                      </m.span>
                    )}
                    <Icon
                      className={cn(
                        'relative size-4 transition-colors',
                        isActive ? 'text-primary' : 'text-muted-foreground',
                      )}
                    />
                    <span className="relative">{t(`nav.${s.key}`, { default: s.key })}</span>
                  </button>
                );
              })}

              <div className="mt-6 rounded-xl border border-border/70 bg-card p-3.5 shadow-xs">
                <p className="text-xs font-medium text-muted-foreground">
                  {t('tenantSlug', { default: 'Tenant slug' })}
                </p>
                <p className="mt-1 truncate font-mono text-xs text-foreground" dir="ltr">
                  {profile?.slug ?? '—'}
                </p>
                <button
                  type="button"
                  onClick={() => void copySlug()}
                  className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border/70 bg-background px-2 py-1.5 text-xs font-medium text-foreground transition hover:border-border-strong hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <m.span
                      key={copied ? 'copied' : 'copy'}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0, transition: spring.snappy }}
                      exit={{ opacity: 0, y: -4, transition: { duration: 0.1, ease: ease.exit } }}
                      className="inline-flex items-center gap-1.5"
                    >
                      {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
                      {copied ? t('copied', { default: 'Copied' }) : t('copy', { default: 'Copy' })}
                    </m.span>
                  </AnimatePresence>
                </button>
              </div>
            </div>
          </nav>

          <div className="min-w-0 space-y-8">
            {/* ---------------- Identity ---------------- */}
            <section
              ref={(el) => {
                sectionRefs.current.identity = el;
              }}
              className="scroll-mt-24"
            >
              <Reveal>
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
              </Reveal>
            </section>

            {/* ---------------- Branding ---------------- */}
            <section
              ref={(el) => {
                sectionRefs.current.branding = el;
              }}
              className="scroll-mt-24"
            >
              <Reveal>
              <FormSection
                title={t('branding.title', { default: 'Branding' })}
                icon={Palette}
                description={t('branding.desc', {
                  default: 'Colours, logo and typography applied across the storefront.',
                })}
                bodyClassName="p-0"
              >
                <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-6 p-5 sm:p-6">
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
                                    className="size-10 cursor-pointer rounded-full border border-border/70 bg-card p-1 shadow-xs transition hover:border-border-strong"
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
                                style={{ fontFamily: f }}
                                aria-pressed={form.fontFamily === f}
                                className={cn(
                                  'rounded-full border px-2.5 py-1 text-xs font-medium transition active:scale-[0.97]',
                                  form.fontFamily === f
                                    ? 'border-primary/40 bg-primary/10 text-primary'
                                    : 'border-border/70 bg-background text-muted-foreground hover:border-border-strong hover:text-foreground',
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
                    primary={HEX.test(form.primaryColor) ? form.primaryColor : '#B65433'}
                    secondary={HEX.test(form.secondaryColor) ? form.secondaryColor : '#3D3D3A'}
                    accent={HEX.test(form.accentColor) ? form.accentColor : '#4D6E58'}
                    fontFamily={form.fontFamily}
                  />
                </div>
              </FormSection>
              </Reveal>
            </section>

            {/* ---------------- Analytics ---------------- */}
            <section
              ref={(el) => {
                sectionRefs.current.analytics = el;
              }}
              className="scroll-mt-24"
            >
              <Reveal>
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
              </Reveal>
            </section>

            {/* ---------------- Integrations ---------------- */}
            <section
              ref={(el) => {
                sectionRefs.current.integrations = el;
              }}
              className="scroll-mt-24"
            >
              <Reveal>
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
              </Reveal>
            </section>

            {isSuperAdmin && (
              <section
                id="section-platformAlerts"
                ref={(el) => {
                  sectionRefs.current.platformAlerts = el;
                }}
                className="scroll-mt-28"
              >
                <Reveal>
                <PlatformAlertSettings />
                </Reveal>
              </section>
            )}

            {/* Validation summary, so a blocked save explains itself. */}
            <AnimatePresence initial={false}>
            {dirty && !canSave && (
              <m.div
                key="cannot-save"
                role="alert"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.28, ease: ease.emerge } }}
                exit={{ opacity: 0, y: 4, transition: { duration: 0.16, ease: ease.exit } }}
                className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3.5"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                <div className="text-xs text-foreground">
                  <p className="font-medium">
                    {t('cannotSave', { default: 'Some changes still need attention' })}
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 ps-4 text-muted-foreground">
                    {!form.name.trim() && <li>{t('identity.nameRequired', { default: 'A name is required.' })}</li>}
                    {!hexValid && <li>{t('branding.hexInvalid', { default: 'Use a 6-digit hex value.' })}</li>}
                    {!domainValid && <li>{t('identity.domainInvalid', { default: 'Enter a valid hostname.' })}</li>}
                    {!analyticsValid && <li>{t('analytics.fixIds', { default: 'Check the measurement IDs.' })}</li>}
                  </ul>
                </div>
              </m.div>
            )}
            </AnimatePresence>
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
    <div className="border-t border-border/70 bg-muted/30 p-5 sm:p-6 lg:border-s lg:border-t-0">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
        {t('preview.label', { default: 'Live preview' })}
      </p>

      <div
        className="mt-3 overflow-hidden rounded-xl border border-border/70 bg-background shadow-sm"
        style={{ fontFamily: fontFamily || undefined }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-card px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                className="size-7 rounded-full border border-border/70 bg-card object-contain p-0.5"
              />
            ) : (
              <span
                className={cn(
                  'flex size-7 items-center justify-center rounded-full text-xs font-medium transition-colors duration-300',
                  readable ? 'text-white' : 'text-black',
                )}
                style={{ backgroundColor: primary }}
              >
                {name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span
              className={cn('truncate text-sm font-medium text-foreground', !fontFamily && 'font-display')}
            >
              {name}
            </span>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-full px-3 py-1 text-xs font-medium shadow-xs transition-colors duration-300',
              readable ? 'text-white' : 'text-black',
            )}
            style={{ backgroundColor: primary }}
          >
            {t('preview.cta', { default: 'Enroll' })}
          </span>
        </div>

        <div className="space-y-2 px-4 pb-5 pt-5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span
              className="size-1.5 rounded-full transition-colors duration-300"
              style={{ backgroundColor: accent }}
              aria-hidden="true"
            />
            {t('preview.section', { default: 'Featured' })}
          </p>
          <p
            className={cn(
              'text-balance text-lg font-medium leading-snug tracking-[-0.015em] text-foreground',
              !fontFamily && 'font-display',
            )}
          >
            {t('preview.headline', { default: 'Precision CNC training' })}
          </p>
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {tagline || t('preview.taglinePlaceholder', { default: 'Your description appears here.' })}
          </p>
          <div className="flex items-center gap-1.5 pt-2">
            <span className="h-1.5 w-10 rounded-full transition-colors duration-300" style={{ backgroundColor: primary }} />
            <span className="h-1.5 w-6 rounded-full transition-colors duration-300" style={{ backgroundColor: secondary }} />
            <span className="h-1.5 w-3 rounded-full transition-colors duration-300" style={{ backgroundColor: accent }} />
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {!readable && (
          <m.p
            key="low-contrast"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto', transition: { duration: 0.24, ease: ease.emerge } }}
            exit={{ opacity: 0, height: 0, transition: { duration: 0.16, ease: ease.exit } }}
            className="overflow-hidden"
          >
            <span className="flex items-start gap-1.5 pt-2.5 text-xs text-warning">
              <AlertTriangle className="mt-px size-3 shrink-0" />
              {t('preview.lowContrast', {
                default: 'This primary colour is too light for white text.',
              })}
            </span>
          </m.p>
        )}
      </AnimatePresence>
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
    <HoverLift className="h-full">
      <Link
        href={href}
        className="group flex h-full items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-xs transition-[border-color,box-shadow] duration-200 hover:border-border-strong hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-base font-medium tracking-[-0.015em] text-foreground">
              {title}
            </span>
            <span className="block truncate text-xs text-muted-foreground">{description}</span>
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
          {actionLabel}
          <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5">
            →
          </span>
        </span>
      </Link>
    </HoverLift>
  );
}
