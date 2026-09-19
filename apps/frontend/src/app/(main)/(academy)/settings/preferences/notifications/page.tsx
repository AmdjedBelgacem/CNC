'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Bell, Mail, MessageSquare, Check } from 'lucide-react';
import { apiProxyFetch } from '@/hooks/use-api-proxy';
const emailToggles = [
  { key: 'marketing', label: 'Marketing emails', desc: 'Product updates and promotions' },
  { key: 'security', label: 'Security alerts', desc: 'Sign-in and suspicious activity' },
  { key: 'updates', label: 'Course updates', desc: 'New lessons and progress reminders' },
  { key: 'newsletter', label: 'Newsletter', desc: 'Weekly digest and community highlights' },
];
const inAppToggles = [
  { key: 'comments', label: 'Comments', desc: 'Replies to your posts' },
  { key: 'mentions', label: 'Mentions', desc: 'When someone mentions you' },
  { key: 'follows', label: 'New followers', desc: 'Someone follows you' },
  { key: 'enrollments', label: 'Enrollments', desc: 'Course enrollment confirmations' },
  { key: 'certificates', label: 'Certificates', desc: 'Issued certificates' },
  { key: 'messages', label: 'Direct messages', desc: 'Private messages' },
];
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${checked ? 'bg-primary' : 'bg-input'}`}
    >
      {' '}
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition ${checked ? 'translate-x-5' : 'translate-x-0.5'}`}
      />{' '}
    </button>
  );
}
export default function NotificationsPage() {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const res = await apiProxyFetch('/api/proxy/auth/me/preferences');
        if (res.ok) {
          const data = await res.json();
          setPrefs(data?.notifications || {});
        }
      } catch {}
    })();
  }, []);
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiProxyFetch('/api/proxy/auth/me/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifications: prefs }),
      });
      if (!res.ok) throw new Error('Failed');
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
    } finally {
      setSaving(false);
    }
  };
  const allOn = [...emailToggles, ...inAppToggles].every((t) => prefs[t.key]);
  const toggleAll = (v: boolean) => {
    const next: Record<string, boolean> = {};
    [...emailToggles, ...inAppToggles].forEach((t) => (next[t.key] = v));
    setPrefs(next);
  };
  return (
    <div className="space-y-6">
      {' '}
      <div className="flex gap-4">
        {' '}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {' '}
          <Bell className="h-5 w-5" />{' '}
        </div>{' '}
        <div className="flex-1">
          {' '}
          <h1 className="text-xl font-semibold tracking-tight">Notifications</h1>{' '}
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Choose how you want to be notified.
          </p>{' '}
        </div>{' '}
        <Button
          variant="outline"
          size="sm"
          onClick={() => toggleAll(!allOn)}
          className="hidden h-8 rounded-full sm:flex"
        >
          {' '}
          {allOn ? 'Disable all' : 'Enable all'}{' '}
        </Button>{' '}
      </div>{' '}
      {saved && (
        <div className="flex gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <Check className="h-4 w-4 shrink-0 mt-0.5" /> Preferences saved.
        </div>
      )}{' '}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {' '}
        <div className="border-b border-border/60 bg-muted/20 px-6 py-4">
          {' '}
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-card shadow-sm ring-1 ring-border">
              <Mail className="h-3.5 w-3.5" />
            </span>{' '}
            Email Notifications
          </h2>{' '}
        </div>{' '}
        <div className="divide-y divide-border/60">
          {' '}
          {emailToggles.map((t) => (
            <label
              key={t.key}
              className="flex cursor-pointer items-center justify-between gap-4 px-6 py-4 transition hover:bg-muted/20"
            >
              {' '}
              <div>
                {' '}
                <p className="text-sm font-medium">{t.label}</p>{' '}
                <p className="text-xs text-muted-foreground">{t.desc}</p>{' '}
              </div>{' '}
              <Toggle
                checked={!!prefs[t.key]}
                onChange={(v) => setPrefs({ ...prefs, [t.key]: v })}
              />{' '}
            </label>
          ))}{' '}
        </div>{' '}
      </div>{' '}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {' '}
        <div className="border-b border-border/60 bg-muted/20 px-6 py-4">
          {' '}
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-card shadow-sm ring-1 ring-border">
              <MessageSquare className="h-3.5 w-3.5" />
            </span>{' '}
            In-App Notifications
          </h2>{' '}
        </div>{' '}
        <div className="divide-y divide-border/60">
          {' '}
          {inAppToggles.map((t) => (
            <label
              key={t.key}
              className="flex cursor-pointer items-center justify-between gap-4 px-6 py-4 transition hover:bg-muted/20"
            >
              {' '}
              <div>
                {' '}
                <p className="text-sm font-medium">{t.label}</p>{' '}
                <p className="text-xs text-muted-foreground">{t.desc}</p>{' '}
              </div>{' '}
              <Toggle
                checked={!!prefs[t.key]}
                onChange={(v) => setPrefs({ ...prefs, [t.key]: v })}
              />{' '}
            </label>
          ))}{' '}
        </div>{' '}
      </div>{' '}
      <div className="sticky bottom-4 flex justify-end rounded-2xl border border-border bg-white px-4 py-3 shadow-lg">
        {' '}
        <Button onClick={handleSave} disabled={saving} className="h-9 rounded-full px-6 shadow-md">
          {' '}
          {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save Preferences'}{' '}
        </Button>{' '}
      </div>{' '}
    </div>
  );
}
