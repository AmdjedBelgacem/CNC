'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/use-auth';
import { apiProxyFetch } from '@/hooks/use-api-proxy';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Reveal } from '@/components/ui/motion';
import { SettingsBanner, SettingsHeader } from '../_components/settings-ui';
import { toast } from '@/components/ui/toast';
import { User, Mail, Globe, Clock, Check, AlertCircle, Sparkles, ChevronDown } from 'lucide-react';
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
      toast({ type: 'ok', title: t('saved') });
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('saveFailed');
      setError(message);
      toast({ type: 'err', title: t('saveFailed'), description: message });
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-6">
      {/* Page header */}
      <SettingsHeader icon={User} title={t('general')} subtitle={t('generalDesc')} />
      {/* Feedback */}
      <SettingsBanner show={!!error} tone="error" icon={AlertCircle} role="alert">
        {error}
      </SettingsBanner>
      <SettingsBanner show={!!saved} tone="success" icon={Check} role="status">
        {t('saved')}
      </SettingsBanner>
      <form onSubmit={handleSave} className="space-y-6">
        {/* Identity */}
        <Reveal
          as="section"
          className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs"
        >
          <div className="border-b border-border/60 px-6 pb-4 pt-5">
            <h2 className="flex items-center gap-2.5 font-display text-lg font-medium tracking-[-0.012em] text-foreground">
              <span className="flex size-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <User className="size-3.5" />
              </span>
              {t('profileIdentity')}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">{t('profileIdentityDesc')}</p>
          </div>
          <div className="p-6 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium text-foreground">
                  {t('displayName')}
                </Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ada Lovelace"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-medium text-foreground">
                  {t('username')}
                </Label>
                <div className="relative">
                  <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    @
                  </span>
                  <Input
                    id="username"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    className="ps-7"
                    placeholder="adalovelace"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-sm font-medium text-foreground flex items-center gap-1.5"
              >
                <Mail className="size-3.5" /> {t('email')}
                <span className="ms-auto rounded-full bg-warning/10 px-2 py-0.5 text-2xs font-medium text-warning">
                  {t('verified')}
                </span>
              </Label>
              <Input id="email" value={form.email} disabled className="h-10 bg-muted/40" />
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Sparkles className="size-3.5" /> {t('changeEmailHint')}
              </p>
            </div>
          </div>
        </Reveal>
        {/* Preferences */}
        <Reveal
          as="section"
          className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs"
        >
          <div className="border-b border-border/60 px-6 pb-4 pt-5">
            <h2 className="flex items-center gap-2.5 font-display text-lg font-medium tracking-[-0.012em] text-foreground">
              <span className="flex size-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Globe className="size-3.5" />
              </span>
              {t('localization')}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">{t('localizationDesc')}</p>
          </div>
          <div className="p-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="language" className="text-sm font-medium text-foreground">
                  {t('language')}
                </Label>
                <div className="relative">
                  <select
                    id="language"
                    value={form.language}
                    onChange={(e) => setForm({ ...form, language: e.target.value })}
                    className="flex h-10 w-full appearance-none rounded-lg border border-input bg-card px-3 py-2 pe-8 text-sm shadow-xs transition-[border-color,box-shadow] hover:border-border-strong focus:border-ring/60 focus:outline-none focus:ring-4 focus:ring-ring/15"
                  >
                    <option value="en">English</option>
                    <option value="ar">العربية</option>
                  </select>
                  <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <ChevronDown className="size-4" />
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="timezone"
                  className="text-sm font-medium text-foreground flex items-center gap-1.5"
                >
                  <Clock className="size-3.5" /> {t('timezone')}
                </Label>
                <select
                  id="timezone"
                  value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                  className="flex h-10 w-full appearance-none rounded-lg border border-input bg-card px-3 py-2 pe-8 text-sm shadow-xs transition-[border-color,box-shadow] hover:border-border-strong focus:border-ring/60 focus:outline-none focus:ring-4 focus:ring-ring/15"
                >
                  <option value="UTC">UTC — Coordinated Universal Time</option>
                  <option value="America/New_York">Eastern — New York</option>
                  <option value="America/Chicago">Central — Chicago</option>
                  <option value="America/Denver">Mountain — Denver</option>
                  <option value="America/Los_Angeles">Pacific — Los Angeles</option>
                  <option value="Europe/London">London — GMT/BST</option>
                  <option value="Europe/Paris">Paris — CET/CEST</option>
                  <option value="Europe/Berlin">Berlin — CET/CEST</option>
                </select>
              </div>
            </div>
          </div>
        </Reveal>
        {/* Sticky save bar */}
        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/90 px-4 py-3 shadow-lg backdrop-blur sm:px-5">
          <p className="hidden text-xs text-muted-foreground sm:block">{t('unsavedHint')}</p>
          <p className="text-xs font-medium sm:hidden">
            {saved ? `${t('saved')} ✓` : t('unsavedHint')}
          </p>
          <Button type="submit" disabled={saving} className="h-9 rounded-full px-5">
            {saving ? t('saving') : t('saveChanges')}
          </Button>
        </div>
      </form>
    </div>
  );
}
