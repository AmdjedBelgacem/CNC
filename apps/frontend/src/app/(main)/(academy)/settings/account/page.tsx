'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/use-auth';
import { apiProxyFetch } from '@/hooks/use-api-proxy';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { User, Mail, Globe, Clock, Check, AlertCircle, Sparkles } from 'lucide-react';
export default function AccountGeneralPage() {
  const t = useTranslations('settings');
  const { user, refreshProfile } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    username: '',
    email: '',
    language: 'en',
    timezone: 'UTC',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        username: user.username || '',
        email: user.email || '',
        language: user.language || 'en',
        timezone: user.timezone || 'UTC',
      });
    }
  }, [user]);
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await apiProxyFetch('/api/proxy/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          username: form.username,
          language: form.language,
          timezone: form.timezone,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to save');
      }
      setSaved(true);
      if (form.language === 'en' || form.language === 'ar') {
        document.cookie = `NEXT_LOCALE=${form.language}; path=/; max-age=31536000; SameSite=Lax`;
      }
      await refreshProfile();
      router.refresh();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-6">
      {' '}
      {/* Page header */}{' '}
      <div className="flex gap-4">
        {' '}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {' '}
          <User className="size-5" />{' '}
        </div>{' '}
        <div>
          {' '}
          <h1 className="text-xl font-semibold tracking-tight">{t('general')}</h1>{' '}
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {t('generalDesc')}
          </p>{' '}
        </div>{' '}
      </div>{' '}
      {/* Feedback */}{' '}
      {error && (
        <div className="flex gap-3 rounded-2xl border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive dark:border-red-900/30 dark:bg-destructive/10 dark:text-red-300">
          {' '}
          <AlertCircle className="size-4 shrink-0 mt-0.5" /> {error}{' '}
        </div>
      )}{' '}
      {saved && (
        <div className="flex gap-3 rounded-2xl border border-success bg-success/10 px-4 py-3 text-sm text-success dark:border-success/30 dark:bg-success/10 dark:text-success">
          {' '}
          <Check className="size-4 shrink-0 mt-0.5" /> {t('saved')}{' '}
        </div>
      )}{' '}
      <form onSubmit={handleSave} className="space-y-6">
        {' '}
        {/* Identity */}{' '}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {' '}
          <div className="border-b border-border/60 bg-muted/20 px-6 py-4">
            {' '}
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              {' '}
              <span className="flex size-6 items-center justify-center rounded-lg bg-card text-muted-foreground shadow-sm ring-1 ring-border">
                <User className="size-3.5" />
              </span>{' '}
              {t('profileIdentity')}{' '}
            </h2>{' '}
            <p className="mt-1 text-xs text-muted-foreground">{t('profileIdentityDesc')}</p>{' '}
          </div>{' '}
          <div className="p-6 space-y-5">
            {' '}
            <div className="grid gap-5 sm:grid-cols-2">
              {' '}
              <div className="space-y-2">
                {' '}
                <Label
                  htmlFor="name"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {t('displayName')}
                </Label>{' '}
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="h-10 rounded-xl bg-muted/20 focus:bg-card transition-colors"
                  placeholder="Ada Lovelace"
                />{' '}
              </div>{' '}
              <div className="space-y-2">
                {' '}
                <Label
                  htmlFor="username"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {t('username')}
                </Label>{' '}
                <div className="relative">
                  {' '}
                  <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    @
                  </span>{' '}
                  <Input
                    id="username"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    className="h-10 rounded-xl bg-muted/20 ps-7 focus:bg-card transition-colors"
                    placeholder="adalovelace"
                  />{' '}
                </div>{' '}
              </div>{' '}
            </div>{' '}
            <div className="space-y-2">
              {' '}
              <Label
                htmlFor="email"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
              >
                {' '}
                <Mail className="size-3.5" /> {t('email')}{' '}
                <span className="ms-auto rounded-full bg-warning/10 px-2 py-0.5 text-2xs font-bold uppercase tracking-wider text-warning">
                  {t('verified')}
                </span>{' '}
              </Label>{' '}
              <Input
                id="email"
                value={form.email}
                disabled
                className="h-10 rounded-xl bg-muted/40"
              />{' '}
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {' '}
                <Sparkles className="size-3.5" /> {t('changeEmailHint')}{' '}
              </p>{' '}
            </div>{' '}
          </div>{' '}
        </div>{' '}
        {/* Preferences */}{' '}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {' '}
          <div className="border-b border-border/60 bg-muted/20 px-6 py-4">
            {' '}
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              {' '}
              <span className="flex size-6 items-center justify-center rounded-lg bg-card text-muted-foreground shadow-sm ring-1 ring-border">
                <Globe className="size-3.5" />
              </span>{' '}
              {t('localization')}{' '}
            </h2>{' '}
            <p className="mt-1 text-xs text-muted-foreground">{t('localizationDesc')}</p>{' '}
          </div>{' '}
          <div className="p-6">
            {' '}
            <div className="grid gap-5 sm:grid-cols-2">
              {' '}
              <div className="space-y-2">
                {' '}
                <Label
                  htmlFor="language"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {t('language')}
                </Label>{' '}
                <div className="relative">
                  {' '}
                  <select
                    id="language"
                    value={form.language}
                    onChange={(e) => setForm({ ...form, language: e.target.value })}
                    className="flex h-10 w-full appearance-none rounded-xl border border-input bg-muted/20 px-3 py-2 pe-8 text-sm focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                  >
                    {' '}
                    <option value="en">English</option>
                    <option value="ar">العربية</option>
                  </select>{' '}
                  <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    ⌄
                  </span>{' '}
                </div>{' '}
              </div>{' '}
              <div className="space-y-2">
                {' '}
                <Label
                  htmlFor="timezone"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
                >
                  {' '}
                  <Clock className="size-3.5" /> {t('timezone')}{' '}
                </Label>{' '}
                <select
                  id="timezone"
                  value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                  className="flex h-10 w-full appearance-none rounded-xl border border-input bg-muted/20 px-3 py-2 pe-8 text-sm focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                >
                  {' '}
                  <option value="UTC">UTC — Coordinated Universal Time</option>{' '}
                  <option value="America/New_York">Eastern — New York</option>{' '}
                  <option value="America/Chicago">Central — Chicago</option>{' '}
                  <option value="America/Denver">Mountain — Denver</option>{' '}
                  <option value="America/Los_Angeles">Pacific — Los Angeles</option>{' '}
                  <option value="Europe/London">London — GMT/BST</option>{' '}
                  <option value="Europe/Paris">Paris — CET/CEST</option>{' '}
                  <option value="Europe/Berlin">Berlin — CET/CEST</option>{' '}
                </select>{' '}
              </div>{' '}
            </div>{' '}
          </div>{' '}
        </div>{' '}
        {/* Sticky save bar */}{' '}
        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-lg sm:px-5">
          {' '}
          <p className="hidden text-xs text-muted-foreground sm:block">{t('unsavedHint')}</p>{' '}
          <p className="text-xs font-medium sm:hidden">
            {saved ? `${t('saved')} ✓` : t('unsavedHint')}
          </p>{' '}
          <Button type="submit" disabled={saving} className="h-9 rounded-full px-5 shadow-md">
            {' '}
            {saving ? t('saving') : t('saveChanges')}{' '}
          </Button>{' '}
        </div>{' '}
      </form>{' '}
    </div>
  );
}
