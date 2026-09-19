'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  X,
  Plus,
  Pencil,
  Power,
  Eye,
  Loader2,
  Palette,
  LayoutGrid,
  List as ListIcon,
  Copy,
  Check,
  Award,
  BadgeCheck,
  Sparkles,
  Type as TypeIcon,
  LayoutTemplate,
  Image as ImageIcon,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Layers,
  CircleDot,
} from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { RightSheet, RightSheetHeader } from '@/components/ui/right-sheet';
import { cn } from '@/lib/utils';
/* ---------------------------------- types --------------------------------- */ type TemplateField =
  {
    key: string;
    label: string;
    x: number;
    y: number;
    fontSize: number;
    fontWeight: string;
    color: string;
  };
type Template = {
  id: string;
  name: string;
  layout: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  backgroundUrl: string | null;
  fontFamily: string;
  fields: TemplateField[];
  isActive: boolean;
  createdAt: string;
};
const PAGE_SIZE = 12;
const VARIABLE_OPTIONS = [
  {
    key: 'learnerName',
    label: 'Learner name',
    sample: 'Alex Johnson',
    hint: 'Recipient full name',
  },
  {
    key: 'courseTitle',
    label: 'Course title',
    sample: 'Advanced CNC Machining',
    hint: 'Completed course',
  },
  {
    key: 'issueDate',
    label: 'Issue date',
    sample: new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
    hint: 'Date of issuance',
  },
  {
    key: 'certificateNumber',
    label: 'Certificate no.',
    sample: 'TMF-2025-123456',
    hint: 'Unique number',
  },
  { key: 'tenantName', label: 'Academy name', sample: 'TITANS Academy', hint: 'Your organisation' },
] as const;
const SAMPLE_MAP: Record<string, string> = Object.fromEntries(
  VARIABLE_OPTIONS.map((v) => [v.key, v.sample]),
);
const LAYOUTS = [
  {
    key: 'modern',
    label: 'Modern',
    desc: 'Bold gradient band, geometric corners',
    tag: 'Most popular',
  },
  { key: 'classic', label: 'Classic', desc: 'Double gold frame, centred seal', tag: 'Formal' },
  { key: 'minimal', label: 'Minimal', desc: 'Hairline frame, generous whitespace', tag: 'Clean' },
] as const;
const FONTS = [
  { key: 'Inter', label: 'Inter', desc: 'Geometric sans', stack: 'Inter, system-ui, sans-serif' },
  {
    key: 'Playfair Display',
    label: 'Playfair',
    desc: 'Elegant serif',
    stack: '"Playfair Display", Georgia, serif',
  },
  {
    key: 'DM Sans',
    label: 'DM Sans',
    desc: 'Friendly sans',
    stack: '"DM Sans", Inter, sans-serif',
  },
  {
    key: 'Georgia',
    label: 'Georgia',
    desc: 'Classic serif',
    stack: 'Georgia, "Times New Roman", serif',
  },
  {
    key: 'monospace',
    label: 'Mono',
    desc: 'Technical',
    stack: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
] as const;
const SWATCHES = [
  '#7c3aed',
  '#4f46e5',
  '#0ea5e9',
  '#0d9488',
  '#16a34a',
  '#ca8a04',
  '#b45309',
  '#0a1628',
  '#be123c',
  '#111827',
];
const PRESETS: Array<{
  name: string;
  layout: string;
  primary: string;
  secondary: string;
  font: string;
}> = [
  {
    name: 'Royal Violet',
    layout: 'modern',
    primary: '#7c3aed',
    secondary: '#0a1628',
    font: 'Inter',
  },
  {
    name: 'Heritage Gold',
    layout: 'classic',
    primary: '#b45309',
    secondary: '#1c1917',
    font: 'Playfair Display',
  },
  {
    name: 'Arctic Minimal',
    layout: 'minimal',
    primary: '#0f766e',
    secondary: '#334155',
    font: 'DM Sans',
  },
];
const GLASS = 'border border-border bg-card';
const CARD = 'border border-border bg-card';
function fontStack(fontFamily: string) {
  return FONTS.find((f) => f.key === fontFamily)?.stack ?? fontFamily ?? 'Inter, sans-serif';
}
/* --------------------------- certificate artwork --------------------------- */ function Medal({
  color,
}: {
  color: string;
}) {
  return (
    <span
      className="flex h-9 w-9 items-center justify-center rounded-full text-white shadow-md ring-4 ring-white/70"
      style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
    >
      {' '}
      <Award className="h-4.5 w-4.5" strokeWidth={1.8} />{' '}
    </span>
  );
}
function CertificateArt({
  template,
  showAnchors = false,
  compact = false,
}: {
  template: Partial<Template>;
  showAnchors?: boolean;
  compact?: boolean;
}) {
  const primary = template.primaryColor || '#7c3aed';
  const secondary = template.secondaryColor || '#0a1628';
  const layout = template.layout || 'modern';
  const fields = template.fields ?? [];
  const stack = fontStack(template.fontFamily || 'Inter');
  return (
    <div
      className="relative select-none overflow-hidden bg-white text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
      style={{ aspectRatio: '1.414 / 1', fontFamily: stack, background: '#fff' }}
    >
      {' '}
      {/* paper wash + background image */}{' '}
      {template.backgroundUrl /* eslint-disable-next-line @next/next/no-img-element */ ? (
        <img
          src={template.backgroundUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover opacity-[0.14]"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(120% 90% at 50% 0%, ${primary}0f 0%, transparent 55%), radial-gradient(100% 80% at 100% 100%, ${primary}12 0%, transparent 50%)`,
          }}
        />
      )}{' '}
      {/* layout ornaments */}{' '}
      {layout === 'modern' && (
        <>
          {' '}
          <div
            className="absolute inset-x-0 top-0 h-[7px]"
            style={{
              background: `linear-gradient(90deg, ${primary}, ${primary}99 45%, ${secondary})`,
            }}
          />{' '}
          <div
            className="absolute -left-8 -top-8 h-28 w-28 rounded-full opacity-[0.10]"
            style={{ background: primary }}
          />{' '}
          <div
            className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full opacity-[0.08]"
            style={{ background: secondary }}
          />{' '}
        </>
      )}{' '}
      {layout === 'classic' && (
        <>
          {' '}
          <div
            className="absolute inset-2 rounded-[4px] border opacity-70"
            style={{ borderColor: `${primary}55` }}
          />{' '}
          <div
            className="absolute inset-3.5 rounded-[3px] border"
            style={{ borderColor: `${primary}88` }}
          />{' '}
          <div
            className="absolute left-1/2 top-2 h-1.5 w-16 -translate-x-1/2 rounded-full"
            style={{ background: `linear-gradient(90deg, transparent, ${primary}, transparent)` }}
          />{' '}
        </>
      )}{' '}
      {layout === 'minimal' && (
        <div className="absolute inset-3 rounded-[3px] border border-border" />
      )}{' '}
      {/* content */}{' '}
      <div
        className={cn(
          'relative flex h-full flex-col items-center px-[7%] text-center',
          compact ? 'py-[5%]' : 'py-[6%]',
        )}
      >
        {' '}
        {template.logoUrl /* eslint-disable-next-line @next/next/no-img-element */ ? (
          <img
            src={template.logoUrl}
            alt="logo"
            className={cn('object-contain', compact ? 'mb-1 h-5' : 'mb-1.5 h-7')}
          />
        ) : (
          <Medal color={primary} />
        )}{' '}
        <p
          className={cn(
            'font-semibold uppercase',
            compact ? 'mt-1 text-[7px] tracking-[0.28em]' : 'mt-1.5 text-[8px] tracking-[0.32em]',
          )}
          style={{ color: secondary }}
        >
          {' '}
          Certificate of Completion{' '}
        </p>{' '}
        <div className="mt-1 flex items-center gap-2" aria-hidden>
          {' '}
          <span className="h-px w-10 opacity-40" style={{ background: primary }} />{' '}
          <span className="h-1 w-1 rotate-45 opacity-70" style={{ background: primary }} />{' '}
          <span className="h-px w-10 opacity-40" style={{ background: primary }} />{' '}
        </div>{' '}
        {/* dynamic fields placed at configured x/y */}{' '}
        <div className="relative mt-1 w-full flex-1">
          {' '}
          {fields.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {' '}
              <p
                className={cn('font-bold leading-tight', compact ? 'text-base' : 'text-[22px]')}
                style={{ color: primary, fontFamily: stack }}
              >
                {' '}
                {template.name || 'Certificate of Excellence'}{' '}
              </p>{' '}
              <p
                className={cn('mt-1 font-medium', compact ? 'text-[8px]' : 'text-[10px]')}
                style={{ color: `${secondary}b3` }}
              >
                {' '}
                {SAMPLE_MAP.courseTitle} · {SAMPLE_MAP.learnerName}{' '}
              </p>{' '}
            </div>
          ) : (
            fields.map((f, i) => {
              const sample = SAMPLE_MAP[f.key] ?? f.label ?? f.key;
              const isHero = f.key === 'learnerName';
              return (
                <div
                  key={`${f.key}-${i}`}
                  className="absolute max-w-[92%] whitespace-nowrap"
                  style={{ left: `${f.x}%`, top: `${f.y}%`, transform: 'translate(-50%, -50%)' }}
                >
                  {' '}
                  <span
                    className={cn(
                      'inline-block truncate leading-tight',
                      showAnchors && 'rounded px-1 ring-1 ring-dashed ring-blue-500/60',
                    )}
                    style={{
                      fontSize: `clamp(6px, ${(f.fontSize / 64) * 10}cqw, ${compact ? Math.min(f.fontSize, 15) : f.fontSize}px)`,
                      fontWeight: f.fontWeight as any,
                      color: f.color,
                      fontFamily:
                        isHero && layout === 'classic'
                          ? '"Playfair Display", Georgia, serif'
                          : stack,
                      fontStyle: isHero ? undefined : undefined,
                    }}
                  >
                    {' '}
                    {sample}{' '}
                  </span>{' '}
                  {showAnchors && (
                    <span className="mx-auto mt-0.5 block h-1 w-1 rounded-md bg-blue-600" />
                  )}{' '}
                </div>
              );
            })
          )}{' '}
        </div>{' '}
        {/* footer */}{' '}
        <div className="flex w-full items-end justify-between gap-2">
          {' '}
          <div className="flex-1 text-left">
            {' '}
            <div className="h-px w-16 bg-muted" />{' '}
            <p className="mt-1 text-[6px] font-semibold uppercase tracking-[0.18em] text-black/45">
              Program director
            </p>{' '}
          </div>{' '}
          <div className="flex flex-col items-center">
            {' '}
            <span
              className="flex h-7 w-7 items-center justify-center rounded-md border-2 text-[8px] font-bold text-white shadow"
              style={{
                borderColor: `${primary}33`,
                background: `linear-gradient(135deg, ${primary}, ${secondary})`,
              }}
            >
              {' '}
              ✓{' '}
            </span>{' '}
            <p className="mt-0.5 font-mono text-[5.5px] text-black/40">
              #{SAMPLE_MAP.certificateNumber}
            </p>{' '}
          </div>{' '}
          <div className="flex-1 text-right">
            {' '}
            <div className="ml-auto h-px w-16 bg-muted" />{' '}
            <p className="mt-1 text-[6px] font-semibold uppercase tracking-[0.18em] text-black/45">
              {SAMPLE_MAP.issueDate}
            </p>{' '}
          </div>{' '}
        </div>{' '}
      </div>{' '}
    </div>
  );
}
/* --------------------------------- skeletons ------------------------------- */ function CardSkeleton() {
  return (
    <div className={cn('overflow-hidden rounded-xl border shadow-sm', CARD)}>
      {' '}
      <div className="aspect-[1.414/1] animate-pulse bg-muted" />{' '}
      <div className="space-y-2.5 p-4">
        {' '}
        <div className="h-4 w-2/3 animate-pulse rounded-md bg-muted" />{' '}
        <div className="h-3 w-1/2 animate-pulse rounded-md bg-muted/70" />{' '}
      </div>{' '}
    </div>
  );
}
/* ---------------------------------- main tab ------------------------------- */ export function TemplatesTab() {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');
  const [qInput, setQInput] = useState('');
  const [filterActive, setFilterActive] = useState('');
  const [filterLayout, setFilterLayout] = useState('');
  const [sort, setSort] = useState<'newest' | 'name'>('newest');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [previewing, setPreviewing] = useState<Template | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        const qs = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
        if (q) qs.set('q', q);
        if (filterActive) qs.set('isActive', filterActive);
        const res = await fetch(`/api/proxy/admin/cert-templates?${qs.toString()}`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`Failed (${res.status})`);
        const data = await res.json();
        setTemplates(Array.isArray(data?.items) ? data.items : []);
        setTotal(Number(data?.total ?? 0));
      } catch {
        setTemplates([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [q, filterActive, page],
  );
  useEffect(() => {
    const t = setTimeout(() => {
      if (qInput !== q) {
        setQ(qInput);
        setPage(1);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [qInput, q]);
  useEffect(() => {
    load();
  }, [load]);
  const visible = useMemo(() => {
    let rows = [...(templates ?? [])];
    if (filterLayout) rows = rows.filter((t) => t.layout === filterLayout);
    if (sort === 'name') rows.sort((a, b) => a.name.localeCompare(b.name));
    else rows.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    return rows;
  }, [templates, filterLayout, sort]);
  const stats = useMemo(() => {
    const all = templates ?? [];
    return {
      total: total || all.length,
      active: all.filter((t) => t.isActive).length,
      inactive: all.filter((t) => !t.isActive).length,
      fields: all.length
        ? Math.round(all.reduce((s, t) => s + (t.fields?.length ?? 0), 0) / all.length)
        : 0,
    };
  }, [templates, total]);
  const handleToggleActive = async (tpl: Template) => {
    setTogglingId(tpl.id);
    try {
      const res = await fetch(`/api/proxy/admin/cert-templates/${tpl.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !tpl.isActive }),
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      setTemplates(
        (prev) => prev?.map((t) => (t.id === tpl.id ? { ...t, isActive: !t.isActive } : t)) ?? prev,
      );
      toast({ type: 'ok', title: tpl.isActive ? 'Template deactivated' : 'Template activated' });
    } catch (e: any) {
      toast({ type: 'err', title: 'Update failed', description: e?.message });
    } finally {
      setTogglingId(null);
    }
  };
  const handleDuplicate = async (tpl: Template) => {
    try {
      const res = await fetch('/api/proxy/admin/cert-templates', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${tpl.name} (copy)`,
          layout: tpl.layout,
          primaryColor: tpl.primaryColor,
          secondaryColor: tpl.secondaryColor,
          logoUrl: tpl.logoUrl,
          backgroundUrl: tpl.backgroundUrl,
          fontFamily: tpl.fontFamily,
          fields: tpl.fields,
          isActive: false,
        }),
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      toast({
        type: 'ok',
        title: 'Template duplicated',
        description: 'Draft copy created as inactive.',
      });
      load(true);
    } catch (e: any) {
      toast({ type: 'err', title: 'Duplicate failed', description: e?.message });
    }
  };
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(qInput || filterActive || filterLayout);
  return (
    <div className="space-y-4">
      {' '}
      {/* stats strip */}{' '}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {' '}
        {[
          {
            icon: LayoutTemplate,
            label: 'Total templates',
            value: String(stats.total),
            sub: `${visible.length} shown`,
            tint: '',
          },
          {
            icon: BadgeCheck,
            label: 'Active',
            value: String(stats.active),
            sub: 'Available for issuance',
            tint: '',
          },
          {
            icon: CircleDot,
            label: 'Draft / inactive',
            value: String(stats.inactive),
            sub: 'Hidden from issuance',
            tint: '',
          },
          {
            icon: Layers,
            label: 'Avg. fields',
            value: String(stats.fields),
            sub: 'Variables per template',
            tint: '',
          },
        ].map((s) => (
          <div
            key={s.label}
            className={cn('flex items-center gap-3 rounded-xl border p-3.5 shadow-sm', GLASS)}
          >
            {' '}
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              {' '}
              <s.icon className="h-5 w-5" />{' '}
            </span>{' '}
            <span className="min-w-0">
              {' '}
              <span className="block text-lg font-bold leading-none tracking-tight">
                {s.value}
              </span>{' '}
              <span className="mt-1 block truncate text-xs font-medium text-muted-foreground">
                {s.label} · {s.sub}
              </span>{' '}
            </span>{' '}
          </div>
        ))}{' '}
      </div>{' '}
      {/* toolbar */}{' '}
      <div className={cn('flex flex-wrap items-center gap-2 rounded-xl border p-3 ', GLASS)}>
        {' '}
        <div className="relative min-w-[220px] flex-1">
          {' '}
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />{' '}
          <input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search by name, layout, color…"
            className="h-9.5 w-full rounded-xl border border-border bg-card py-2 pl-9 pr-8 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
          />{' '}
          {qInput && (
            <button
              type="button"
              onClick={() => setQInput('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {' '}
              <X className="h-4 w-4" />{' '}
            </button>
          )}{' '}
        </div>{' '}
        <div className="flex items-center gap-1 rounded-xl bg-muted p-1">
          {' '}
          {[
            { k: '', l: 'All' },
            { k: 'true', l: 'Active' },
            { k: 'false', l: 'Draft' },
          ].map((o) => (
            <button
              key={o.k || 'all'}
              type="button"
              onClick={() => {
                setFilterActive(o.k);
                setPage(1);
              }}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                filterActive === o.k
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {' '}
              {o.l}{' '}
            </button>
          ))}{' '}
        </div>{' '}
        <select
          value={filterLayout}
          onChange={(e) => setFilterLayout(e.target.value)}
          className="h-9 rounded-xl border border-border bg-card px-2.5 text-sm capitalize outline-none focus:border-blue-500/50"
          aria-label="Filter by layout"
        >
          {' '}
          <option value="">All layouts</option>{' '}
          {LAYOUTS.map((l) => (
            <option key={l.key} value={l.key}>
              {l.label}
            </option>
          ))}{' '}
        </select>{' '}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as any)}
          className="h-9 rounded-xl border border-border bg-card px-2.5 text-sm outline-none focus:border-blue-500/50"
          aria-label="Sort"
        >
          {' '}
          <option value="newest">Newest first</option> <option value="name">Name A–Z</option>{' '}
        </select>{' '}
        <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1">
          {' '}
          <button
            type="button"
            onClick={() => setView('grid')}
            aria-label="Grid view"
            className={cn(
              'rounded-lg p-1.5 transition',
              view === 'grid'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {' '}
            <LayoutGrid className="h-4 w-4" />{' '}
          </button>{' '}
          <button
            type="button"
            onClick={() => setView('list')}
            aria-label="List view"
            className={cn(
              'rounded-lg p-1.5 transition',
              view === 'list'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {' '}
            <ListIcon className="h-4 w-4" />{' '}
          </button>{' '}
        </div>{' '}
        <div className="ml-auto flex items-center gap-2">
          {' '}
          <button
            type="button"
            onClick={() => load(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-medium shadow-sm transition hover:bg-muted"
          >
            {' '}
            <Search className="hidden" />{' '}
            <span className={cn(refreshing && 'animate-spin')}>
              <SlidersHorizontal className="h-4 w-4" />
            </span>{' '}
            <span className="hidden sm:inline">{refreshing ? 'Refreshing…' : 'Refresh'}</span>{' '}
          </button>{' '}
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setSheetOpen(true);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98]"
          >
            {' '}
            <Plus className="h-4 w-4" /> New template{' '}
          </button>{' '}
        </div>{' '}
      </div>{' '}
      {/* content */}{' '}
      {loading ? (
        view === 'grid' ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {' '}
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <CardSkeleton key={i} />
            ))}{' '}
          </div>
        ) : (
          <div className={cn('overflow-hidden rounded-xl border', CARD)}>
            {' '}
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-b border-border p-4 last:border-0"
              >
                {' '}
                <div className="h-14 w-20 animate-pulse rounded-lg bg-muted" />{' '}
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-40 animate-pulse rounded-md bg-muted" />
                  <div className="h-3 w-56 animate-pulse rounded-md bg-muted/60" />
                </div>{' '}
              </div>
            ))}{' '}
          </div>
        )
      ) : visible.length === 0 ? (
        <div className="relative overflow-hidden rounded-xl border border-border bg-card px-6 py-16 text-center">
          {' '}
          <div className="relative mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            {' '}
            <Palette className="h-8 w-8" />{' '}
          </div>{' '}
          <p className="relative mt-4 text-lg font-bold tracking-tight">
            {hasFilters ? 'No templates match your filters' : 'Design your first certificate'}
          </p>{' '}
          <p className="relative mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
            {' '}
            {hasFilters
              ? 'Try clearing the search or choosing a different status / layout.'
              : 'Start from a polished preset — learner name, course, date and certificate number auto-fill on every issuance.'}{' '}
          </p>{' '}
          <div className="relative mt-5 flex flex-wrap items-center justify-center gap-2">
            {' '}
            {hasFilters ? (
              <button
                type="button"
                onClick={() => {
                  setQInput('');
                  setQ('');
                  setFilterActive('');
                  setFilterLayout('');
                }}
                className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold shadow-sm hover:bg-muted"
              >
                {' '}
                Clear filters{' '}
              </button>
            ) : (
              <>
                {' '}
                {PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => {
                      setEditing({
                        id: '',
                        name: p.name,
                        layout: p.layout,
                        primaryColor: p.primary,
                        secondaryColor: p.secondary,
                        logoUrl: null,
                        backgroundUrl: null,
                        fontFamily: p.font,
                        fields: defaultFields(),
                        isActive: true,
                        createdAt: new Date().toISOString(),
                      } as Template);
                      setSheetOpen(true);
                    }}
                    className="rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold shadow-sm transition"
                  >
                    {' '}
                    <span
                      className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle"
                      style={{ background: p.primary }}
                    />{' '}
                    {p.name}{' '}
                  </button>
                ))}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setSheetOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                >
                  {' '}
                  <Plus className="h-4 w-4" /> Create template{' '}
                </button>{' '}
              </>
            )}{' '}
          </div>{' '}
        </div>
      ) : view === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {' '}
          {visible.map((tpl) => (
            <article
              key={tpl.id}
              className={cn(
                'group flex flex-col overflow-hidden rounded-xl border shadow-sm transition duration-200',
                CARD,
              )}
            >
              {' '}
              <div className="relative p-3 pb-0">
                {' '}
                <button
                  type="button"
                  onClick={() => setPreviewing(tpl)}
                  className="block w-full overflow-hidden rounded-xl border border-border text-left"
                  title="Open preview"
                >
                  {' '}
                  <div className="transition duration-300 group-hover:scale-[1.015]">
                    {' '}
                    <CertificateArt template={tpl} compact />{' '}
                  </div>{' '}
                </button>{' '}
                <span
                  className={cn(
                    'absolute left-5 top-5 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold shadow-md ',
                    tpl.isActive ? 'bg-emerald-600/95 text-white' : 'bg-foreground text-background',
                  )}
                >
                  {' '}
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      tpl.isActive ? 'bg-emerald-200' : 'bg-white',
                    )}
                  />{' '}
                  {tpl.isActive ? 'Active' : 'Draft'}{' '}
                </span>{' '}
                <span className="absolute right-5 top-5 rounded-md bg-foreground px-2 py-0.5 text-[11px] font-semibold capitalize text-white shadow-md">
                  {' '}
                  {tpl.layout}{' '}
                </span>{' '}
                {/* hover quick actions */}{' '}
                <span className="absolute inset-x-5 bottom-2 flex translate-y-2 items-center justify-center gap-1.5 opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100">
                  {' '}
                  <button
                    type="button"
                    onClick={() => setPreviewing(tpl)}
                    className="inline-flex items-center gap-1 rounded-lg bg-foreground px-2.5 py-1.5 text-[11px] font-semibold text-background shadow-lg hover:bg-muted"
                  >
                    {' '}
                    <Eye className="h-3 w-3" /> Preview{' '}
                  </button>{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(tpl);
                      setSheetOpen(true);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-semibold text-foreground shadow-sm hover:bg-muted"
                  >
                    {' '}
                    <Pencil className="h-3 w-3" /> Edit{' '}
                  </button>{' '}
                  <button
                    type="button"
                    onClick={() => handleDuplicate(tpl)}
                    className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-semibold text-foreground shadow-sm hover:bg-muted"
                  >
                    {' '}
                    <Copy className="h-3 w-3" /> Copy{' '}
                  </button>{' '}
                </span>{' '}
              </div>{' '}
              <div className="flex flex-1 flex-col p-4">
                {' '}
                <div className="flex items-start justify-between gap-2">
                  {' '}
                  <div className="min-w-0">
                    {' '}
                    <h3 className="truncate text-[15px] font-bold tracking-tight">
                      {tpl.name}
                    </h3>{' '}
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {' '}
                      {tpl.fontFamily} · {tpl.fields?.length ?? 0} variables ·{' '}
                      {new Date(tpl.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}{' '}
                    </p>{' '}
                  </div>{' '}
                  <span className="flex items-center gap-1">
                    {' '}
                    {[tpl.primaryColor, tpl.secondaryColor].map((c) => (
                      <span
                        key={c}
                        title={c}
                        className="h-5 w-5 rounded-md border-2 border-white shadow ring-1 ring-border"
                        style={{ backgroundColor: c }}
                      />
                    ))}{' '}
                  </span>{' '}
                </div>{' '}
                <div className="mt-2 flex flex-wrap gap-1">
                  {' '}
                  {(tpl.fields ?? []).slice(0, 4).map((f) => (
                    <span
                      key={f.key}
                      className="rounded-md bg-blue-600/[0.08] px-2 py-0.5 text-[10.5px] font-semibold text-blue-600 ring-1 ring-blue-500/15 dark:text-[#2997FF]"
                    >
                      {' '}
                      {VARIABLE_OPTIONS.find((v) => v.key === f.key)?.label ?? f.key}{' '}
                    </span>
                  ))}{' '}
                  {(tpl.fields?.length ?? 0) > 4 && (
                    <span className="rounded-md bg-muted px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
                      +{(tpl.fields?.length ?? 0) - 4}
                    </span>
                  )}{' '}
                </div>{' '}
                <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                  {' '}
                  <button
                    type="button"
                    onClick={() => handleToggleActive(tpl)}
                    disabled={togglingId === tpl.id}
                    className={cn(
                      'inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition active:scale-[0.98] disabled:opacity-60',
                      tpl.isActive
                        ? 'border border-border bg-background text-muted-foreground hover:bg-muted'
                        : 'bg-emerald-600 text-white shadow-md hover:bg-emerald-700',
                    )}
                  >
                    {' '}
                    {togglingId === tpl.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Power className="h-3.5 w-3.5" />
                    )}{' '}
                    {tpl.isActive ? 'Deactivate' : 'Activate'}{' '}
                  </button>{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(tpl);
                      setSheetOpen(true);
                    }}
                    className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 text-xs font-bold text-white shadow-sm transition active:scale-[0.98]"
                  >
                    {' '}
                    <Pencil className="h-3.5 w-3.5" /> Edit design{' '}
                  </button>{' '}
                </div>{' '}
              </div>{' '}
            </article>
          ))}{' '}
        </div>
      ) : (
        <div className={cn('overflow-hidden rounded-xl border shadow-sm', CARD)}>
          {' '}
          {visible.map((tpl) => (
            <div
              key={tpl.id}
              className="group flex items-center gap-4 border-b border-border p-3 transition last:border-0 hover:bg-blue-700/[0.04]"
            >
              {' '}
              <button
                type="button"
                onClick={() => setPreviewing(tpl)}
                className="w-36 shrink-0 overflow-hidden rounded-lg border border-border"
              >
                {' '}
                <CertificateArt template={tpl} compact />{' '}
              </button>{' '}
              <div className="min-w-0 flex-1">
                {' '}
                <div className="flex items-center gap-2">
                  {' '}
                  <p className="truncate text-sm font-bold">{tpl.name}</p>{' '}
                  <span
                    className={cn(
                      'rounded-md px-2 py-0.5 text-[10.5px] font-bold',
                      tpl.isActive
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {' '}
                    {tpl.isActive ? 'Active' : 'Draft'}{' '}
                  </span>{' '}
                  <span className="hidden rounded-md bg-muted px-2 py-0.5 text-[10.5px] font-semibold capitalize text-muted-foreground sm:inline">
                    {tpl.layout}
                  </span>{' '}
                </div>{' '}
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {tpl.fontFamily} · {tpl.fields?.length ?? 0} variables · Updated{' '}
                  {new Date(tpl.createdAt).toLocaleDateString()}
                </p>{' '}
              </div>{' '}
              <div className="hidden items-center gap-1 md:flex">
                {' '}
                {[tpl.primaryColor, tpl.secondaryColor].map((c) => (
                  <span
                    key={c}
                    className="h-5 w-5 rounded-md border-2 border-white shadow ring-1 ring-border"
                    style={{ backgroundColor: c }}
                  />
                ))}{' '}
              </div>{' '}
              <div className="flex shrink-0 items-center gap-1.5">
                {' '}
                <button
                  type="button"
                  onClick={() => setPreviewing(tpl)}
                  aria-label="Preview"
                  className="rounded-lg border border-border p-2 shadow-sm transition hover:bg-muted"
                >
                  <Eye className="h-4 w-4" />
                </button>{' '}
                <button
                  type="button"
                  onClick={() => handleDuplicate(tpl)}
                  aria-label="Duplicate"
                  className="rounded-lg border border-border p-2 shadow-sm transition hover:bg-muted"
                >
                  <Copy className="h-4 w-4" />
                </button>{' '}
                <button
                  type="button"
                  onClick={() => {
                    setEditing(tpl);
                    setSheetOpen(true);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow hover:bg-blue-700"
                >
                  {' '}
                  <Pencil className="h-3.5 w-3.5" /> Edit{' '}
                </button>{' '}
              </div>{' '}
            </div>
          ))}{' '}
        </div>
      )}{' '}
      {/* pagination */}{' '}
      {!loading && visible.length > 0 && (
        <div
          className={cn(
            'flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3',
            GLASS,
          )}
        >
          {' '}
          <p className="text-xs text-muted-foreground">
            {' '}
            Page <span className="font-bold text-foreground">{page}</span> of{' '}
            <span className="font-bold text-foreground">{totalPages}</span> ·{' '}
            <span className="font-semibold">{total}</span> total{' '}
          </p>{' '}
          <div className="flex items-center gap-2">
            {' '}
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="inline-flex items-center gap-1 rounded-xl border border-border bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-muted disabled:opacity-40"
            >
              {' '}
              <ChevronLeft className="h-4 w-4" /> Prev{' '}
            </button>{' '}
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow hover:bg-blue-700 disabled:opacity-40"
            >
              {' '}
              Next <ChevronRight className="h-4 w-4" />{' '}
            </button>{' '}
          </div>{' '}
        </div>
      )}{' '}
      {/* editor + preview */}{' '}
      <TemplateStudioSheet
        open={sheetOpen}
        template={editing}
        onClose={() => {
          setSheetOpen(false);
          setEditing(null);
        }}
        onSaved={() => {
          setSheetOpen(false);
          setEditing(null);
          load(true);
        }}
      />{' '}
      {previewing && (
        <TemplatePreviewDialog
          template={previewing}
          onClose={() => setPreviewing(null)}
          onEdit={() => {
            setEditing(previewing);
            setPreviewing(null);
            setSheetOpen(true);
          }}
        />
      )}{' '}
    </div>
  );
}
function defaultFields(): TemplateField[] {
  return [
    {
      key: 'learnerName',
      label: 'Learner',
      x: 50,
      y: 44,
      fontSize: 26,
      fontWeight: '700',
      color: '#0a1628',
    },
    {
      key: 'courseTitle',
      label: 'Course',
      x: 50,
      y: 58,
      fontSize: 13,
      fontWeight: 'normal',
      color: '#475569',
    },
    {
      key: 'tenantName',
      label: 'Academy',
      x: 50,
      y: 68,
      fontSize: 10,
      fontWeight: '600',
      color: '#64748b',
    },
  ];
}
/* ------------------------------ preview dialog ----------------------------- */ function TemplatePreviewDialog({
  template,
  onClose,
  onEdit,
}: {
  template: Template;
  onClose: () => void;
  onEdit: () => void;
}) {
  const [showAnchors, setShowAnchors] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {' '}
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-gray-900" />{' '}
      <div className="relative w-full max-w-3xl overflow-hidden rounded-xl border border-border bg-card shadow-sm dark:bg-[#1C1C1E]">
        {' '}
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          {' '}
          <div className="flex min-w-0 items-center gap-3">
            {' '}
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow"
              style={{
                background: `linear-gradient(135deg, ${template.primaryColor}, ${template.secondaryColor})`,
              }}
            >
              {' '}
              <Award className="h-5 w-5" />{' '}
            </span>{' '}
            <div className="min-w-0">
              {' '}
              <p className="truncate text-base font-bold tracking-tight">{template.name}</p>{' '}
              <p className="truncate text-xs capitalize text-muted-foreground">
                {template.layout} · {template.fontFamily} · {template.fields?.length ?? 0} variables
              </p>{' '}
            </div>{' '}
          </div>{' '}
          <div className="flex items-center gap-2">
            {' '}
            <button
              type="button"
              onClick={() => setShowAnchors((v) => !v)}
              className={cn(
                'rounded-xl border px-3 py-1.5 text-xs font-semibold transition',
                showAnchors
                  ? 'border-blue-500/40 bg-blue-600/10 text-blue-600 dark:text-[#2997FF]'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {' '}
              {showAnchors ? 'Hide anchors' : 'Show anchors'}{' '}
            </button>{' '}
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
            >
              {' '}
              <Pencil className="h-3.5 w-3.5" /> Edit{' '}
            </button>{' '}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>{' '}
          </div>{' '}
        </div>{' '}
        <div className="bg-muted p-5">
          {' '}
          <div className="overflow-hidden rounded-xl border border-border shadow-sm">
            {' '}
            <CertificateArt template={template} showAnchors={showAnchors} />{' '}
          </div>{' '}
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {' '}
            {(template.fields ?? []).map((f) => (
              <div
                key={f.key}
                className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2 text-xs"
              >
                {' '}
                <span
                  className="h-6 w-6 rounded-md border border-white shadow"
                  style={{ backgroundColor: f.color }}
                />{' '}
                <span className="min-w-0 flex-1">
                  {' '}
                  <span className="block truncate font-bold">
                    {VARIABLE_OPTIONS.find((v) => v.key === f.key)?.label ?? f.key}
                  </span>{' '}
                  <span className="block truncate font-mono text-[11px] text-muted-foreground">
                    {SAMPLE_MAP[f.key] ?? f.key} · {f.fontSize}px
                  </span>{' '}
                </span>{' '}
              </div>
            ))}{' '}
          </div>{' '}
        </div>{' '}
      </div>{' '}
    </div>
  );
}
/* ------------------------------- studio sheet ------------------------------ */ type StudioTab =
  'design' | 'fields' | 'brand';
function TemplateStudioSheet({
  open,
  template,
  onClose,
  onSaved,
}: {
  open: boolean;
  template: Template | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(template && template.id);
  const [tab, setTab] = useState<StudioTab>('design');
  const [name, setName] = useState('');
  const [layout, setLayout] = useState('modern');
  const [primaryColor, setPrimaryColor] = useState('#7c3aed');
  const [secondaryColor, setSecondaryColor] = useState('#0a1628');
  const [logoUrl, setLogoUrl] = useState('');
  const [backgroundUrl, setBackgroundUrl] = useState('');
  const [fontFamily, setFontFamily] = useState('Inter');
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [saving, setSaving] = useState(false);
  const [showAnchors, setShowAnchors] = useState(true);
  useEffect(() => {
    if (open) {
      setTab('design');
      if (template && template.id) {
        setName(template.name);
        setLayout(template.layout);
        setPrimaryColor(template.primaryColor);
        setSecondaryColor(template.secondaryColor);
        setLogoUrl(template.logoUrl ?? '');
        setBackgroundUrl(template.backgroundUrl ?? '');
        setFontFamily(template.fontFamily);
        setFields(template.fields ?? []);
      } else if (template && !template.id) {
        /* preset-prefill (id empty) */ setName(template.name);
        setLayout(template.layout);
        setPrimaryColor(template.primaryColor);
        setSecondaryColor(template.secondaryColor);
        setFontFamily(template.fontFamily);
        setFields(template.fields ?? defaultFields());
      } else {
        setName('');
        setLayout('modern');
        setPrimaryColor('#7c3aed');
        setSecondaryColor('#0a1628');
        setLogoUrl('');
        setBackgroundUrl('');
        setFontFamily('Inter');
        setFields(defaultFields());
      }
    }
  }, [open, template]);
  const updateField = (idx: number, patch: Partial<TemplateField>) =>
    setFields((f) => f.map((field, i) => (i === idx ? { ...field, ...patch } : field)));
  const applyPreset = (p: (typeof PRESETS)[number]) => {
    setLayout(p.layout);
    setPrimaryColor(p.primary);
    setSecondaryColor(p.secondary);
    setFontFamily(p.font);
    if (!name) setName(p.name);
  };
  const insertVariable = (key: string) => {
    const opt = VARIABLE_OPTIONS.find((v) => v.key === key);
    if (!opt) return;
    if (fields.some((f) => f.key === key)) {
      toast({
        type: 'err',
        title: 'Already added',
        description: `${opt.label} is already on the canvas.`,
      });
      return;
    }
    setFields((f) => [
      ...f,
      {
        key,
        label: opt.label,
        x: 50,
        y: 40 + f.length * 9,
        fontSize: key === 'learnerName' ? 24 : 12,
        fontWeight: key === 'learnerName' ? '700' : 'normal',
        color: '#0a1628',
      },
    ]);
  };
  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        type: 'err',
        title: 'Name is required',
        description: 'Give your template a memorable name.',
      });
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        name: name.trim(),
        layout,
        primaryColor,
        secondaryColor,
        logoUrl: logoUrl || null,
        backgroundUrl: backgroundUrl || null,
        fontFamily,
        fields,
      };
      const url = isEdit
        ? `/api/proxy/admin/cert-templates/${template!.id}`
        : '/api/proxy/admin/cert-templates';
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || `Failed (${res.status})`);
      toast({
        type: 'ok',
        title: isEdit ? 'Template updated' : 'Template created',
        description: name.trim(),
      });
      onSaved();
    } catch (e: any) {
      toast({ type: 'err', title: 'Save failed', description: e?.message });
    } finally {
      setSaving(false);
    }
  };
  if (!open) return null;
  const preview: Partial<Template> = {
    name,
    layout,
    primaryColor,
    secondaryColor,
    logoUrl: logoUrl || null,
    backgroundUrl: backgroundUrl || null,
    fontFamily,
    fields,
  };
  const usedKeys = new Set(fields.map((f) => f.key));
  return (
    <RightSheet
      onClose={onClose}
      width="max-w-[1040px]"
      header={
        <RightSheetHeader
          loading={false}
          initials={isEdit ? 'ET' : 'NT'}
          gradient="bg-foreground text-background"
          title={isEdit ? 'Edit template' : 'New template'}
          subtitle={
            isEdit ? (template?.name ?? '') : 'Start from a preset, then refine every pixel'
          }
          onClose={onClose}
        />
      }
    >
      {' '}
      {/* preset strip */}{' '}
      <div className="border-b border-border px-6 py-4">
        {' '}
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          {' '}
          <Sparkles className="h-3.5 w-3.5 text-blue-600" /> Starter presets — one click{' '}
        </p>{' '}
        <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
          {' '}
          {PRESETS.map((p) => {
            const active =
              layout === p.layout && primaryColor.toLowerCase() === p.primary.toLowerCase();
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => applyPreset(p)}
                className={cn(
                  'flex items-center gap-3 rounded-xl border p-2.5 text-left transition ',
                  active
                    ? 'border-blue-500/50 bg-blue-600/[0.07] shadow-sm'
                    : 'border-border bg-card',
                )}
              >
                {' '}
                <span
                  className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border"
                  style={{ background: `linear-gradient(135deg, ${p.primary}, ${p.secondary})` }}
                >
                  {' '}
                  <Award className="h-4 w-4 text-white/90" />{' '}
                </span>{' '}
                <span className="min-w-0 flex-1">
                  {' '}
                  <span className="flex items-center gap-1.5 text-[13px] font-bold">
                    {p.name} {active && <Check className="h-3.5 w-3.5 text-blue-600" />}
                  </span>{' '}
                  <span className="block truncate text-[11px] capitalize text-muted-foreground">
                    {p.layout} · {p.font}
                  </span>{' '}
                </span>{' '}
              </button>
            );
          })}{' '}
        </div>{' '}
        {/* tabs */}{' '}
        <div className="mt-3 flex gap-1 rounded-xl bg-muted p-1">
          {' '}
          {(
            [
              { k: 'design', l: 'Design', icon: Palette },
              { k: 'fields', l: `Variables (${fields.length})`, icon: TypeIcon },
              { k: 'brand', l: 'Brand assets', icon: ImageIcon },
            ] as Array<{ k: StudioTab; l: string; icon: any }>
          ).map((t) => (
            <button
              key={t.k}
              type="button"
              onClick={() => setTab(t.k)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition',
                tab === t.k
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {' '}
              <t.icon className="h-4 w-4" /> {t.l}{' '}
            </button>
          ))}{' '}
        </div>{' '}
      </div>{' '}
      <div className="grid gap-0 lg:grid-cols-[400px_1fr]">
        {' '}
        {/* form column */}{' '}
        <div className="space-y-5 p-6">
          {' '}
          {tab === 'design' && (
            <>
              {' '}
              <Field label="Template name *">
                {' '}
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Heritage Gold — Completion"
                  className={inputCls}
                  maxLength={80}
                />{' '}
                <p className="mt-1 text-right text-[11px] text-muted-foreground">
                  {name.length}/80
                </p>{' '}
              </Field>{' '}
              <Field label="Layout" hint="Changes frame, ornaments and typography rhythm">
                {' '}
                <div className="grid grid-cols-3 gap-2">
                  {' '}
                  {LAYOUTS.map((l) => (
                    <button
                      key={l.key}
                      type="button"
                      onClick={() => setLayout(l.key)}
                      className={cn(
                        'rounded-xl border p-2 text-left transition ',
                        layout === l.key
                          ? 'border-blue-500/60 bg-blue-600/[0.06] ring-2 ring-blue-500/20'
                          : 'border-border bg-card',
                      )}
                    >
                      {' '}
                      <MiniLayoutThumb
                        layout={l.key}
                        primary={primaryColor}
                        secondary={secondaryColor}
                      />{' '}
                      <p className="mt-1.5 flex items-center gap-1 text-xs font-bold">
                        {l.label} {layout === l.key && <Check className="h-3 w-3 text-blue-600" />}
                      </p>{' '}
                      <p className="text-[10.5px] leading-tight text-muted-foreground">
                        {l.tag}
                      </p>{' '}
                    </button>
                  ))}{' '}
                </div>{' '}
              </Field>{' '}
              <Field label="Typeface" hint="Applied to all dynamic variables">
                {' '}
                <div className="space-y-1.5">
                  {' '}
                  {FONTS.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setFontFamily(f.key)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition',
                        fontFamily === f.key
                          ? 'border-blue-500/60 bg-blue-600/[0.06] ring-2 ring-blue-500/20'
                          : 'border-border bg-card hover:border-border',
                      )}
                    >
                      {' '}
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-sm font-bold"
                        style={{ fontFamily: f.stack }}
                      >
                        Ag
                      </span>{' '}
                      <span className="flex-1">
                        {' '}
                        <span
                          className="block text-[13px] font-bold"
                          style={{ fontFamily: f.stack }}
                        >
                          {f.label}
                        </span>{' '}
                        <span className="block text-[11px] text-muted-foreground">
                          {f.desc}
                        </span>{' '}
                      </span>{' '}
                      {fontFamily === f.key && <Check className="h-4 w-4 text-blue-600" />}{' '}
                    </button>
                  ))}{' '}
                </div>{' '}
              </Field>{' '}
              <div className="grid grid-cols-2 gap-3">
                {' '}
                <ColorField label="Primary" value={primaryColor} onChange={setPrimaryColor} />{' '}
                <ColorField
                  label="Secondary"
                  value={secondaryColor}
                  onChange={setSecondaryColor}
                />{' '}
              </div>{' '}
              <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                {' '}
                <span
                  className="h-6 w-10 overflow-hidden rounded-md border border-border"
                  style={{
                    background: `linear-gradient(135deg, ${primaryColor} 50%, ${secondaryColor} 50%)`,
                  }}
                />{' '}
                Primary drives the band, seal and hero text · secondary drives eyebrows and frame
                depth.{' '}
              </div>{' '}
            </>
          )}{' '}
          {tab === 'fields' && (
            <>
              {' '}
              <div>
                {' '}
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Quick insert
                </p>{' '}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {' '}
                  {VARIABLE_OPTIONS.map((v) => {
                    const used = usedKeys.has(v.key);
                    return (
                      <button
                        key={v.key}
                        type="button"
                        disabled={used}
                        onClick={() => insertVariable(v.key)}
                        className={cn(
                          'rounded-md px-2.5 py-1 text-[11.5px] font-semibold ring-1 transition',
                          used
                            ? 'bg-muted text-muted-foreground ring-border'
                            : 'bg-blue-600/[0.08] text-blue-600 ring-blue-500/20 hover:bg-blue-700/[0.14] dark:text-[#2997FF]',
                        )}
                      >
                        {' '}
                        {used ? '✓ ' : '+ '}
                        {v.label}{' '}
                      </button>
                    );
                  })}{' '}
                </div>{' '}
              </div>{' '}
              <div className="space-y-2.5">
                {' '}
                {fields.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                    {' '}
                    No variables yet — insert one above.{' '}
                  </div>
                )}{' '}
                {fields.map((f, idx) => {
                  const opt = VARIABLE_OPTIONS.find((v) => v.key === f.key);
                  return (
                    <div
                      key={idx}
                      className="rounded-xl border border-border bg-card p-3 shadow-sm"
                    >
                      {' '}
                      <div className="flex items-center gap-2">
                        {' '}
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
                          style={{ background: primaryColor }}
                        >
                          {idx + 1}
                        </span>{' '}
                        <select
                          value={f.key}
                          onChange={(e) => updateField(idx, { key: e.target.value })}
                          className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 text-xs font-semibold outline-none"
                        >
                          {' '}
                          {VARIABLE_OPTIONS.map((v) => (
                            <option key={v.key} value={v.key}>
                              {v.label}
                            </option>
                          ))}{' '}
                        </select>{' '}
                        <button
                          type="button"
                          onClick={() => setFields((p) => p.filter((_, i) => i !== idx))}
                          aria-label="Remove field"
                          className="rounded-lg border border-border p-1.5 text-muted-foreground transition hover:bg-red-500/10 hover:text-red-600"
                        >
                          {' '}
                          <X className="h-3.5 w-3.5" />{' '}
                        </button>{' '}
                      </div>{' '}
                      <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                        “{opt?.sample ?? f.key}” · {opt?.hint}
                      </p>{' '}
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {' '}
                        <SliderRow
                          label={`X · ${f.x}%`}
                          value={f.x}
                          min={0}
                          max={100}
                          onChange={(v) => updateField(idx, { x: v })}
                        />{' '}
                        <SliderRow
                          label={`Y · ${f.y}%`}
                          value={f.y}
                          min={0}
                          max={100}
                          onChange={(v) => updateField(idx, { y: v })}
                        />{' '}
                      </div>{' '}
                      <div className="mt-2 grid grid-cols-[1fr_110px] gap-2">
                        {' '}
                        <SliderRow
                          label={`Size · ${f.fontSize}px`}
                          value={f.fontSize}
                          min={6}
                          max={64}
                          onChange={(v) => updateField(idx, { fontSize: v })}
                        />{' '}
                        <label className="block">
                          {' '}
                          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                            Weight
                          </span>{' '}
                          <select
                            value={f.fontWeight}
                            onChange={(e) => updateField(idx, { fontWeight: e.target.value })}
                            className="h-[30px] w-full rounded-lg border border-border bg-background px-2 text-xs outline-none"
                          >
                            {' '}
                            <option value="normal">Regular</option>{' '}
                            <option value="600">Semi-bold</option>{' '}
                            <option value="bold">Bold</option>{' '}
                            <option value="700">Extra bold</option>{' '}
                          </select>{' '}
                        </label>{' '}
                      </div>{' '}
                      <div className="mt-2 flex items-center gap-2">
                        {' '}
                        <input
                          type="color"
                          value={f.color}
                          onChange={(e) => updateField(idx, { color: e.target.value })}
                          className="h-8 w-10 cursor-pointer rounded-lg border border-border bg-background p-1"
                          aria-label="Field color"
                        />{' '}
                        <input
                          value={f.color}
                          onChange={(e) => updateField(idx, { color: e.target.value })}
                          spellCheck={false}
                          className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 font-mono text-xs uppercase outline-none"
                        />{' '}
                        <span
                          className="hidden rounded-md px-2 py-1 text-[11px] font-semibold sm:block"
                          style={{ color: f.color, background: `${f.color}14` }}
                        >
                          Aa
                        </span>{' '}
                      </div>{' '}
                    </div>
                  );
                })}{' '}
              </div>{' '}
              <div className="flex gap-2">
                {' '}
                <button
                  type="button"
                  onClick={() =>
                    setFields((f) => [
                      ...f,
                      {
                        key: 'learnerName',
                        label: 'New field',
                        x: 50,
                        y: 50,
                        fontSize: 14,
                        fontWeight: 'normal',
                        color: '#0a1628',
                      },
                    ])
                  }
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-dashed border-border text-xs font-bold text-muted-foreground transition hover:border-blue-500/50 hover:text-blue-600"
                >
                  {' '}
                  <Plus className="h-3.5 w-3.5" /> Add variable{' '}
                </button>{' '}
                <button
                  type="button"
                  onClick={() => setFields(defaultFields())}
                  className="h-9 rounded-xl border border-border px-3 text-xs font-semibold transition hover:bg-muted"
                >
                  {' '}
                  Reset{' '}
                </button>{' '}
              </div>{' '}
            </>
          )}{' '}
          {tab === 'brand' && (
            <>
              {' '}
              <Field label="Logo URL" hint="PNG or SVG with transparent background looks best">
                {' '}
                <div className="flex items-center gap-2">
                  {' '}
                  <input
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https:// …/logo.png"
                    spellCheck={false}
                    className={inputCls}
                  />{' '}
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={() => setLogoUrl('')}
                      aria-label="Clear logo"
                      className="rounded-xl border border-border p-2.5 hover:bg-muted"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}{' '}
                </div>{' '}
                {logoUrl ? (
                  <span className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-card p-2">
                    {' '}
                    {/* eslint-disable-next-line @next/next/no-img-element */}{' '}
                    <img
                      src={logoUrl}
                      alt="logo preview"
                      className="h-8 object-contain"
                      onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                    />{' '}
                    <span className="truncate text-[11px] text-muted-foreground">
                      Logo loaded
                    </span>{' '}
                  </span>
                ) : (
                  <span className="mt-2 flex items-center gap-2 rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
                    {' '}
                    <Award className="h-4 w-4" /> No logo — a medal mark is used instead.{' '}
                  </span>
                )}{' '}
              </Field>{' '}
              <Field
                label="Background URL"
                hint="Subtle textures or watermarks work best — we wash it to 14%"
              >
                {' '}
                <div className="flex items-center gap-2">
                  {' '}
                  <input
                    value={backgroundUrl}
                    onChange={(e) => setBackgroundUrl(e.target.value)}
                    placeholder="https:// …/texture.jpg"
                    spellCheck={false}
                    className={inputCls}
                  />{' '}
                  {backgroundUrl && (
                    <button
                      type="button"
                      onClick={() => setBackgroundUrl('')}
                      aria-label="Clear background"
                      className="rounded-xl border border-border p-2.5 hover:bg-muted"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}{' '}
                </div>{' '}
              </Field>{' '}
              <div className="rounded-xl border border-border bg-muted p-3.5 text-xs leading-relaxed text-muted-foreground">
                {' '}
                <p className="font-bold text-foreground">Print tips</p>{' '}
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {' '}
                  <li>Keep hero text (learner name) between Y 35–50%.</li>{' '}
                  <li>Use high-contrast ink on busy backgrounds.</li>{' '}
                  <li>Classic layout pairs best with Playfair + gold (#b45309).</li>{' '}
                </ul>{' '}
              </div>{' '}
            </>
          )}{' '}
          <div className="flex items-center gap-2 border-t border-border pt-4">
            {' '}
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-xl border border-border px-4 text-sm font-semibold transition hover:bg-muted"
            >
              {' '}
              Cancel{' '}
            </button>{' '}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-bold text-white shadow-sm transition active:scale-[0.99] disabled:opacity-60"
            >
              {' '}
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}{' '}
              {isEdit ? 'Save changes' : 'Create template'}{' '}
            </button>{' '}
          </div>{' '}
        </div>{' '}
        {/* preview column */}{' '}
        <div className="border-t border-border bg-muted p-6 lg:border-l lg:border-t-0">
          {' '}
          <div className="lg:sticky lg:top-6">
            {' '}
            <div className="flex items-center justify-between">
              {' '}
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {' '}
                <Eye className="h-3.5 w-3.5" /> Live preview{' '}
              </p>{' '}
              <button
                type="button"
                onClick={() => setShowAnchors((v) => !v)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-[11px] font-bold ring-1 transition',
                  showAnchors
                    ? 'bg-blue-600 text-white ring-blue-500'
                    : 'bg-card text-muted-foreground ring-border hover:text-foreground',
                )}
              >
                {' '}
                {showAnchors ? 'Anchors on' : 'Anchors off'}{' '}
              </button>{' '}
            </div>{' '}
            <div className="mt-3 overflow-hidden rounded-xl border border-border bg-background shadow-sm">
              {' '}
              <CertificateArt template={preview} showAnchors={showAnchors} />{' '}
            </div>{' '}
            <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
              {' '}
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-semibold ring-1 ring-border">
                {' '}
                <span className="h-2 w-2 rounded-full" style={{ background: primaryColor }} />{' '}
                {primaryColor.toUpperCase()}{' '}
              </span>{' '}
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-semibold ring-1 ring-border">
                {' '}
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: secondaryColor }}
                />{' '}
                {secondaryColor.toUpperCase()}{' '}
              </span>{' '}
              <span className="ml-auto hidden font-semibold capitalize sm:inline">
                {layout} · {fontFamily}
              </span>{' '}
            </div>{' '}
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Preview renders real sample data at the exact X / Y positions you set. Toggle anchors
              off for a print-faithful view.
            </p>{' '}
          </div>{' '}
        </div>{' '}
      </div>{' '}
    </RightSheet>
  );
}
/* --------------------------------- primitives ------------------------------ */ const inputCls =
  'w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20';
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      {' '}
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>{' '}
      {hint && <p className="mb-1.5 mt-0.5 text-[11.5px] text-muted-foreground/90">{hint}</p>}{' '}
      <div className="mt-1.5">{children}</div>{' '}
    </div>
  );
}
function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      {' '}
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>{' '}
      <div className="mt-1.5 rounded-xl border border-border bg-card p-2">
        {' '}
        <div className="flex items-center gap-2">
          {' '}
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-11 cursor-pointer rounded-lg border border-border bg-background p-1"
            aria-label={`${label} picker`}
          />{' '}
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 font-mono text-xs uppercase outline-none focus:border-blue-500/60"
          />{' '}
        </div>{' '}
        <div className="mt-2 grid grid-cols-5 gap-1">
          {' '}
          {SWATCHES.map((s) => (
            <button
              key={s}
              type="button"
              title={s}
              onClick={() => onChange(s)}
              className={cn(
                'h-6 rounded-md ring-1 ring-border transition hover:scale-110',
                value.toLowerCase() === s.toLowerCase() && 'ring-2 ring-blue-500 ring-offset-1',
              )}
              style={{ backgroundColor: s }}
            />
          ))}{' '}
        </div>{' '}
      </div>{' '}
    </div>
  );
}
function SliderRow({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block rounded-xl border border-border bg-card px-2.5 py-1.5">
      {' '}
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>{' '}
      <span className="flex items-center gap-2">
        {' '}
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-1 min-w-0 flex-1 accent-blue-600"
        />{' '}
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-7 w-14 rounded-md border border-border bg-background px-1 text-center text-xs outline-none"
        />{' '}
      </span>{' '}
    </label>
  );
}
function MiniLayoutThumb({
  layout,
  primary,
  secondary,
}: {
  layout: string;
  primary: string;
  secondary: string;
}) {
  return (
    <span className="relative block h-12 overflow-hidden rounded-lg border border-border bg-background">
      {' '}
      {layout === 'modern' && (
        <span
          className="absolute inset-x-0 top-0 h-1.5"
          style={{ background: `linear-gradient(90deg, ${primary}, ${secondary})` }}
        />
      )}{' '}
      {layout === 'classic' && (
        <span
          className="absolute inset-1 rounded-[3px] border"
          style={{ borderColor: `${primary}aa` }}
        />
      )}{' '}
      {layout === 'minimal' && (
        <span className="absolute inset-1.5 rounded-[2px] border border-border" />
      )}{' '}
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
        {' '}
        <span
          className="mx-auto block h-1.5 w-8 rounded-full"
          style={{ background: primary }}
        />{' '}
        <span className="mx-auto mt-1 block h-1 w-12 rounded-md bg-muted" />{' '}
        <span className="mx-auto mt-1 block h-1 w-8 rounded-md bg-muted" />{' '}
      </span>{' '}
    </span>
  );
}
