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
  const [error, setError] = useState('');
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
    setError('');
    try {
      const res = await apiProxyFetch('/api/proxy/auth/me/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme, density }),
      });
      // This used to ignore res.ok entirely and swallow every error, so a 400/403/500
      // still rendered "Saved".
      const applied = res.ok ? await res.json().catch(() => null) : null;
      if (!applied) {
        const detail = await res.json().catch(() => null);
        throw new Error(typeof detail?.message === 'string' ? detail.message : 'Could not save appearance');
      }
      if (applied.theme !== theme || applied.density !== density) {
        throw new Error('Appearance settings were not applied. Please try again.');
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save appearance');
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
          <Palette className="size-5" />{' '}
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
        <div className="flex gap-2 rounded-2xl border border-success bg-success/10 px-4 py-3 text-sm text-success">
          <Check className="size-4 shrink-0 mt-0.5" /> Appearance saved.
        </div>
      )}{' '}
      {error && (
        <div
          role="alert"
          className="flex gap-2 rounded-2xl border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <Paintbrush className="size-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}{' '}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {' '}
        <div className="border-b border-border/60 bg-muted/20 px-6 py-4">
          {' '}
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex size-6 items-center justify-center rounded-lg bg-card shadow-sm ring-1 ring-border">
              <Paintbrush className="size-3.5" />
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
                  <span className="absolute end-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3.5" />
                  </span>
                )}{' '}
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${active ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted text-muted-foreground'}`}
                >
                  {' '}
                  <opt.icon className="size-5" />{' '}
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
                    className={`block h-full w-full ${opt.id === 'dark' ? 'bg-overlay' : opt.id === 'light' ? 'bg-card' : 'bg-gradient-to-br from-white to-overlay'}`}
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
            <span className="flex size-6 items-center justify-center rounded-lg bg-card shadow-sm ring-1 ring-border">
              <LayoutGrid className="size-3.5" />
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
      <div className="sticky bottom-4 flex justify-end rounded-2xl border border-border bg-card px-4 py-3 shadow-lg">
        {' '}
        <Button onClick={handleSave} disabled={saving} className="h-9 rounded-full px-6 shadow-md">
          {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save Changes'}
        </Button>{' '}
      </div>{' '}
    </div>
  );
}
