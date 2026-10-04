'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
  ChevronLeft,
  ChevronRight,
  Layers,
  CircleDot,
  AlertTriangle,
  BookOpen,
  Building2,
  RefreshCw,
} from 'lucide-react';
import { StatusPill } from '@/components/admin/admin-ui';
import { SelectInput } from '@/components/admin/admin-form';
import { toast } from '@/components/ui/toast';
import { Modal, ModalHeader } from '@/components/ui/modal';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
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
type TemplateScope = 'course' | 'academy' | 'tenant';

/** Scope metadata is declared per key rather than computed, so the
 *  runtime-message-key check can verify every lookup exists. */
const SCOPE_TONE: Record<TemplateScope, 'emerald' | 'purple' | 'blue'> = {
  course: 'emerald',
  academy: 'purple',
  tenant: 'blue',
};
const SCOPE_LABEL_KEY: Record<TemplateScope, string> = {
  course: 'cardScope.scopeCourse',
  academy: 'cardScope.scopeAcademy',
  tenant: 'cardScope.scopeTenant',
};
type ScopeTranslator = (key: string, values?: Record<string, string | number | Date>) => string;
function scopeLabelOf(scope: TemplateScope, t: ScopeTranslator): string {
  return t(SCOPE_LABEL_KEY[scope], { default: scope });
}

type Template = {
  id: string;
  name: string;
  /** Which level this template applies at. Older rows may omit it. */
  scopeType?: TemplateScope | null;
  courseId: string | null;
  academyId?: string | null;
  academyTitle?: string | null;
  courseTitle?: string | null;
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
  {
    key: 'academyName',
    label: 'Academy name',
    sample: 'Aerospace Academy',
    hint: 'Awarding academy',
  },
  { key: 'tenantName', label: 'Organisation', sample: 'TITANS Academy', hint: 'Your organisation' },
  { key: 'score', label: 'Score', sample: '94%', hint: 'Final score, when recorded' },
  { key: 'hours', label: 'Course hours', sample: '20h', hint: 'Estimated hours, when set' },
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
  '#C2410C',
  '#333F4C',
  '#0F766E',
  '#067647',
  '#175CD3',
  '#B54708',
  '#B42318',
  '#191B1F',
  '#be123c',
  '#111827',
];
const PRESETS: Array<{
  /** Translation key under `admin.certificateTemplates.preset`; `name` is the
   *  value persisted as the template's name. */
  key: string;
  name: string;
  layout: string;
  primary: string;
  secondary: string;
  font: string;
}> = [
  {
    key: 'royalViolet',
    name: 'Royal Violet',
    layout: 'modern',
    primary: '#C2410C',
    secondary: '#191B1F',
    font: 'Inter',
  },
  {
    key: 'heritageGold',
    name: 'Heritage Gold',
    layout: 'classic',
    primary: '#B42318',
    secondary: '#1c1917',
    font: 'Playfair Display',
  },
  {
    key: 'arcticMinimal',
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
  const t = useTranslations('admin.certificateTemplates');
  const primary = template.primaryColor || '#0E7490';
  const secondary = template.secondaryColor || '#0a1628';
  const layout = template.layout || 'modern';
  const fields = template.fields ?? [];
  const stack = fontStack(template.fontFamily || 'Inter');
  const noVariables = t('noVariables', { default: 'No variables placed' });
  const noVariablesShort = t('noVariablesShort', { default: 'No variables' });
  const noVariablesBody = t('noVariablesBody', {
    default: 'Open the design and add the learner, course, date and number fields.',
  });
  return (
    <div
      className="relative select-none overflow-hidden bg-card text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
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
            className="absolute -start-8 -top-8 h-28 w-28 rounded-full opacity-[0.10]"
            style={{ background: primary }}
          />{' '}
          <div
            className="absolute -bottom-10 -end-10 h-32 w-32 rounded-full opacity-[0.08]"
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
            compact ? 'mt-1 text-[7px] tracking-[0.28em]' : 'mt-1.5 text-2xs tracking-[0.32em]',
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
          {/*
           * An unconfigured template must not look finished.
           *
           * This branch used to render the template *name* where the learner's
           * name belongs, plus a sample course and sample recipient. Both
           * templates in this workspace have zero fields, so every card
           * previewed as a complete certificate while the issued artefact would
           * have been nameless — and one of them is active and course-linked,
           * so auto-issuance would have sent it. The canvas now says plainly
           * that no variables are placed.
           */}
          {fields.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
              {' '}
              <span
                className="flex size-7 items-center justify-center rounded-full border-2 border-dashed"
                style={{ borderColor: `${primary}66` }}
              >
                {' '}
                <TypeIcon className="size-3.5" style={{ color: primary }} strokeWidth={2} />{' '}
              </span>{' '}
              <p
                className="mt-1.5 font-bold leading-tight"
                style={{ color: primary, fontFamily: stack, fontSize: compact ? 11 : 15 }}
              >
                {compact ? noVariablesShort : noVariables}{' '}
              </p>{' '}
              {!compact && (
                <p className="mt-0.5 text-2xs leading-relaxed text-black/45">
                  {noVariablesBody}
                </p>
              )}{' '}
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
                      showAnchors && 'rounded px-1 ring-1 ring-dashed ring-primary/60',
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
                    <span className="mx-auto mt-0.5 block h-1 w-1 rounded-md bg-primary" />
                  )}{' '}
                </div>
              );
            })
          )}{' '}
        </div>{' '}
        {/*
         * The footer furniture is part of the artwork rather than of `fields`,
         * so it always renders. When nothing is configured it is dimmed and
         * dashed so the whole canvas reads as a work in progress instead of a
         * finished certificate with a real date and serial on it.
         */}
        <div
          className={cn(
            'flex w-full items-end justify-between gap-2',
            fields.length === 0 && 'opacity-45',
          )}
        >
          {' '}
          <div className="flex-1 text-left">
            {' '}
            <div className={cn('h-px w-16', fields.length === 0 ? 'border-t border-dashed border-black/30' : 'bg-muted')} />{' '}
            <p className="mt-1 text-2xs font-semibold uppercase tracking-[0.18em] text-black/45">
              Program director
            </p>{' '}
          </div>{' '}
          <div className="flex flex-col items-center">
            {' '}
            <span
              className="flex h-7 w-7 items-center justify-center rounded-md border-2 text-2xs font-bold text-white shadow"
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
            <div className={cn('ms-auto h-px w-16', fields.length === 0 ? 'border-t border-dashed border-black/30' : 'bg-muted')} />{' '}
            <p className="mt-1 text-2xs font-semibold uppercase tracking-[0.18em] text-black/45">
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
      <Skeleton className="aspect-[1.414/1]" />{' '}
      <div className="space-y-2.5 p-4">
        {' '}
        <Skeleton className="h-4 w-2/3 rounded-md" />{' '}
        <Skeleton className="h-3 w-1/2 rounded-md" />{' '}
      </div>{' '}
    </div>
  );
}
/* ---------------------------------- main tab ------------------------------- */ export function TemplatesTab() {
  const t = useTranslations('admin.certificateTemplates');
  const tCommon = useTranslations('common');
  const variableLabel = (key: string) => {
    const opt = VARIABLE_OPTIONS.find((v) => v.key === key);
    if (!opt) return key;
    return t(`variable.${opt.key}`, { default: opt.label });
  };
  const layoutLabel = (key: string) => {
    const l = LAYOUTS.find((x) => x.key === key);
    if (!l) return key;
    return t(`layout.${l.key}.label`, { default: l.label });
  };
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');
  const [qInput, setQInput] = useState('');
  const [filterActive, setFilterActive] = useState('');
  const [filterLayout, setFilterLayout] = useState('');
  const [sort, setSort] = useState<'newest' | 'name'>('newest');
  // The grid/list preference lives in the URL so it survives a reload and can
  // be shared, matching how the Issued/Templates tab is already addressed.
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setViewState] = useState<'grid' | 'list'>(
    searchParams.get('view') === 'list' ? 'list' : 'grid',
  );
  const setView = (next: 'grid' | 'list') => {
    setViewState(next);
    const url = new URLSearchParams(searchParams.toString());
    if (next === 'list') url.set('view', 'list');
    else url.delete('view');
    router.replace(`?${url.toString()}`, { scroll: false });
  };
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
      // Templates that would issue an incomplete certificate.
      unconfigured: all.filter((t) => (t.fields?.length ?? 0) === 0).length,
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
      toast({
        type: 'ok',
        title: tpl.isActive
          ? t('toastDeactivated', { default: 'Template deactivated' })
          : t('toastActivated', { default: 'Template activated' }),
      });
    } catch (e: any) {
      toast({
        type: 'err',
        title: t('toastUpdateFailed', { default: 'Update failed' }),
        description: e?.message,
      });
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
          courseId: tpl.courseId,
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
        title: t('toastDuplicated', { default: 'Template duplicated' }),
        description: t('toastDraftCopyCreated', { default: 'Draft copy created as inactive.' }),
      });
      load(true);
    } catch (e: any) {
      toast({
        type: 'err',
        title: t('toastDuplicateFailed', { default: 'Duplicate failed' }),
        description: e?.message,
      });
    }
  };
  /*
   * A template with no placed variables renders an essentially blank
   * certificate, yet it can still be active and course-linked — in which case
   * auto-issuance sends a certificate with no learner, course or date. Treat
   * that as a configuration problem worth surfacing, not a cosmetic detail.
   */
  const unconfigured = (tpl: Template) => (tpl.fields?.length ?? 0) === 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(qInput || filterActive || filterLayout);
  return (
    <div className="space-y-4">
      {' '}
      {/* stats strip */}{' '}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        {' '}
        {[
          {
            icon: LayoutTemplate,
            label: t('statTotalTemplates', { default: 'Total templates' }),
            value: String(stats.total),
            sub: t('statShown', { count: visible.length, default: '{count} shown' }),
            tint: '',
          },
          {
            icon: BadgeCheck,
            label: t('statActive', { default: 'Active' }),
            value: String(stats.active),
            sub: t('statAvailableForIssuance', { default: 'Available for issuance' }),
            tint: '',
          },
          {
            icon: CircleDot,
            label: t('statDraftInactive', { default: 'Draft / inactive' }),
            value: String(stats.inactive),
            sub: t('statHiddenFromIssuance', { default: 'Hidden from issuance' }),
            tint: '',
          },
          {
            icon: Layers,
            label: t('statAvgFields', { default: 'Avg. fields' }),
            value: String(stats.fields),
            sub: t('statVariablesPerTemplate', { default: 'Variables per template' }),
            tint: '',
          },
          {
            icon: AlertTriangle,
            label: t('statUnconfigured', { default: 'Needs variables' }),
            value: String(stats.unconfigured),
            sub: t('statUnconfiguredSub', {
              default: 'Incomplete if issued',
            }),
            tint: 'warning',
          },
        ].map((s) => (
          <div
            key={s.label}
            className={cn(
              'flex items-center gap-3 rounded-xl border p-3.5 shadow-xs',
              s.tint === 'warning' && stats.unconfigured > 0
                ? 'border-warning/30 bg-warning/8'
                : 'border-border bg-card',
            )}
          >
            {' '}
            <span
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-lg',
                s.tint === 'warning' && stats.unconfigured > 0
                  ? 'bg-warning/12 text-warning'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {' '}
              <s.icon className="size-5" />{' '}
            </span>{' '}
            <span className="min-w-0">
              {' '}
              <span className="block text-xl font-semibold leading-none tracking-tight text-foreground">
                {s.value}
              </span>{' '}
              <span className="mt-1.5 block truncate text-2xs font-medium text-muted-foreground">
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
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />{' '}
          <input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder={t('searchPlaceholder', { default: 'Search by name, layout, color…' })}
            className="h-9.5 w-full rounded-xl border border-border bg-card py-2 ps-9 pe-8 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
          />{' '}
          {qInput && (
            <button
              type="button"
              onClick={() => setQInput('')}
              aria-label={t('clearSearch', { default: 'Clear search' })}
              className="absolute end-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {' '}
              <X className="size-4" />{' '}
            </button>
          )}{' '}
        </div>{' '}
        <div className="flex items-center gap-1 rounded-xl bg-muted p-1">
          {' '}
          {[
            { k: '', l: tCommon('all', { default: 'All' }) },
            { k: 'true', l: t('statusActive', { default: 'Active' }) },
            { k: 'false', l: t('statusDraft', { default: 'Draft' }) },
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
          className="h-9 rounded-xl border border-border bg-card px-2.5 text-sm capitalize outline-none focus:border-primary/50"
          aria-label={t('filterByLayout', { default: 'Filter by layout' })}
        >
          {' '}
          <option value="">{t('allLayouts', { default: 'All layouts' })}</option>{' '}
          {LAYOUTS.map((l) => (
            <option key={l.key} value={l.key}>
              {layoutLabel(l.key)}
            </option>
          ))}{' '}
        </select>{' '}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as any)}
          className="h-9 rounded-xl border border-border bg-card px-2.5 text-sm outline-none focus:border-primary/50"
          aria-label={t('sortAria', { default: 'Sort' })}
        >
          {' '}
          <option value="newest">{t('sortNewest', { default: 'Newest first' })}</option>{' '}
          <option value="name">{t('sortName', { default: 'Name A–Z' })}</option>{' '}
        </select>{' '}
        <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1">
          {' '}
          <button
            type="button"
            onClick={() => setView('grid')}
            aria-label={t('gridView', { default: 'Grid view' })}
            className={cn(
              'rounded-lg p-1.5 transition',
              view === 'grid'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {' '}
            <LayoutGrid className="size-4" />{' '}
          </button>{' '}
          <button
            type="button"
            onClick={() => setView('list')}
            aria-label={t('listView', { default: 'List view' })}
            className={cn(
              'rounded-lg p-1.5 transition',
              view === 'list'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {' '}
            <ListIcon className="size-4" />{' '}
          </button>{' '}
        </div>{' '}
        <div className="ms-auto flex items-center gap-2">
          {' '}
          <button
            type="button"
            onClick={() => load(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-medium shadow-sm transition hover:bg-muted"
          >
            {' '}
            <RefreshCw className={cn('size-4', refreshing && 'animate-spin')} />{' '}
            <span className="hidden sm:inline">
              {refreshing
                ? t('refreshing', { default: 'Refreshing…' })
                : tCommon('refresh', { default: 'Refresh' })}
            </span>{' '}
          </button>{' '}
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setSheetOpen(true);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition active:scale-[0.98]"
          >
            {' '}
            <Plus className="size-4" /> {t('newTemplate', { default: 'New template' })}{' '}
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
                <Skeleton className="h-14 w-20 rounded-lg" />{' '}
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-40 rounded-md" />
                  <Skeleton className="h-3 w-56 rounded-md" />
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
            <Palette className="size-8" />{' '}
          </div>{' '}
          <p className="relative mt-4 text-lg font-bold tracking-tight">
            {hasFilters
              ? t('emptyNoMatch', { default: 'No templates match your filters' })
              : t('emptyDesignFirst', { default: 'Design your first certificate' })}
          </p>{' '}
          <p className="relative mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
            {' '}
            {hasFilters
              ? t('emptyNoMatchBody', {
                  default:
                    'Try clearing the search or choosing a different status / layout.',
                })
              : t('emptyDesignFirstBody', {
                  default:
                    'Start from a polished preset — learner name, course, date and certificate number auto-fill on every issuance.',
                })}{' '}
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
                {t('clearFilters', { default: 'Clear filters' })}{' '}
              </button>
            ) : (
              <>
                {' '}
                {PRESETS.map((p) => (
                  <button
                    key={p.key}
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
                      className="me-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle"
                      style={{ background: p.primary }}
                    />{' '}
                    {t(`preset.${p.key}`, { default: p.name })}{' '}
                  </button>
                ))}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setSheetOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary"
                >
                  {' '}
                  <Plus className="size-4" />{' '}
                  {t('createTemplate', { default: 'Create template' })}{' '}
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
                'group flex flex-col overflow-hidden rounded-xl border bg-card shadow-xs transition',
                unconfigured(tpl) ? 'border-destructive/40' : 'border-border',
                'hover:border-border-strong',
              )}
            >
              {' '}
              <div className="relative p-3 pb-0">
                {' '}
                <button
                  type="button"
                  onClick={() => setPreviewing(tpl)}
                  className="block w-full overflow-hidden rounded-xl border border-border text-left"
                  title={t('openPreview', { default: 'Open preview' })}
                >
                  {' '}
                  <div className="transition duration-300 group-hover:scale-[1.015]">
                    {' '}
                    <CertificateArt template={tpl} compact />{' '}
                  </div>{' '}
                </button>{' '}
                <span
                  className={cn(
                    'absolute start-4 top-4 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-2xs font-bold shadow-sm backdrop-blur-sm',
                    tpl.isActive
                      ? 'border-success/30 bg-success/95 text-white'
                      : 'border-border bg-foreground/90 text-background',
                  )}
                >
                  {' '}
                  <span
                    className={cn(
                      'size-1.5 rounded-full',
                      tpl.isActive ? 'bg-white' : 'bg-background/60',
                    )}
                  />{' '}
                  {tpl.isActive
                    ? t('statusActive', { default: 'Active' })
                    : t('statusDraft', { default: 'Draft' })}{' '}
                </span>{' '}
                <span className="absolute end-4 top-4">
                  <span className="inline-flex items-center rounded-full border border-white/15 bg-foreground/85 px-2.5 py-0.5 text-2xs font-semibold capitalize text-background shadow-sm backdrop-blur-sm">
                    {layoutLabel(tpl.layout)}
                  </span>
                </span>{' '}
                {/* hover quick actions */}{' '}
                <span className="absolute inset-x-5 bottom-2 flex translate-y-2 items-center justify-center gap-1.5 opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100">
                  {' '}
                  <button
                    type="button"
                    onClick={() => setPreviewing(tpl)}
                    className="inline-flex items-center gap-1 rounded-lg bg-foreground px-2.5 py-1.5 text-2xs font-semibold text-background shadow-lg hover:bg-muted"
                  >
                    {' '}
                    <Eye className="size-3.5" />{' '}
                    {tCommon('preview', { default: 'Preview' })}{' '}
                  </button>{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(tpl);
                      setSheetOpen(true);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-card px-2.5 py-1.5 text-2xs font-semibold text-foreground shadow-sm hover:bg-muted"
                  >
                    {' '}
                    <Pencil className="size-3.5" />{' '}
                    {tCommon('edit', { default: 'Edit' })}{' '}
                  </button>{' '}
                  <button
                    type="button"
                    onClick={() => handleDuplicate(tpl)}
                    className="inline-flex items-center gap-1 rounded-lg bg-card px-2.5 py-1.5 text-2xs font-semibold text-foreground shadow-sm hover:bg-muted"
                  >
                    {' '}
                    <Copy className="size-3.5" />{' '}
                    {tCommon('copy', { default: 'Copy' })}{' '}
                  </button>{' '}
                </span>{' '}
              </div>{' '}
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 dir="auto" className="truncate text-13 font-semibold text-foreground">
                      {tpl.name}
                    </h3>
                    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-2xs text-muted-foreground">
                      <span dir="auto" className="inline-flex min-w-0 items-center gap-1">
                        {tpl.courseTitle ? (
                          <>
                            <BookOpen className="size-3 shrink-0" />
                            <span className="max-w-[10rem] truncate">{tpl.courseTitle}</span>
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <Building2 className="size-3 shrink-0" />
                            {t('tenantDefault', { default: 'Tenant default' })}
                          </span>
                        )}
                      </span>
                      <span aria-hidden className="text-border-strong">
                        &middot;
                      </span>
                      <StatusPill
                        label={scopeLabelOf(
                          tpl.scopeType ??
                            (tpl.courseId ? 'course' : tpl.academyId ? 'academy' : 'tenant'),
                          t,
                        )}
                        tone={SCOPE_TONE[
                          (tpl.scopeType ??
                            (tpl.courseId ? 'course' : tpl.academyId ? 'academy' : 'tenant')) as TemplateScope
                        ]}
                        dot={false}
                      />
                      <span dir="ltr">{tpl.fontFamily}</span>
                      <span aria-hidden className="text-border-strong">
                        &middot;
                      </span>
                      <span>
                        {t('variablesCount', {
                          count: tpl.fields?.length ?? 0,
                          default: '{count, plural, one {# variable} other {# variables}}',
                        })}
                      </span>
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1">
                    {[tpl.primaryColor, tpl.secondaryColor].map((c) => (
                      <span
                        key={c}
                        title={c}
                        className="size-5 rounded-md border border-border shadow-xs"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </span>
                </div>
                {/*
                 * An active template with no variables would issue a
                 * certificate missing the learner, course and date, so the card
                 * says so instead of looking ready to publish.
                 */}
                {unconfigured(tpl) && (
                  <p className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/8 px-2.5 py-2 text-2xs leading-relaxed text-destructive">
                    <AlertTriangle className="mt-px size-3.5 shrink-0" />
                    <span>
                      {tpl.isActive
                        ? t('unconfiguredActiveWarning', {
                            default:
                              'Active with no variables. Certificates issued from it will be missing the learner, course and date.',
                          })
                        : t('unconfiguredWarning', {
                            default:
                              'No variables placed yet, so this template cannot issue a complete certificate.',
                          })}
                    </span>
                  </p>
                )}
                {(tpl.fields?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {tpl.fields.slice(0, 4).map((f) => (
                      <span
                        key={f.key}
                        className="rounded-md border border-primary/20 bg-primary/8 px-1.5 py-0.5 text-2xs font-medium text-primary"
                      >
                        {variableLabel(f.key)}
                      </span>
                    ))}
                    {tpl.fields.length > 4 && (
                      <span className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-2xs font-semibold text-muted-foreground">
                        +{tpl.fields.length - 4}
                      </span>
                    )}
                  </div>
                )}{' '}
                <div className="mt-auto flex items-center gap-2 border-t border-border pt-3">
                  {' '}
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(tpl);
                      setSheetOpen(true);
                    }}
                    className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90 active:scale-[0.98]"
                  >
                    {' '}
                    <Pencil className="size-3.5" />{' '}
                    {t('editDesign', { default: 'Edit design' })}{' '}
                  </button>{' '}
                  <button
                    type="button"
                    onClick={() => handleToggleActive(tpl)}
                    disabled={togglingId === tpl.id}
                    aria-pressed={tpl.isActive}
                    className={cn(
                      'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition active:scale-[0.98] disabled:opacity-60',
                      tpl.isActive
                        ? 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                        : 'border-success/30 bg-success/10 text-success hover:bg-success/15',
                    )}
                  >
                    {' '}
                    {togglingId === tpl.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Power className="size-3.5" />
                    )}{' '}
                    {tpl.isActive
                      ? t('deactivate', { default: 'Deactivate' })
                      : t('activate', { default: 'Activate' })}{' '}
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
              className={cn(
                'group flex items-center gap-4 border-b border-border p-3 transition last:border-0 hover:bg-muted/40',
                unconfigured(tpl) && 'bg-destructive/[0.03]',
              )}
            >
              {' '}
              <button
                type="button"
                onClick={() => setPreviewing(tpl)}
                className="w-36 shrink-0 overflow-hidden rounded-lg border border-border"
                aria-label={t('openPreview', { default: 'Open preview' })}
              >
                {' '}
                <CertificateArt template={tpl} compact />{' '}
              </button>{' '}
              <div className="min-w-0 flex-1">
                {' '}
                <div className="flex flex-wrap items-center gap-2">
                  {' '}
                  <p dir="auto" className="truncate text-13 font-semibold text-foreground">
                    {tpl.name}
                  </p>{' '}
                  <StatusPill
                    label={
                      tpl.isActive
                        ? t('statusActive', { default: 'Active' })
                        : t('statusDraft', { default: 'Draft' })
                    }
                    tone={tpl.isActive ? 'emerald' : 'slate'}
                    pulse={tpl.isActive}
                  />
                  <StatusPill label={layoutLabel(tpl.layout)} tone="slate" dot={false} />
                  {unconfigured(tpl) && (
                    <StatusPill
                      label={t('noVariablesShort', { default: 'No variables' })}
                      tone="rose"
                      dot={false}
                    />
                  )}{' '}
                </div>{' '}
                <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-2xs text-muted-foreground">
                  <span dir="auto" className="inline-flex min-w-0 items-center gap-1">
                    {tpl.courseTitle ? (
                      <>
                        <BookOpen className="size-3 shrink-0" />
                        <span className="max-w-[12rem] truncate">{tpl.courseTitle}</span>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="size-3 shrink-0" />
                        {t('tenantDefault', { default: 'Tenant default' })}
                      </span>
                    )}
                  </span>
                  <span aria-hidden className="text-border-strong">
                    &middot;
                  </span>
                  <span dir="ltr">{tpl.fontFamily}</span>
                  <span aria-hidden className="text-border-strong">
                    &middot;
                  </span>
                  <span>
                    {t('variablesCount', {
                      count: tpl.fields?.length ?? 0,
                      default: '{count, plural, one {# variable} other {# variables}}',
                    })}
                  </span>
                  <span aria-hidden className="text-border-strong">
                    &middot;
                  </span>
                  <span>
                    {t('updated', { default: 'Updated' })}{' '}
                    {new Date(tpl.createdAt).toLocaleDateString()}
                  </span>
                </p>{' '}
              </div>{' '}
              <div className="hidden items-center gap-1 md:flex">
                {' '}
                {[tpl.primaryColor, tpl.secondaryColor].map((c) => (
                  <span
                    key={c}
                    className="size-5 rounded-md border-2 border-white shadow ring-1 ring-border"
                    style={{ backgroundColor: c }}
                  />
                ))}{' '}
              </div>{' '}
              <div className="flex shrink-0 items-center gap-1.5">
                {' '}
                {/* Parity with the grid card: activation is the one action an
                    operator needs most, so it must not be grid-only. */}
                <button
                  type="button"
                  onClick={() => handleToggleActive(tpl)}
                  disabled={togglingId === tpl.id}
                  aria-pressed={tpl.isActive}
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition disabled:opacity-60',
                    tpl.isActive
                      ? 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                      : 'border-success/30 bg-success/10 text-success hover:bg-success/15',
                  )}
                >
                  {togglingId === tpl.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Power className="size-3.5" />
                  )}
                  <span className="hidden sm:inline">
                    {tpl.isActive
                      ? t('deactivate', { default: 'Deactivate' })
                      : t('activate', { default: 'Activate' })}
                  </span>
                </button>{' '}
                <button
                  type="button"
                  onClick={() => setPreviewing(tpl)}
                  aria-label={tCommon('preview', { default: 'Preview' })}
                  className="rounded-lg border border-border p-2 text-foreground shadow-xs transition hover:bg-muted"
                >
                  <Eye className="size-4" />
                </button>{' '}
                <button
                  type="button"
                  onClick={() => handleDuplicate(tpl)}
                  aria-label={t('duplicateAria', { default: 'Duplicate' })}
                  className="rounded-lg border border-border p-2 shadow-sm transition hover:bg-muted"
                >
                  <Copy className="size-4" />
                </button>{' '}
                <button
                  type="button"
                  onClick={() => {
                    setEditing(tpl);
                    setSheetOpen(true);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow hover:bg-primary"
                >
                  {' '}
                  <Pencil className="size-3.5" />{' '}
                  {tCommon('edit', { default: 'Edit' })}{' '}
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
            {tCommon('page', { default: 'Page' })}{' '}
            <span className="font-bold text-foreground">{page}</span>{' '}
            {tCommon('of', { default: 'of' })}{' '}
            <span className="font-bold text-foreground">{totalPages}</span> ·{' '}
            <span className="font-semibold">{total}</span>{' '}
            {t('totalCount', { count: total, default: 'total' })}{' '}
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
              <ChevronLeft className="flip-rtl size-4" />{' '}
              {tCommon('previous', { default: 'Previous' })}{' '}
            </button>{' '}
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow hover:bg-primary disabled:opacity-40"
            >
              {' '}
              {tCommon('next', { default: 'Next' })} <ChevronRight className="flip-rtl size-4" />{' '}
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
      color: '#191B1F',
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
  const t = useTranslations('admin.certificateTemplates');
  const tCommon = useTranslations('common');
  const variableLabel = (key: string) => {
    const opt = VARIABLE_OPTIONS.find((v) => v.key === key);
    if (!opt) return key;
    return t(`variable.${opt.key}`, { default: opt.label });
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {' '}
      <button
        aria-label={t('closeAria', { default: 'Close' })}
        onClick={onClose}
        className="absolute inset-0 bg-overlay"
      />{' '}
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
              <Award className="size-5" />{' '}
            </span>{' '}
            <div className="min-w-0">
              {' '}
              <p className="truncate text-base font-bold tracking-tight">{template.name}</p>{' '}
              <p className="truncate text-xs capitalize text-muted-foreground">
                {template.layout} · {template.fontFamily} ·{' '}
                {t('variablesCount', {
                  count: template.fields?.length ?? 0,
                  default: '{count, plural, one {# variable} other {# variables}}',
                })}
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
                  ? 'border-primary/40 bg-primary/10 text-primary dark:text-[#2997FF]'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {' '}
              {showAnchors
                ? t('hideAnchors', { default: 'Hide anchors' })
                : t('showAnchors', { default: 'Show anchors' })}{' '}
            </button>{' '}
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary"
            >
              {' '}
              <Pencil className="size-3.5" /> {tCommon('edit', { default: 'Edit' })}{' '}
            </button>{' '}
            <button
              type="button"
              onClick={onClose}
              aria-label={t('closePreviewAria', { default: 'Close preview' })}
              className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-5" />
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
                  className="size-6 rounded-md border border-white shadow"
                  style={{ backgroundColor: f.color }}
                />{' '}
                <span className="min-w-0 flex-1">
                  {' '}
                  <span className="block truncate font-bold">
                    {variableLabel(f.key)}
                  </span>{' '}
                  <span className="block truncate font-mono text-2xs text-muted-foreground">
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
  const t = useTranslations('admin.certificateTemplates');
  const tCommon = useTranslations('common');
  const variableLabel = (key: string) => {
    const opt = VARIABLE_OPTIONS.find((v) => v.key === key);
    if (!opt) return key;
    return t(`variable.${opt.key}`, { default: opt.label });
  };
  const variableHint = (key: string) => {
    const opt = VARIABLE_OPTIONS.find((v) => v.key === key);
    if (!opt) return undefined;
    return t(`hint.${opt.key}`, { default: opt.hint });
  };
  const [tab, setTab] = useState<StudioTab>('design');
  const [name, setName] = useState('');
  const [layout, setLayout] = useState('modern');
  const [primaryColor, setPrimaryColor] = useState('#0E7490');
  const [secondaryColor, setSecondaryColor] = useState('#0a1628');
  const [logoUrl, setLogoUrl] = useState('');
  const [backgroundUrl, setBackgroundUrl] = useState('');
  const [fontFamily, setFontFamily] = useState('Inter');
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [courseId, setCourseId] = useState('');
  const [academyId, setAcademyId] = useState('');
  const [scopeType, setScopeType] = useState<TemplateScope>('tenant');
  const [courses, setCourses] = useState<Array<{ id: string; title: string }>>([]);
  const [academies, setAcademies] = useState<Array<{ id: string; title: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [showAnchors, setShowAnchors] = useState(true);
  useEffect(() => {
    if (open) {
      setTab('design');
      fetch('/api/proxy/admin/courses?limit=100', { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d) => setCourses((d?.items ?? []).map((c: any) => ({ id: c.id, title: c.title }))))
        .catch(() => {});
      fetch('/api/proxy/admin/academies?limit=100', { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d) => setAcademies((d?.items ?? []).map((a: any) => ({ id: a.id, title: a.title }))))
        .catch(() => {});
      if (template && template.id) {
        setName(template.name);
        setCourseId(template.courseId ?? '');
        setAcademyId(template.academyId ?? '');
        // Fall back to inferring scope so a template created before the
        // scopeType column existed still opens showing the right assignment.
        setScopeType(
          (template.scopeType as TemplateScope | undefined) ??
            (template.courseId ? 'course' : template.academyId ? 'academy' : 'tenant'),
        );
        setLayout(template.layout);
        setPrimaryColor(template.primaryColor);
        setSecondaryColor(template.secondaryColor);
        setLogoUrl(template.logoUrl ?? '');
        setBackgroundUrl(template.backgroundUrl ?? '');
        setFontFamily(template.fontFamily);
        setFields(template.fields ?? []);
      } else if (template && !template.id) {
        /* preset-prefill (id empty) */ setName(template.name);
        setCourseId(template.courseId ?? '');
        setAcademyId(template.academyId ?? '');
        setScopeType(
          (template.scopeType as TemplateScope | undefined) ??
            (template.courseId ? 'course' : template.academyId ? 'academy' : 'tenant'),
        );
        setLayout(template.layout);
        setPrimaryColor(template.primaryColor);
        setSecondaryColor(template.secondaryColor);
        setFontFamily(template.fontFamily);
        setFields(template.fields ?? defaultFields());
      } else {
        setName('');
        setCourseId('');
        setAcademyId('');
        setScopeType('tenant');
        setLayout('modern');
        setPrimaryColor('#0E7490');
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
        title: t('alreadyAdded', { default: 'Already added' }),
        description: t('alreadyOnCanvas', {
          label: variableLabel(opt.key),
          default: '{label} is already on the canvas.',
        }),
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
        color: '#191B1F',
      },
    ]);
  };
  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        type: 'err',
        title: t('nameRequired', { default: 'Name is required' }),
        description: t('nameRequiredDesc', { default: 'Give your template a memorable name.' }),
      });
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        name: name.trim(),
        scopeType,
        // The ids are mutually exclusive by scope; sending both would violate
        // the database constraint.
        courseId: scopeType === 'course' ? courseId || null : null,
        academyId: scopeType === 'academy' ? academyId || null : null,
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
        title: isEdit
          ? t('toastTemplateUpdated', { default: 'Template updated' })
          : t('toastTemplateCreated', { default: 'Template created' }),
        description: name.trim(),
      });
      onSaved();
    } catch (e: any) {
      toast({
        type: 'err',
        title: t('toastSaveFailed', { default: 'Save failed' }),
        description: e?.message,
      });
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
    <Modal
      onClose={onClose}
      width="max-w-[1040px]"
      title={isEdit ? t('editTemplate', { default: 'Edit template' }) : t('newTemplate', { default: 'New template' })}
      header={
        <ModalHeader
          loading={false}
          initials={isEdit ? 'ET' : 'NT'}
          gradient="bg-foreground text-background"
          title={isEdit ? t('editTemplate', { default: 'Edit template' }) : t('newTemplate', { default: 'New template' })}
          subtitle={
            isEdit
              ? (template?.name ?? '')
              : t('newTemplateSubtitle', {
                  default: 'Start from a preset, then refine every pixel',
                })
          }
          onClose={onClose}
        />
      }
    >
      {' '}
      {/* preset strip */}{' '}
      <div className="border-b border-border px-6 py-4">
        {' '}
        <p className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
          {' '}
          <Sparkles className="size-3.5 text-primary" />{' '}
          {t('starterPresets', { default: 'Starter presets — one click' })}{' '}
        </p>{' '}
        <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
          {' '}
          {PRESETS.map((p) => {
            const active =
              layout === p.layout && primaryColor.toLowerCase() === p.primary.toLowerCase();
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => applyPreset(p)}
                className={cn(
                  'flex items-center gap-3 rounded-xl border p-2.5 text-left transition ',
                  active
                    ? 'border-primary/50 bg-primary/[0.07] shadow-sm'
                    : 'border-border bg-card',
                )}
              >
                {' '}
                <span
                  className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border"
                  style={{ background: `linear-gradient(135deg, ${p.primary}, ${p.secondary})` }}
                >
                  {' '}
                  <Award className="size-4 text-white/90" />{' '}
                </span>{' '}
                <span className="min-w-0 flex-1">
                  {' '}
                  <span className="flex items-center gap-1.5 text-13 font-bold">
                    {t(`preset.${p.key}`, { default: p.name })}{' '}
                    {active && <Check className="size-3.5 text-primary" />}
                  </span>{' '}
                  <span className="block truncate text-2xs capitalize text-muted-foreground">
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
              { k: 'design', l: t('tabDesign', { default: 'Design' }), icon: Palette },
              {
                k: 'fields',
                l: t('tabVariables', { count: fields.length, default: 'Variables ({count})' }),
                icon: TypeIcon,
              },
              { k: 'brand', l: t('tabBrandAssets', { default: 'Brand assets' }), icon: ImageIcon },
            ] as Array<{ k: StudioTab; l: string; icon: any }>
          ).map((t) => (
            <button
              key={t.k}
              type="button"
              onClick={() => setTab(t.k)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-13 font-semibold transition',
                tab === t.k
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {' '}
              <t.icon className="size-4" /> {t.l}{' '}
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
              <Field label={t('fieldTemplateName', { default: 'Template name *' })}>
                {' '}
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('namePlaceholder', {
                    default: 'e.g. Heritage Gold — Completion',
                  })}
                  className={inputCls}
                  maxLength={80}
                />{' '}
                <p className="mt-1 text-right text-2xs text-muted-foreground">
                  {name.length}/80
                </p>{' '}
              </Field>{' '}
                            {/* Scope decides which certificate this template produces and
                  which template wins when several could apply. The resolution
                  chain is course -> academy -> tenant. */}
              <Field
                label={t('fieldScope', { default: 'Applies to' })}
                hint={t('scopeHint', {
                  default:
                    'A course template wins over its academy, which wins over the tenant default.',
                })}
              >
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { k: 'course', label: t('scopeCourse', { default: 'Course' }) },
                      { k: 'academy', label: t('scopeAcademy', { default: 'Academy' }) },
                      { k: 'tenant', label: t('scopeTenant', { default: 'Tenant default' }) },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.k}
                      type="button"
                      onClick={() => {
                        setScopeType(opt.k);
                        // Keep the two ids mutually exclusive so the payload
                        // always satisfies the database CHECK constraint.
                        if (opt.k === 'course') setAcademyId('');
                        if (opt.k === 'academy') setCourseId('');
                      }}
                      aria-pressed={scopeType === opt.k}
                      className={cn(
                        'rounded-lg border px-2.5 py-2 text-xs font-semibold transition',
                        scopeType === opt.k
                          ? 'border-primary/50 bg-primary/8 text-primary'
                          : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </Field>
              {scopeType === 'course' && (
                <Field
                  label={t('fieldLinkedCourse', { default: 'Linked course' })}
                  hint={t('linkedCourseHint', {
                    default:
                      'Learners who finish this course auto-receive this template.',
                  })}
                  error={
                    !courseId
                      ? t('courseRequired', { default: 'Choose the course this template is for.' })
                      : undefined
                  }
                >
                  <SelectInput
                    value={courseId}
                    onChange={(e) => setCourseId(e.target.value)}
                  >
                    <option value="">
                      {t('chooseCourse', { default: 'Select a course…' })}
                    </option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
              )}
              {scopeType === 'academy' && (
                <Field
                  label={t('fieldLinkedAcademy', { default: 'Linked academy' })}
                  hint={t('linkedAcademyHint', {
                    default:
                      'Issued for any course in this academy that has no course-level template.',
                  })}
                  error={
                    !academyId
                      ? t('academyRequired', { default: 'Choose the academy this template is for.' })
                      : undefined
                  }
                >
                  <SelectInput
                    value={academyId}
                    onChange={(e) => setAcademyId(e.target.value)}
                  >
                    <option value="">
                      {t('chooseAcademy', { default: 'Select an academy…' })}
                    </option>
                    {academies.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
              )}
              {scopeType === 'tenant' && (
                <p className="rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                  {t('tenantDefaultExplain', {
                    default:
                      'This template is the fallback for every course in your workspace that has no course or academy template. It will be used often, so it should be your most general design.',
                  })}
                </p>
              )}
              <Field
                label={t('fieldLayout', { default: 'Layout' })}
                hint={t('layoutHint', {
                  default: 'Changes frame, ornaments and typography rhythm',
                })}
              >
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
                          ? 'border-primary/60 bg-primary/[0.06] ring-2 ring-primary/20'
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
                        {t(`layout.${l.key}.label`, { default: l.label })}{' '}
                        {layout === l.key && <Check className="size-3.5 text-primary" />}
                      </p>{' '}
                      <p className="text-[10.5px] leading-tight text-muted-foreground">
                        {t(`layout.${l.key}.tag`, { default: l.tag })}
                      </p>{' '}
                    </button>
                  ))}{' '}
                </div>{' '}
              </Field>{' '}
              <Field
                label={t('fieldTypeface', { default: 'Typeface' })}
                hint={t('typefaceHint', { default: 'Applied to all dynamic variables' })}
              >
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
                          ? 'border-primary/60 bg-primary/[0.06] ring-2 ring-primary/20'
                          : 'border-border bg-card hover:border-border',
                      )}
                    >
                      {' '}
                      <span
                        className="flex size-8 items-center justify-center rounded-lg bg-muted text-sm font-bold"
                        style={{ fontFamily: f.stack }}
                      >
                        Ag
                      </span>{' '}
                      <span className="flex-1">
                        {' '}
                        <span
                          className="block text-13 font-bold"
                          style={{ fontFamily: f.stack }}
                        >
                          {t(`font.${f.key}.label`, { default: f.label })}
                        </span>{' '}
                        <span className="block text-2xs text-muted-foreground">
                          {t(`font.${f.key}.desc`, { default: f.desc })}
                        </span>{' '}
                      </span>{' '}
                      {fontFamily === f.key && <Check className="size-4 text-primary" />}{' '}
                    </button>
                  ))}{' '}
                </div>{' '}
              </Field>{' '}
              <div className="grid grid-cols-2 gap-3">
                {' '}
                <ColorField
                  label={t('colorPrimary', { default: 'Primary' })}
                  value={primaryColor}
                  onChange={setPrimaryColor}
                />{' '}
                <ColorField
                  label={t('colorSecondary', { default: 'Secondary' })}
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
                {t('colorRolesHint', {
                  default:
                    'Primary drives the band, seal and hero text · secondary drives eyebrows and frame depth.',
                })}{' '}
              </div>{' '}
            </>
          )}{' '}
          {tab === 'fields' && (
            <>
              {' '}
              <div>
                {' '}
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {t('quickInsert', { default: 'Quick insert' })}
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
                            : 'bg-primary/[0.08] text-primary ring-primary/20 hover:bg-primary/[0.14] dark:text-[#2997FF]',
                        )}
                      >
                        {' '}
                        {used ? '✓ ' : '+ '}
                        {variableLabel(v.key)}{' '}
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
                    {t('noVariablesYet', { default: 'No variables yet — insert one above.' })}{' '}
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
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-2xs font-bold text-white"
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
                              {variableLabel(v.key)}
                            </option>
                          ))}{' '}
                        </select>{' '}
                        <button
                          type="button"
                          onClick={() => setFields((p) => p.filter((_, i) => i !== idx))}
                          aria-label={t('removeFieldAria', { default: 'Remove field' })}
                          className="rounded-lg border border-border p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                        >
                          {' '}
                          <X className="size-3.5" />{' '}
                        </button>{' '}
                      </div>{' '}
                      <p className="mt-1 truncate font-mono text-2xs text-muted-foreground">
                        “{opt?.sample ?? f.key}” ·{' '}
                        {opt ? variableHint(opt.key) : ''}
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
                          <span className="mb-1 block text-2xs font-bold uppercase tracking-wide text-muted-foreground">
                            {t('fieldWeight', { default: 'Weight' })}
                          </span>{' '}
                          <select
                            value={f.fontWeight}
                            onChange={(e) => updateField(idx, { fontWeight: e.target.value })}
                            className="h-[30px] w-full rounded-lg border border-border bg-background px-2 text-xs outline-none"
                          >
                            {' '}
                            <option value="normal">
                              {t('weightRegular', { default: 'Regular' })}
                            </option>{' '}
                            <option value="600">
                              {t('weightSemiBold', { default: 'Semi-bold' })}
                            </option>{' '}
                            <option value="bold">{t('weightBold', { default: 'Bold' })}</option>{' '}
                            <option value="700">
                              {t('weightExtraBold', { default: 'Extra bold' })}
                            </option>{' '}
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
                          aria-label={t('fieldColorAria', { default: 'Field color' })}
                        />{' '}
                        <input
                          value={f.color}
                          onChange={(e) => updateField(idx, { color: e.target.value })}
                          spellCheck={false}
                          className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 font-mono text-xs uppercase outline-none"
                        />{' '}
                        <span
                          className="hidden rounded-md px-2 py-1 text-2xs font-semibold sm:block"
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
                        label: t('newFieldLabel', { default: 'New field' }),
                        x: 50,
                        y: 50,
                        fontSize: 14,
                        fontWeight: 'normal',
                        color: '#191B1F',
                      },
                    ])
                  }
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-dashed border-border text-xs font-bold text-muted-foreground transition hover:border-primary/50 hover:text-primary"
                >
                  {' '}
                  <Plus className="size-3.5" />{' '}
                  {t('addVariable', { default: 'Add variable' })}{' '}
                </button>{' '}
                <button
                  type="button"
                  onClick={() => setFields(defaultFields())}
                  className="h-9 rounded-xl border border-border px-3 text-xs font-semibold transition hover:bg-muted"
                >
                  {' '}
                  {t('reset', { default: 'Reset' })}{' '}
                </button>{' '}
              </div>{' '}
            </>
          )}{' '}
          {tab === 'brand' && (
            <>
              {' '}
              <Field
                label={t('fieldLogoUrl', { default: 'Logo URL' })}
                hint={t('logoUrlHint', {
                  default: 'PNG or SVG with transparent background looks best',
                })}
              >
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
                      aria-label={t('clearLogoAria', { default: 'Clear logo' })}
                      className="rounded-xl border border-border p-2.5 hover:bg-muted"
                    >
                      <X className="size-4" />
                    </button>
                  )}{' '}
                </div>{' '}
                {logoUrl ? (
                  <span className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-card p-2">
                    {' '}
                    {/* eslint-disable-next-line @next/next/no-img-element */}{' '}
                    <img
                      src={logoUrl}
                      alt={t('logoPreviewAlt', { default: 'Logo preview' })}
                      className="h-8 object-contain"
                      onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                    />{' '}
                    <span className="truncate text-2xs text-muted-foreground">
                      {t('logoLoaded', { default: 'Logo loaded' })}
                    </span>{' '}
                  </span>
                ) : (
                  <span className="mt-2 flex items-center gap-2 rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
                    {' '}
                    <Award className="size-4" />{' '}
                    {t('noLogo', { default: 'No logo — a medal mark is used instead.' })}{' '}
                  </span>
                )}{' '}
              </Field>{' '}
              <Field
                label={t('fieldBackgroundUrl', { default: 'Background URL' })}
                hint={t('backgroundUrlHint', {
                  default: 'Subtle textures or watermarks work best — we wash it to 14%',
                })}
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
                      aria-label={t('clearBackgroundAria', { default: 'Clear background' })}
                      className="rounded-xl border border-border p-2.5 hover:bg-muted"
                    >
                      <X className="size-4" />
                    </button>
                  )}{' '}
                </div>{' '}
              </Field>{' '}
              <div className="rounded-xl border border-border bg-muted p-3.5 text-xs leading-relaxed text-muted-foreground">
                {' '}
                <p className="font-bold text-foreground">
                  {t('printTips', { default: 'Print tips' })}
                </p>{' '}
                <ul className="mt-1 list-disc space-y-0.5 ps-4">
                  {' '}
                  <li>
                    {t('printTipHeroText', {
                      default: 'Keep hero text (learner name) between Y 35–50%.',
                    })}
                  </li>{' '}
                  <li>
                    {t('printTipContrast', {
                      default: 'Use high-contrast ink on busy backgrounds.',
                    })}
                  </li>{' '}
                  <li>
                    {t('printTipClassic', {
                      default: 'Classic layout pairs best with Playfair + gold (#b45309).',
                    })}
                  </li>{' '}
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
              {tCommon('cancel', { default: 'Cancel' })}{' '}
            </button>{' '}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm transition active:scale-[0.99] disabled:opacity-60"
            >
              {' '}
              {saving && <Loader2 className="size-4 animate-spin" />}{' '}
              {isEdit
                ? tCommon('saveChanges', { default: 'Save changes' })
                : t('createTemplate', { default: 'Create template' })}{' '}
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
              <p className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {' '}
                <Eye className="size-3.5" />{' '}
                {t('livePreview', { default: 'Live preview' })}{' '}
              </p>{' '}
              <button
                type="button"
                onClick={() => setShowAnchors((v) => !v)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-2xs font-bold ring-1 transition',
                  showAnchors
                    ? 'bg-primary text-primary-foreground ring-primary'
                    : 'bg-card text-muted-foreground ring-border hover:text-foreground',
                )}
              >
                {' '}
                {showAnchors
                  ? t('anchorsOn', { default: 'Anchors on' })
                  : t('anchorsOff', { default: 'Anchors off' })}{' '}
              </button>{' '}
            </div>{' '}
            <div className="mt-3 overflow-hidden rounded-xl border border-border bg-background shadow-sm">
              {' '}
              <CertificateArt template={preview} showAnchors={showAnchors} />{' '}
            </div>{' '}
            <div className="mt-3 flex items-center gap-2 text-2xs text-muted-foreground">
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
              <span className="ms-auto hidden font-semibold capitalize sm:inline">
                {layout} · {fontFamily}
              </span>{' '}
            </div>{' '}
            <p className="mt-2 text-2xs leading-relaxed text-muted-foreground">
              {t('previewHint', {
                default:
                  'Preview renders real sample data at the exact X / Y positions you set. Toggle anchors off for a print-faithful view.',
              })}
            </p>{' '}
          </div>{' '}
        </div>{' '}
      </div>{' '}
    </Modal>
  );
}
/* --------------------------------- primitives ------------------------------ */ const inputCls =
  'w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/20';
function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
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
      {error && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-destructive">
          <AlertTriangle className="size-3.5 shrink-0" />
          {error}
        </p>
      )}{' '}
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
            className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 font-mono text-xs uppercase outline-none focus:border-primary/60"
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
                value.toLowerCase() === s.toLowerCase() && 'ring-2 ring-primary ring-offset-1',
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
      <span className="mb-1 block text-2xs font-bold uppercase tracking-wide text-muted-foreground">
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
          className="h-1 min-w-0 flex-1 accent-primary"
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
