'use client';
import { useEffect, useMemo, useState } from 'react';
import { FONT_KEYS, FONT_LABELS, DEFAULT_THEME_TOKENS } from '@titan/shared';
import type { ColorSet, FontKey, ThemeTokens } from '@titan/shared';
import { apiProxyFetch } from '@/hooks/use-api-proxy';
import { themeTokensToInlineVars } from '@/lib/builder/theme-css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Loader2,
  Save,
  Rocket,
  RotateCcw,
  History,
  AlertCircle,
  Check,
  Palette,
  Type,
  Sparkles,
  Monitor,
  Moon,
  Sun,
  X,
  Copy,
  Eye,
  Sliders,
  Paintbrush,
} from 'lucide-react';
interface ThemeRecord {
  id: string;
  name: string;
  tokens: ThemeTokens;
  status: 'draft' | 'published';
  version: number;
  publishedAt: string | null;
}
interface ThemeVersionRecord {
  id: string;
  version: number;
  status: 'snapshot' | 'published';
  changedByName: string | null;
  createdAt: string;
}
const COLOR_GROUPS: { title: string; keys: (keyof ColorSet)[] }[] = [
  { title: 'Surfaces', keys: ['background', 'card', 'muted'] },
  { title: 'Text', keys: ['foreground', 'cardForeground', 'mutedForeground'] },
  { title: 'Borders & Accents', keys: ['border', 'ring'] },
  { title: 'Brand', keys: ['primary', 'secondary', 'accent'] },
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
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <div className="group relative flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-2.5 transition hover:border-border hover:bg-muted/30 hover:shadow-sm">
      {' '}
      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-border shadow-sm">
        {' '}
        <div className="absolute inset-0" style={{ backgroundColor: value }} />{' '}
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={`Pick ${label} color`}
        />{' '}
      </div>{' '}
      <div className="min-w-0 flex-1">
        {' '}
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>{' '}
        <p className="font-mono text-xs font-medium text-foreground">{value}</p>{' '}
      </div>{' '}
      <div className="flex items-center gap-1">
        {' '}
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-[84px] rounded-lg border-border/60 bg-background px-2 font-mono text-[11px] focus:border-primary"
        />{' '}
        <button
          type="button"
          onClick={copy}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-background text-muted-foreground transition hover:bg-muted hover:text-foreground"
          title="Copy hex"
        >
          {' '}
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-600" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}{' '}
        </button>{' '}
      </div>{' '}
    </div>
  );
}
function SectionCard({
  icon: Icon,
  title,
  description,
  children,
  action,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      {' '}
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
        {' '}
        <div className="flex items-center gap-3">
          {' '}
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {' '}
            <Icon className="h-4 w-4" />{' '}
          </div>{' '}
          <div>
            {' '}
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>{' '}
            {description && <p className="text-xs text-muted-foreground">{description}</p>}{' '}
          </div>{' '}
        </div>{' '}
        {action}{' '}
      </div>{' '}
      <div className="p-5">{children}</div>{' '}
    </div>
  );
}
export function ThemeEditor() {
  const [theme, setTheme] = useState<ThemeRecord | null>(null);
  const [tokens, setTokens] = useState<ThemeTokens>(DEFAULT_THEME_TOKENS);
  const [previewMode, setPreviewMode] = useState<'light' | 'dark'>('light');
  const [activeColorMode, setActiveColorMode] = useState<'light' | 'dark'>('light');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [versions, setVersions] = useState<ThemeVersionRecord[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await apiProxyFetch('/api/proxy/builder/themes');
        if (!res.ok) throw new Error('Failed to load theme');
        const body = (await res.json()) as ThemeRecord;
        setTheme(body);
        setTokens(body.tokens);
      } catch (err) {
        setMessage({
          type: 'err',
          text: err instanceof Error ? err.message : 'Failed to load theme',
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  const dirty = useMemo(
    () => !!theme && JSON.stringify(theme.tokens) !== JSON.stringify(tokens),
    [theme, tokens],
  );
  const previewVars = useMemo(
    () => themeTokensToInlineVars(tokens, previewMode),
    [tokens, previewMode],
  );
  const activeColors = activeColorMode === 'light' ? tokens.light : tokens.dark;
  const saveDraft = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await apiProxyFetch('/api/proxy/builder/themes', {
        method: 'PUT',
        body: JSON.stringify({ tokens, name: theme?.name }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || 'Save failed');
      }
      setTheme((await res.json()) as ThemeRecord);
      setMessage({ type: 'ok', text: 'Draft saved — your changes are live in preview' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  };
  const publish = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await apiProxyFetch('/api/proxy/builder/themes/publish', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || 'Publish failed');
      }
      setTheme((await res.json()) as ThemeRecord);
      setMessage({ type: 'ok', text: 'Theme published — live for all visitors' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Publish failed' });
    } finally {
      setSaving(false);
    }
  };
  const reset = async () => {
    if (!window.confirm('Reset the theme to defaults? Current draft will be replaced.')) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await apiProxyFetch('/api/proxy/builder/themes/reset', { method: 'POST' });
      if (!res.ok) throw new Error('Reset failed');
      const body = (await res.json()) as ThemeRecord;
      setTheme(body);
      setTokens(body.tokens);
      setMessage({ type: 'ok', text: 'Theme reset to defaults' });
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Reset failed' });
    } finally {
      setSaving(false);
    }
  };
  const openVersions = async () => {
    try {
      const res = await apiProxyFetch('/api/proxy/builder/themes/versions');
      if (!res.ok) throw new Error('Failed to load versions');
      setVersions((await res.json()) as ThemeVersionRecord[]);
      setShowVersions(true);
    } catch (err) {
      setMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to load versions',
      });
    }
  };
  const revert = async (version: number) => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await apiProxyFetch('/api/proxy/builder/themes/revert', {
        method: 'POST',
        body: JSON.stringify({ version }),
      });
      if (!res.ok) throw new Error('Revert failed');
      const body = (await res.json()) as ThemeRecord;
      setTheme(body);
      setTokens(body.tokens);
      setShowVersions(false);
      setMessage({ type: 'ok', text: `Restored theme version ${version}` });
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Revert failed' });
    } finally {
      setSaving(false);
    }
  };
  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
        {' '}
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          {' '}
          <Loader2 className="h-6 w-6 animate-spin text-primary" />{' '}
        </div>{' '}
        <div className="text-center">
          {' '}
          <p className="text-sm font-medium text-foreground">Loading theme</p>{' '}
          <p className="text-xs text-muted-foreground">Fetching your design tokens…</p>{' '}
        </div>{' '}
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#050a18]">
      {' '}
      {/* Header — Apple-style toolbar */}{' '}
      <div className="sticky top-0 z-30 -mx-4 -mt-4 border-b border-border/80 bg-background/85 backdrop-blur-xl sm:-mx-6 sm:-mt-6 lg:-ml-20 lg:-mr-8 lg:-mt-8">
        {' '}
        <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-4 py-3 sm:px-6">
          {' '}
          <div className="flex items-center gap-3">
            {' '}
            <div className="hidden h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-indigo-500 text-white shadow-lg shadow-primary/20 sm:flex">
              {' '}
              <Palette className="h-5 w-5" />{' '}
            </div>{' '}
            <div className="min-w-0">
              {' '}
              <div className="flex items-center gap-2">
                {' '}
                <h1 className="truncate text-[15px] font-semibold tracking-tight text-foreground">
                  Theme Editor
                </h1>{' '}
                <span
                  className={`hidden items-center gap-1.5 rounded-md px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-widest sm:inline-flex ${dirty ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : theme?.status === 'published' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}
                >
                  {' '}
                  <span className="relative flex h-1.5 w-1.5">
                    {' '}
                    <span
                      className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${dirty || theme?.status !== 'published' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    />{' '}
                    <span
                      className={`relative inline-flex h-1.5 w-1.5 rounded-full ${dirty || theme?.status !== 'published' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    />{' '}
                  </span>{' '}
                  {dirty
                    ? 'Unsaved'
                    : theme?.status === 'published'
                      ? `Published v${theme?.version}`
                      : 'Draft'}{' '}
                </span>{' '}
              </div>{' '}
              <p className="hidden truncate text-xs text-muted-foreground sm:block">
                {' '}
                {theme?.name} · {dirty ? 'You have unsaved changes' : 'All changes saved'}{' '}
                {theme && theme.version > 0 ? `· v${theme.version}` : ''}{' '}
              </p>{' '}
            </div>{' '}
          </div>{' '}
          <div className="ml-auto flex items-center gap-1.5">
            {' '}
            <div className="hidden items-center gap-1 lg:flex">
              {' '}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void openVersions()}
                className="h-8 gap-1.5 rounded-md px-3 text-xs font-medium"
              >
                {' '}
                <History className="h-3.5 w-3.5" /> Versions{' '}
              </Button>{' '}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void reset()}
                disabled={saving}
                className="h-8 gap-1.5 rounded-md px-3 text-xs font-medium"
              >
                {' '}
                <RotateCcw className="h-3.5 w-3.5" /> Reset{' '}
              </Button>{' '}
              <div className="mx-1 h-5 w-px bg-border" />{' '}
            </div>{' '}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void saveDraft()}
              disabled={saving || !dirty}
              className="h-8 rounded-md border-border bg-card px-4 text-xs font-semibold shadow-sm hover:bg-muted disabled:opacity-40"
            >
              {' '}
              {saving ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-3.5 w-3.5" />
              )}{' '}
              <span className="hidden sm:inline">Save Draft</span>{' '}
              <span className="sm:hidden">Save</span>{' '}
            </Button>{' '}
            <Button
              size="sm"
              onClick={() => void publish()}
              disabled={saving}
              className="h-8 rounded-md bg-primary px-4 text-xs font-semibold text-white shadow-md hover:bg-primary/90"
            >
              {' '}
              <Rocket className="mr-1.5 h-3.5 w-3.5" /> Publish{' '}
            </Button>{' '}
          </div>{' '}
        </div>{' '}
      </div>{' '}
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        {' '}
        {/* Mobile secondary actions */}{' '}
        <div className="mb-4 flex items-center gap-2 lg:hidden">
          {' '}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void openVersions()}
            className="h-8 flex-1 rounded-xl text-xs"
          >
            {' '}
            <History className="mr-1.5 h-3.5 w-3.5" /> Versions{' '}
          </Button>{' '}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void reset()}
            disabled={saving}
            className="h-8 flex-1 rounded-xl text-xs"
          >
            {' '}
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset{' '}
          </Button>{' '}
        </div>{' '}
        {message && (
          <div
            className={`mb-6 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-sm ${message.type === 'ok' ? 'border-emerald-500/20 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-red-500/20 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'}`}
          >
            {' '}
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full ${message.type === 'ok' ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}
            >
              {' '}
              {message.type === 'ok' ? (
                <Check className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}{' '}
            </div>{' '}
            <p className="flex-1 text-sm font-medium">{message.text}</p>{' '}
            <button
              onClick={() => setMessage(null)}
              className="rounded-full p-1 hover:bg-muted/50"
            >
              {' '}
              <X className="h-4 w-4" />{' '}
            </button>{' '}
          </div>
        )}{' '}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
          {' '}
          {/* Left: Controls */}{' '}
          <div className="space-y-5">
            {' '}
            {/* Typography */}{' '}
            <SectionCard icon={Type} title="Typography" description="Fonts used across your site">
              {' '}
              <div className="grid grid-cols-2 gap-3">
                {' '}
                {(
                  [
                    ['sans', 'Body'],
                    ['display', 'Display'],
                  ] as const
                ).map(([field, label]) => (
                  <div key={field} className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    {' '}
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {label}
                    </label>{' '}
                    <select
                      value={tokens.fonts[field]}
                      onChange={(e) =>
                        setTokens((t) => ({
                          ...t,
                          fonts: { ...t.fonts, [field]: e.target.value as FontKey },
                        }))
                      }
                      className="h-9 w-full rounded-lg border border-border bg-card px-2.5 text-sm font-medium outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                      {' '}
                      {FONT_KEYS.map((key) => (
                        <option key={key} value={key}>
                          {' '}
                          {FONT_LABELS[key]}{' '}
                        </option>
                      ))}{' '}
                    </select>{' '}
                    <p
                      className="mt-2 truncate text-[11px] text-muted-foreground"
                      style={{
                        fontFamily: `var(--font-${field === 'sans' ? 'outfit' : 'garamond'})`,
                      }}
                    >
                      {' '}
                      Ag · The quick fox{' '}
                    </p>{' '}
                  </div>
                ))}{' '}
              </div>{' '}
            </SectionCard>{' '}
            {/* Layout */}{' '}
            <SectionCard icon={Sliders} title="Layout" description="Spacing and shape">
              {' '}
              <div className="grid grid-cols-3 gap-3">
                {' '}
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                  {' '}
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Radius
                  </label>{' '}
                  <div className="flex items-center gap-2">
                    {' '}
                    <Input
                      type="number"
                      min={0}
                      max={32}
                      value={tokens.radius}
                      onChange={(e) => setTokens((t) => ({ ...t, radius: Number(e.target.value) }))}
                      className="h-9 flex-1 rounded-lg border-border bg-card text-center font-mono text-sm"
                    />{' '}
                    <span className="text-xs text-muted-foreground">px</span>{' '}
                  </div>{' '}
                  <div className="mt-3 flex justify-center">
                    {' '}
                    <div
                      className="h-12 w-12 border-2 border-primary/30 bg-primary/10"
                      style={{ borderRadius: tokens.radius }}
                    />{' '}
                  </div>{' '}
                </div>{' '}
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                  {' '}
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Blur
                  </label>{' '}
                  <Input
                    type="number"
                    min={0}
                    max={64}
                    value={tokens.glass.blur}
                    onChange={(e) =>
                      setTokens((t) => ({
                        ...t,
                        glass: { ...t.glass, blur: Number(e.target.value) },
                      }))
                    }
                    className="h-9 rounded-lg border-border bg-card text-center font-mono text-sm"
                  />{' '}
                  <div className="mt-3 flex justify-center">
                    {' '}
                    <div
                      className="h-12 w-12 rounded-xl border border-border bg-white"
                      style={{ backdropFilter: `blur(${tokens.glass.blur}px)` }}
                    />{' '}
                  </div>{' '}
                </div>{' '}
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                  {' '}
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Opacity
                  </label>{' '}
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={tokens.glass.opacity}
                    onChange={(e) =>
                      setTokens((t) => ({
                        ...t,
                        glass: { ...t.glass, opacity: Number(e.target.value) },
                      }))
                    }
                    className="h-9 rounded-lg border-border bg-card text-center font-mono text-sm"
                  />{' '}
                  <div className="mt-3 flex items-center gap-1">
                    {' '}
                    <div className="h-1.5 flex-1 rounded-md bg-muted">
                      {' '}
                      <div
                        className="h-1.5 rounded-md bg-primary transition-all"
                        style={{ width: `${tokens.glass.opacity}%` }}
                      />{' '}
                    </div>{' '}
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {tokens.glass.opacity}%
                    </span>{' '}
                  </div>{' '}
                </div>{' '}
              </div>{' '}
            </SectionCard>{' '}
            {/* Colors */}{' '}
            <div className="rounded-xl border border-border bg-card shadow-sm">
              {' '}
              <div className="border-b border-border/60 px-5 py-4">
                {' '}
                <div className="flex items-center gap-3">
                  {' '}
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {' '}
                    <Palette className="h-4 w-4" />{' '}
                  </div>{' '}
                  <div>
                    {' '}
                    <h3 className="text-sm font-semibold text-foreground">Colors</h3>{' '}
                    <p className="text-xs text-muted-foreground">Light & dark palettes</p>{' '}
                  </div>{' '}
                </div>{' '}
                <div className="mt-4 flex gap-1.5 rounded-md bg-muted p-1">
                  {' '}
                  <button
                    onClick={() => setActiveColorMode('light')}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${activeColorMode === 'light' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {' '}
                    <Sun className="h-3.5 w-3.5" /> Light{' '}
                  </button>{' '}
                  <button
                    onClick={() => setActiveColorMode('dark')}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${activeColorMode === 'dark' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {' '}
                    <Moon className="h-3.5 w-3.5" /> Dark{' '}
                  </button>{' '}
                </div>{' '}
              </div>{' '}
              {/* Palette overview */}{' '}
              <div className="border-b border-border/60 bg-muted/20 px-5 py-4">
                {' '}
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Palette
                </p>{' '}
                <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-11">
                  {' '}
                  {(Object.keys(activeColors) as (keyof ColorSet)[]).map((key) => (
                    <div key={key} className="group relative">
                      {' '}
                      <div
                        className="h-8 w-full rounded-lg border border-border shadow-sm transition group-hover:scale-105 group-hover:shadow-md sm:h-9"
                        style={{ backgroundColor: activeColors[key] }}
                        title={`${COLOR_LABELS[key]}: ${activeColors[key]}`}
                      />{' '}
                      <p className="mt-1 truncate text-center text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                        {key.slice(0, 4)}
                      </p>{' '}
                    </div>
                  ))}{' '}
                </div>{' '}
              </div>{' '}
              <div className="space-y-6 p-5">
                {' '}
                {COLOR_GROUPS.map((group) => (
                  <div key={group.title}>
                    {' '}
                    <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      {' '}
                      <span className="h-px flex-1 bg-border/60" /> {group.title}{' '}
                      <span className="h-px flex-1 bg-border/60" />{' '}
                    </h4>{' '}
                    <div className="space-y-2">
                      {' '}
                      {group.keys.map((key) => (
                        <ColorSwatch
                          key={`${activeColorMode}-${key}`}
                          label={COLOR_LABELS[key]}
                          value={activeColors[key]}
                          onChange={(v) =>
                            setTokens((t) => ({
                              ...t,
                              [activeColorMode]: { ...t[activeColorMode], [key]: v },
                            }))
                          }
                        />
                      ))}{' '}
                    </div>{' '}
                  </div>
                ))}{' '}
              </div>{' '}
            </div>{' '}
            {/* Quick tips */}{' '}
            <div className="rounded-xl border border-primary/15 bg-primary/[0.04] p-4">
              {' '}
              <div className="flex gap-3">
                {' '}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {' '}
                  <Sparkles className="h-4 w-4" />{' '}
                </div>{' '}
                <div>
                  {' '}
                  <p className="text-sm font-semibold text-foreground">Live preview</p>{' '}
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {' '}
                    Colors update instantly in the preview on the right. Save as draft to keep
                    changes without publishing, or publish to make them live.{' '}
                  </p>{' '}
                </div>{' '}
              </div>{' '}
            </div>{' '}
          </div>{' '}
          {/* Right: Preview */}{' '}
          <div className="min-w-0 xl:sticky xl:top-[76px] xl:self-start">
            {' '}
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              {' '}
              <div className="flex items-center justify-between border-b border-border bg-muted/20 px-4 py-3">
                {' '}
                <div className="flex items-center gap-2">
                  {' '}
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-card text-muted-foreground shadow-sm">
                    {' '}
                    <Eye className="h-3.5 w-3.5" />{' '}
                  </div>{' '}
                  <div>
                    {' '}
                    <h3 className="text-sm font-semibold leading-none text-foreground">
                      Live Preview
                    </h3>{' '}
                    <p className="text-[11px] text-muted-foreground">Updates as you edit</p>{' '}
                  </div>{' '}
                </div>{' '}
                <div className="flex items-center gap-2">
                  {' '}
                  <div className="flex rounded-md border border-border bg-card p-0.5 shadow-sm">
                    {' '}
                    {(['light', 'dark'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setPreviewMode(mode)}
                        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition ${previewMode === mode ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        {' '}
                        {mode === 'light' ? (
                          <Sun className="h-3 w-3" />
                        ) : (
                          <Moon className="h-3 w-3" />
                        )}{' '}
                        {mode}{' '}
                      </button>
                    ))}{' '}
                  </div>{' '}
                </div>{' '}
              </div>{' '}
              {/* Stage — dotted like builder canvas */}{' '}
              <div className="bg-[#f8f9fa] p-3 dark:bg-[#050a18] sm:p-6">
                {' '}
                <div
                  className="mx-auto overflow-hidden rounded-[20px] border border-border bg-card shadow-sm"
                  style={{ maxWidth: 720 }}
                >
                  {' '}
                  <div
                    className="min-h-[520px] p-6 sm:p-8"
                    style={previewVars as React.CSSProperties}
                  >
                    {' '}
                    {/* Mock site */}{' '}
                    <div className="space-y-8">
                      {' '}
                      {/* Nav */}{' '}
                      <div className="flex items-center justify-between">
                        {' '}
                        <div className="flex items-center gap-2">
                          {' '}
                          <div
                            className="h-8 w-8 rounded-lg"
                            style={{ backgroundColor: 'var(--primary)' }}
                          />{' '}
                          <span
                            className="text-sm font-bold tracking-tight"
                            style={{ fontFamily: 'var(--font-family-display)' }}
                          >
                            {' '}
                            Ahmad CNC{' '}
                          </span>{' '}
                        </div>{' '}
                        <div className="hidden items-center gap-1.5 sm:flex">
                          {' '}
                          <span className="rounded-md bg-muted px-3 py-1 text-[11px] font-medium">
                            Academy
                          </span>{' '}
                          <span className="rounded-md bg-muted px-3 py-1 text-[11px] font-medium">
                            Workshops
                          </span>{' '}
                          <span
                            className="rounded-md px-3 py-1 text-[11px] font-bold text-white"
                            style={{ backgroundColor: 'var(--primary)' }}
                          >
                            {' '}
                            Enroll{' '}
                          </span>{' '}
                        </div>{' '}
                        <div className="h-6 w-6 rounded-md bg-muted sm:hidden" />{' '}
                      </div>{' '}
                      {/* Hero */}{' '}
                      <div
                        className="rounded-[var(--border-radius)] p-6 sm:p-8"
                        style={{
                          backgroundColor: 'var(--primary)',
                          borderRadius: 'var(--border-radius)',
                        }}
                      >
                        {' '}
                        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/60">
                          Design · Build · Manufacture
                        </p>{' '}
                        <h2
                          className="mt-2 max-w-[18ch] text-2xl font-semibold leading-tight text-white sm:text-3xl"
                          style={{ fontFamily: 'var(--font-family-display)' }}
                        >
                          {' '}
                          Engineering precision at every layer{' '}
                        </h2>{' '}
                        <p className="mt-2 max-w-md text-sm leading-relaxed text-white/80">
                          Tokens drive every surface — try switching light/dark or tweaking the
                          primary color.
                        </p>{' '}
                        <div className="mt-5 flex flex-wrap gap-2.5">
                          {' '}
                          <span
                            className="inline-flex items-center justify-center rounded-md bg-white px-4 py-2 text-xs font-bold shadow-sm"
                            style={{
                              color: 'var(--primary)',
                              borderRadius: 'var(--border-radius)',
                            }}
                          >
                            {' '}
                            Primary action{' '}
                          </span>{' '}
                          <span className="inline-flex items-center justify-center rounded-md border border-border bg-white px-4 py-2 text-xs font-bold text-white">
                            {' '}
                            Secondary{' '}
                          </span>{' '}
                        </div>{' '}
                      </div>{' '}
                      {/* Feature grid */}{' '}
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {' '}
                        {[
                          { title: 'Precision', desc: 'Tolerances you can trust, every time.' },
                          { title: 'Speed', desc: 'From prototype to production in days.' },
                          { title: 'Support', desc: 'Expert guidance at every step.' },
                        ].map((f) => (
                          <div
                            key={f.title}
                            className="rounded-xl border bg-card p-4 shadow-sm transition hover:shadow-md"
                            style={{
                              borderColor: 'var(--border)',
                              borderRadius: 'var(--border-radius)',
                            }}
                          >
                            {' '}
                            <div
                              className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl text-white"
                              style={{ backgroundColor: 'var(--primary)' }}
                            >
                              {' '}
                              <Sparkles className="h-4 w-4" />{' '}
                            </div>{' '}
                            <p
                              className="text-sm font-semibold"
                              style={{ fontFamily: 'var(--font-family-sans)' }}
                            >
                              {' '}
                              {f.title}{' '}
                            </p>{' '}
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                              {f.desc}
                            </p>{' '}
                          </div>
                        ))}{' '}
                      </div>{' '}
                      {/* Tokens showcase */}{' '}
                      <div className="grid grid-cols-2 gap-3">
                        {' '}
                        <div
                          className="rounded-xl p-4"
                          style={{
                            backgroundColor: 'var(--muted)',
                            borderRadius: 'var(--border-radius)',
                          }}
                        >
                          {' '}
                          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                            Muted
                          </p>{' '}
                          <p className="mt-1 text-sm font-medium">Soft surfaces</p>{' '}
                          <div className="mt-3 h-1.5 w-full rounded-md bg-border">
                            {' '}
                            <div
                              className="h-1.5 rounded-full"
                              style={{ width: '62%', backgroundColor: 'var(--primary)' }}
                            />{' '}
                          </div>{' '}
                        </div>{' '}
                        <div
                          className="rounded-xl border p-4 shadow-sm"
                          style={{
                            backgroundColor: 'var(--card)',
                            borderColor: 'var(--border)',
                            borderRadius: 'var(--border-radius)',
                          }}
                        >
                          {' '}
                          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                            Card
                          </p>{' '}
                          <p className="mt-1 flex items-center gap-2 text-sm font-medium">
                            {' '}
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: 'var(--accent)' }}
                            />{' '}
                            Accent dot{' '}
                          </p>{' '}
                          <p className="mt-1 text-xs text-muted-foreground">
                            Border and ring use your accent.
                          </p>{' '}
                        </div>{' '}
                      </div>{' '}
                      {/* Glass preview */}{' '}
                      <div
                        className="relative overflow-hidden rounded-xl border p-4"
                        style={{
                          borderColor: 'var(--border)',
                          borderRadius: 'var(--border-radius)',
                        }}
                      >
                        {' '}
                        <div
                          className="absolute inset-0 opacity-30"
                          style={{
                            background: `linear-gradient(135deg, var(--primary), var(--accent))`,
                          }}
                        />{' '}
                        <div className="relative flex items-center gap-3">
                          {' '}
                          <div
                            className="flex h-10 w-10 items-center justify-center rounded-xl border text-white shadow-sm"
                            style={{
                              background: `rgba(255,255,255,${tokens.glass.opacity / 100})`,
                              backdropFilter: `blur(${tokens.glass.blur}px)`,
                              WebkitBackdropFilter: `blur(${tokens.glass.blur}px)`,
                              borderRadius: 'var(--border-radius)',
                            }}
                          >
                            {' '}
                            <Paintbrush
                              className="h-5 w-5"
                              style={{ color: 'var(--primary)' }}
                            />{' '}
                          </div>{' '}
                          <div>
                            {' '}
                            <p className="text-sm font-semibold">
                              Glass · {tokens.glass.blur}px / {tokens.glass.opacity}%
                            </p>{' '}
                            <p className="text-xs text-muted-foreground">
                              Blur and opacity for translucent surfaces
                            </p>{' '}
                          </div>{' '}
                        </div>{' '}
                      </div>{' '}
                      {/* Footer hint */}{' '}
                      <div
                        className="flex items-center justify-between rounded-md border bg-muted/40 px-4 py-2.5"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        {' '}
                        <p className="text-xs font-medium text-muted-foreground">
                          Footer · {tokens.fonts.sans} / {tokens.fonts.display}
                        </p>{' '}
                        <span className="hidden text-[11px] text-muted-foreground sm:block">
                          Radius: {tokens.radius}px
                        </span>{' '}
                      </div>{' '}
                    </div>{' '}
                  </div>{' '}
                </div>{' '}
              </div>{' '}
              <div className="flex items-center justify-center gap-1.5 border-t border-border bg-muted/20 px-4 py-2.5 text-[11px] text-muted-foreground">
                {' '}
                <Monitor className="h-3.5 w-3.5" /> Preview reflects your current {previewMode}{' '}
                palette{' '}
              </div>{' '}
            </div>{' '}
          </div>{' '}
        </div>{' '}
      </div>{' '}
      {/* Version history — slide-over */}{' '}
      {showVersions && (
        <>
          {' '}
          <div
            className="fixed inset-0 z-40 bg-gray-900"
            onClick={() => setShowVersions(false)}
          />{' '}
          <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[380px] flex-col border-l border-border bg-card shadow-sm">
            {' '}
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              {' '}
              <div className="flex items-center gap-2">
                {' '}
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {' '}
                  <History className="h-4 w-4" />{' '}
                </div>{' '}
                <div>
                  {' '}
                  <h3 className="text-sm font-semibold">Version history</h3>{' '}
                  <p className="text-xs text-muted-foreground">{versions.length} versions</p>{' '}
                </div>{' '}
              </div>{' '}
              <button
                onClick={() => setShowVersions(false)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {' '}
                <X className="h-4 w-4" />{' '}
              </button>{' '}
            </div>{' '}
            <div className="flex-1 overflow-auto p-3">
              {' '}
              {versions.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  {' '}
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                    {' '}
                    <History className="h-5 w-5 text-muted-foreground" />{' '}
                  </div>{' '}
                  <p className="text-sm font-medium text-foreground">No versions yet</p>{' '}
                  <p className="text-xs text-muted-foreground">
                    Publish to create the first snapshot.
                  </p>{' '}
                </div>
              ) : (
                <div className="space-y-2">
                  {' '}
                  {versions.map((v) => (
                    <div
                      key={v.id}
                      className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 transition hover:border-border hover:bg-muted/40"
                    >
                      {' '}
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted font-mono text-xs font-bold">
                        v{v.version}
                      </div>{' '}
                      <div className="min-w-0 flex-1">
                        {' '}
                        <p
                          className={`text-[11px] font-bold uppercase tracking-widest ${v.status === 'published' ? 'text-emerald-600' : 'text-muted-foreground'}`}
                        >
                          {' '}
                          {v.status}{' '}
                        </p>{' '}
                        <p className="truncate text-xs text-muted-foreground">
                          {v.changedByName || 'Unknown'} ·{' '}
                          {new Date(v.createdAt).toLocaleDateString()}
                        </p>{' '}
                      </div>{' '}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 rounded-md px-3 text-xs"
                        onClick={() => void revert(v.version)}
                        disabled={saving}
                      >
                        {' '}
                        Restore{' '}
                      </Button>{' '}
                    </div>
                  ))}{' '}
                </div>
              )}{' '}
            </div>{' '}
          </div>{' '}
        </>
      )}{' '}
    </div>
  );
}
