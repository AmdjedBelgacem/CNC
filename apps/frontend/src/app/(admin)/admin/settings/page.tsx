'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { RefreshCw, Loader2, Palette, Copy, Check, AlertCircle, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import {
  AdminCommandBar,
  BarButton,
  BarPrimaryButton,
  AdminPageHeader,
} from '@/components/admin/admin-chrome';
interface TenantProfile {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string | null;
  domain: string | null;
}
type FormState = { [K in Exclude<keyof TenantProfile, 'id' | 'slug'>]: string };
const EMPTY: FormState = {
  name: '',
  description: '',
  logoUrl: '',
  faviconUrl: '',
  primaryColor: '#7c3aed',
  secondaryColor: '#0a1628',
  accentColor: '#ff6b35',
  fontFamily: '',
  domain: '',
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
function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const valid = /^#[0-9a-fA-F]{6}$/.test(value);
  return (
    <div className="space-y-1.5">
      {' '}
      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>{' '}
      <div className="flex items-center gap-2">
        {' '}
        <input
          type="color"
          value={valid ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border border-input bg-background p-1"
          aria-label={`${label} color picker`}
        />{' '}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#7c3aed"
          className={cn(
            'h-9 w-full rounded-xl border border-border bg-background px-3 font-mono text-sm uppercase outline-none focus-visible:ring-2 focus-visible:ring-ring',
            !valid && value && 'border-red-500/60',
          )}
        />{' '}
      </div>{' '}
    </div>
  );
}
function UrlField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      {' '}
      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>{' '}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />{' '}
    </div>
  );
}
export default function AdminSettingsPage() {
  const tAdmin = useTranslations('admin');
  const tCommon = useTranslations('common');
  const [profile, setProfile] = useState<TenantProfile | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/proxy/admin/tenant', { credentials: 'include' });
      if (!res.ok) throw new Error(`Failed to load settings (${res.status})`);
      const data: TenantProfile = await res.json();
      setProfile(data);
      setForm({
        name: data.name ?? '',
        description: data.description ?? '',
        logoUrl: data.logoUrl ?? '',
        faviconUrl: data.faviconUrl ?? '',
        primaryColor: data.primaryColor ?? '#7c3aed',
        secondaryColor: data.secondaryColor ?? '#0a1628',
        accentColor: data.accentColor ?? '#ff6b35',
        fontFamily: data.fontFamily ?? '',
        domain: data.domain ?? '',
      });
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
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
      form.domain !== (profile.domain ?? '')
    );
  }, [form, profile]);
  const hexValid = useMemo(
    () =>
      ['primaryColor', 'secondaryColor', 'accentColor'].every((k) =>
        /^#[0-9a-fA-F]{6}$/.test(form[k as keyof FormState] as string),
      ),
    [form],
  );
  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));
  const save = async () => {
    if (!dirty || !hexValid || !form.name.trim()) return;
    setSaving(true);
    try {
      // Send only changed whitelisted fields
      const patch: Record<string, string> = {};
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
        const before = profile
          ? ((profile[key as keyof TenantProfile] as string | null) ?? '')
          : '';
        if (form[key] !== before) patch[key] = form[key];
      }
      const res = await fetch('/api/proxy/admin/tenant', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? `Save failed (${res.status})`);
      }
      toast({ type: 'ok', title: 'Settings saved' });
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 2500);
      load();
    } catch (e: any) {
      toast({ type: 'err', title: 'Save failed', description: e?.message });
    } finally {
      setSaving(false);
    }
  };
  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6">
        {' '}
        <div className="h-8 w-40 animate-pulse rounded-lg bg-muted" />{' '}
        {[0, 1].map((i) => (
          <div key={i} className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
            {' '}
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />{' '}
            {[0, 1, 2].map((j) => (
              <div key={j} className="h-9 animate-pulse rounded-lg bg-muted" />
            ))}{' '}
          </div>
        ))}{' '}
      </div>
    );
  }
  return (
    <div className="w-full">
      <AdminCommandBar
        trail={[{ label: 'Titans of CNC' }, { label: tAdmin('settings') }]}
        live="Live"
        actions={
          <BarButton icon={<RefreshCw className="h-4 w-4" />} onClick={load}>
            Reset
          </BarButton>
        }
        primary={
          <BarPrimaryButton
            icon={<Save className="h-4 w-4" strokeWidth={2.5} />}
            disabled={!dirty || saving || !hexValid || !form.name.trim()}
            onClick={save}
          >
            {saving ? 'Saving…' : tCommon('saveChanges')}
          </BarPrimaryButton>
        }
      />

      <div className="mx-auto w-full max-w-3xl space-y-6 pt-6">
        <AdminPageHeader
          title={tAdmin('settings')}
          description={`${tAdmin('tenantProfile')} & ${tAdmin('branding')}`}
          badge={
            dirty ? (
              <span className="flex items-center gap-2 self-start rounded-full border border-amber-200/80 bg-amber-50/80 px-3 py-1.5 text-xs font-medium text-amber-800 shadow-sm md:self-auto dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                {tCommon('unsavedChanges')}
              </span>
            ) : (
              <span className="flex items-center gap-2 self-start rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3 py-1.5 text-xs font-medium text-emerald-800 shadow-sm md:self-auto dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200">
                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                {savedTick ? tCommon('saved') : tCommon('noChanges')}
              </span>
            )
          }
        />
        {error && (
          <div className="flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3">
            {' '}
            <span className="text-sm text-red-600 dark:text-red-400">{error}</span>{' '}
            <button
              type="button"
              onClick={load}
              className="text-sm font-medium text-red-600 hover:underline dark:text-red-400"
            >
              {' '}
              Retry{' '}
            </button>{' '}
          </div>
        )}{' '}
        {/* Slug card */}{' '}
        {profile && (
          <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-sm">
            {' '}
            <div className="min-w-0">
              {' '}
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {tAdmin('tenantSlug')}
              </p>{' '}
              <p className="truncate font-mono text-sm font-medium">{profile.slug}</p>{' '}
            </div>{' '}
            <span className="ml-3 flex shrink-0 items-center gap-2">
              {' '}
              <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {' '}
                {tAdmin('immutable')}{' '}
              </span>{' '}
              <button
                type="button"
                title="Copy slug"
                onClick={() => {
                  navigator.clipboard?.writeText(profile.slug).then(
                    () => toast({ type: 'info', title: 'Slug copied' }),
                    () => {},
                  );
                }}
                className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                {' '}
                {savedTick ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}{' '}
              </button>{' '}
            </span>{' '}
          </div>
        )}{' '}
        {/* Profile group */}{' '}
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          {' '}
          <h3 className="text-sm font-semibold">{tAdmin('tenantProfile')}</h3>{' '}
          <div className="space-y-1.5">
            {' '}
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Name *
            </label>{' '}
            <input
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              className="h-9 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />{' '}
          </div>{' '}
          <div className="space-y-1.5">
            {' '}
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Description
            </label>{' '}
            <textarea
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              rows={2}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />{' '}
          </div>{' '}
          <UrlField
            label="Custom domain"
            value={form.domain}
            onChange={(v) => set({ domain: v })}
            placeholder="academy.example.com"
          />{' '}
        </section>{' '}
        {/* Branding group */}{' '}
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          {' '}
          <h3 className="text-sm font-semibold">{tAdmin('branding')}</h3>{' '}
          {(form.logoUrl || form.faviconUrl) && (
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-border p-3">
              {' '}
              {form.logoUrl /* eslint-disable-next-line @next/next/no-img-element */ && (
                <img
                  src={form.logoUrl}
                  alt="Logo preview"
                  className="h-12 w-12 rounded-lg object-contain"
                  onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                />
              )}{' '}
              {form.faviconUrl /* eslint-disable-next-line @next/next/no-img-element */ && (
                <img
                  src={form.faviconUrl}
                  alt="Favicon preview"
                  className="h-6 w-6 rounded object-contain"
                  onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                />
              )}{' '}
              <span className="text-xs text-muted-foreground">Live preview</span>{' '}
            </div>
          )}{' '}
          <UrlField
            label="Logo URL"
            value={form.logoUrl}
            onChange={(v) => set({ logoUrl: v })}
            placeholder="https://…/logo.png"
          />{' '}
          <UrlField
            label="Favicon URL"
            value={form.faviconUrl}
            onChange={(v) => set({ faviconUrl: v })}
            placeholder="https://…/favicon.png"
          />{' '}
          <div className="grid gap-4 sm:grid-cols-3">
            {' '}
            <ColorField
              label="Primary"
              value={form.primaryColor}
              onChange={(v) => set({ primaryColor: v })}
            />{' '}
            <ColorField
              label="Secondary"
              value={form.secondaryColor}
              onChange={(v) => set({ secondaryColor: v })}
            />{' '}
            <ColorField
              label="Accent"
              value={form.accentColor}
              onChange={(v) => set({ accentColor: v })}
            />{' '}
          </div>{' '}
          <div className="space-y-1.5">
            {' '}
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Font family
            </label>{' '}
            <input
              list="font-suggestions"
              value={form.fontFamily}
              onChange={(e) => set({ fontFamily: e.target.value })}
              placeholder="Inter"
              className="h-9 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />{' '}
            <datalist id="font-suggestions">
              {' '}
              {FONT_SUGGESTIONS.map((f) => (
                <option key={f} value={f} />
              ))}{' '}
            </datalist>{' '}
          </div>{' '}
        </section>{' '}
        {/* Theme link-out */}{' '}
        <Link
          href="/admin/theme"
          className="group flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/40"
        >
          {' '}
          <div className="flex items-center gap-3">
            {' '}
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {' '}
              <Palette className="h-5 w-5" />{' '}
            </span>{' '}
            <div>
              {' '}
              <p className="text-sm font-semibold">{tAdmin('theme')}</p>{' '}
              <p className="text-xs text-muted-foreground">{tAdmin('themeEditorLink')}</p>{' '}
            </div>{' '}
          </div>{' '}
          <span className="text-sm font-medium text-primary transition group-hover:translate-x-0.5">
            Open →
          </span>{' '}
        </Link>{' '}
        {/* Save bar */}{' '}
        <div className="sticky bottom-16 z-10 lg:bottom-4">
          {' '}
          <div
            className={cn(
              'flex items-center justify-between gap-3 rounded-2xl border bg-card p-3 shadow-lg transition',
              dirty ? 'border-primary/50 opacity-100' : 'border-border opacity-60',
            )}
          >
            {' '}
            <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              {' '}
              {!hexValid && (
                <>
                  {' '}
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" /> Fix invalid colors
                  to save.{' '}
                </>
              )}{' '}
              {dirty
                ? tCommon('unsavedChanges')
                : savedTick
                  ? tCommon('saved')
                  : tCommon('noChanges')}{' '}
            </p>{' '}
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving || !hexValid || !form.name.trim()}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
            >
              {' '}
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} {tCommon('saveChanges')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
