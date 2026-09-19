'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Palette, Sun, Moon, Monitor, Check, Paintbrush, LayoutGrid } from 'lucide-react';
import { apiProxyFetch } from '@/hooks/use-api-proxy';
export default function AppearancePage() {
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system');
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const res = await apiProxyFetch('/api/proxy/auth/me/preferences');
        if (res.ok) {
          const data = await res.json();
          if (data?.theme) setTheme(data.theme);
          if (data?.density) setDensity(data.density);
        }
      } catch {}
    })();
  }, []);
  const handleSave = async () => {
    setSaving(true);
    try {
      await apiProxyFetch('/api/proxy/auth/me/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme, density }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-6">
      {' '}
      <div className="flex gap-4">
        {' '}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {' '}
          <Palette className="h-5 w-5" />{' '}
        </div>{' '}
        <div>
          {' '}
          <h1 className="text-xl font-semibold tracking-tight">Appearance</h1>{' '}
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Customize how the app looks and feels.
          </p>{' '}
        </div>{' '}
      </div>{' '}
      {saved && (
        <div className="flex gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <Check className="h-4 w-4 shrink-0 mt-0.5" /> Appearance saved.
        </div>
      )}{' '}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {' '}
        <div className="border-b border-border/60 bg-muted/20 px-6 py-4">
          {' '}
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-card shadow-sm ring-1 ring-border">
              <Paintbrush className="h-3.5 w-3.5" />
            </span>{' '}
            Theme
          </h2>{' '}
          <p className="mt-1 text-xs text-muted-foreground">
            Choose your preferred color scheme.
          </p>{' '}
        </div>{' '}
        <div className="grid gap-3 p-6 sm:grid-cols-3">
          {' '}
          {[
            { id: 'system', label: 'System', desc: 'Follow OS', icon: Monitor },
            { id: 'light', label: 'Light', desc: 'Bright & clean', icon: Sun },
            { id: 'dark', label: 'Dark', desc: 'Easy on eyes', icon: Moon },
          ].map((opt) => {
            const active = theme === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setTheme(opt.id as any)}
                className={`relative flex flex-col items-center gap-3 rounded-2xl border-2 p-5 text-center transition ${active ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card hover:border-primary/30 hover:bg-muted/20'}`}
              >
                {' '}
                {active && (
                  <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                    <Check className="h-3 w-3" />
                  </span>
                )}{' '}
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${active ? 'bg-primary text-white shadow-md' : 'bg-muted text-muted-foreground'}`}
                >
                  {' '}
                  <opt.icon className="h-5 w-5" />{' '}
                </span>{' '}
                <span>
                  {' '}
                  <span className="block text-sm font-semibold">{opt.label}</span>{' '}
                  <span className="text-xs text-muted-foreground">{opt.desc}</span>{' '}
                </span>{' '}
                <span
                  className={`h-16 w-full rounded-xl border-2 ${active ? 'border-primary/20' : 'border-border'} overflow-hidden`}
                >
                  {' '}
                  <span
                    className={`block h-full w-full ${opt.id === 'dark' ? 'bg-zinc-900' : opt.id === 'light' ? 'bg-white' : 'bg-gradient-to-br from-white to-zinc-900'}`}
                  />{' '}
                </span>{' '}
              </button>
            );
          })}{' '}
        </div>{' '}
      </div>{' '}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {' '}
        <div className="border-b border-border/60 bg-muted/20 px-6 py-4">
          {' '}
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-card shadow-sm ring-1 ring-border">
              <LayoutGrid className="h-3.5 w-3.5" />
            </span>{' '}
            Density
          </h2>{' '}
          <p className="mt-1 text-xs text-muted-foreground">Adjust spacing and sizing.</p>{' '}
        </div>{' '}
        <div className="grid gap-3 p-6 sm:grid-cols-2">
          {' '}
          {[
            { id: 'comfortable', label: 'Comfortable', desc: 'Spacious, breathable', pad: 'p-4' },
            { id: 'compact', label: 'Compact', desc: 'Dense, information-rich', pad: 'p-2' },
          ].map((opt) => {
            const active = density === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setDensity(opt.id as any)}
                className={`rounded-2xl border-2 p-4 text-left transition ${active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/20'}`}
              >
                {' '}
                <span className="text-sm font-semibold">{opt.label}</span>{' '}
                <span className="block text-xs text-muted-foreground">{opt.desc}</span>{' '}
                <span className={`mt-3 block rounded-xl border bg-card ${opt.pad}`}>
                  {' '}
                  <span className="block h-2 w-3/4 rounded bg-muted" />{' '}
                  <span className="mt-2 block h-2 w-1/2 rounded bg-muted" />{' '}
                </span>{' '}
              </button>
            );
          })}{' '}
        </div>{' '}
      </div>{' '}
      <div className="sticky bottom-4 flex justify-end rounded-2xl border border-border bg-white px-4 py-3 shadow-lg">
        {' '}
        <Button onClick={handleSave} disabled={saving} className="h-9 rounded-full px-6 shadow-md">
          {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save Changes'}
        </Button>{' '}
      </div>{' '}
    </div>
  );
}
