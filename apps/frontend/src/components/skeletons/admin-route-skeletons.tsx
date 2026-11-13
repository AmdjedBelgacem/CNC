'use client';

import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AsideCardSkeleton,
  CardGridSkeleton,
  CommandBarSkeleton,
  EditorShellSkeleton,
  FieldSkeleton,
  FormLayoutSkeleton,
  FormSectionSkeleton,
  KpiGridSkeleton,
  PageHeaderSkeleton,
  PanelListSkeleton,
  PanelSkeleton,
  PillTabsSkeleton,
  Repeat,
  SectionNavSkeleton,
  SegmentedToggleSkeleton,
  SelectSkeleton,
  SkeletonRegion,
  StatStripSkeleton,
  TableCardSkeleton,
  ToolbarSkeleton,
  type ColumnSpec,
} from '@/components/ui/skeletons';
import { BuilderSkeleton } from '@/components/builder/builder-shell';
import { cn } from '@/lib/utils';

/* -----------------------------------------------------------------------------
 * ADMIN ROUTE SKELETONS
 *
 * One replica per admin screen. Each composes the kit in
 * components/ui/skeletons, copying the page's own containers (max widths,
 * paddings, grid columns) so the switch from placeholder to content is a swap,
 * not a reflow. The comment above each names the file it mirrors: when that
 * page's layout changes, change its replica too.
 *
 * Used three ways:
 *  - by the route's `loading.tsx` (server navigation),
 *  - by `AdminGate` through `AdminRouteSkeleton` while the role check runs,
 *  - by the page itself for its client-side loading branch.
 * --------------------------------------------------------------------------- */

/** The page body under the command bar on the list screens. */
function Body({ width = 'max-w-[1500px]', children }: { width?: string; children: ReactNode }) {
  return <div className={cn('mx-auto w-full space-y-6 pt-6', width)}>{children}</div>;
}

/** Command bar + body, inside one accessible region. */
function ListPage({
  bar,
  width,
  children,
}: {
  bar: Parameters<typeof CommandBarSkeleton>[0];
  width?: string;
  children: ReactNode;
}) {
  return (
    <SkeletonRegion>
      <div className="w-full">
        <CommandBarSkeleton {...bar} />
        <Body width={width}>{children}</Body>
      </div>
    </SkeletonRegion>
  );
}

/** The green "tenant-safe" pill most list headers carry as their badge. */
const BADGE = 'h-[30px] w-52 rounded-full';

/* ═══════════════════════════════════════════════════════════════════════════
 * Catalogue cards — shared with the pages' own loading branches
 * ═══════════════════════════════════════════════════════════════════════════ */

/** `ProductCard` in admin/products/page.tsx. */
export function AdminProductCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xs">
      <div className="flex gap-4 p-4">
        <Skeleton className="size-24 shrink-0 rounded-xl sm:size-28" />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="size-[30px] shrink-0 rounded-lg" />
          </div>
          <div className="mt-2 space-y-2 py-[3px]">
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="mt-1.5 h-2.5 w-2/3" />
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Skeleton className="h-[22px] w-20 rounded-full" />
            <Skeleton className="h-[22px] w-16 rounded-full" />
          </div>
          <div className="mt-auto flex items-center gap-3 pt-3">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="ms-auto h-2.5 w-12" />
          </div>
        </div>
      </div>
      <div className="mt-auto flex items-center gap-2 border-t border-border/70 bg-surface-sunken/40 px-4 py-2.5">
        <Skeleton className="h-7 flex-1 rounded-lg" shimmer={false} />
        <Skeleton className="h-7 w-16 rounded-lg" shimmer={false} />
      </div>
    </div>
  );
}

/** `CourseCard` in admin/courses/page.tsx. */
export function AdminCourseCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs">
      <div className="flex gap-4 p-4">
        <Skeleton className="size-24 shrink-0 rounded-lg sm:size-28" />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-2 py-1">
              <Skeleton className="h-3.5 w-4/5" />
            </div>
            <Skeleton className="size-[30px] shrink-0 rounded-lg" />
          </div>
          <Skeleton className="mt-1 h-2.5 w-1/3" />
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Skeleton className="h-[22px] w-20 rounded-full" />
            <Skeleton className="h-[22px] w-16 rounded-full" />
          </div>
          <div className="mt-2 space-y-2 py-1">
            <Skeleton className="h-2.5 w-full" />
            <Skeleton className="h-2.5 w-2/3" />
          </div>
          <div className="mt-auto flex items-center gap-3 pt-3">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-2.5 w-14" />
            <Skeleton className="ms-auto h-2.5 w-12" />
          </div>
        </div>
      </div>
      <div className="mt-auto flex items-center gap-2 border-t border-border/70 bg-muted/20 px-4 py-2">
        <Skeleton className="h-7 flex-1 rounded-lg" shimmer={false} />
        <Skeleton className="h-7 w-16 rounded-lg" shimmer={false} />
      </div>
    </div>
  );
}

/** `AcademyCard` in admin/academies/page.tsx. */
export function AdminAcademyCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xs">
      <div className="relative h-32 w-full shrink-0">
        <Skeleton className="absolute inset-0 rounded-none" />
        <Skeleton className="absolute bottom-3 start-4 size-12 rounded-xl border-2 border-card bg-card" />
        <Skeleton className="absolute end-3 top-3 h-[22px] w-20 rounded-full bg-card/85" />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex h-[25px] items-center">
              <Skeleton className="h-4 w-3/4" />
            </div>
            <Skeleton className="mt-1.5 h-2.5 w-1/3" />
          </div>
          <Skeleton className="size-[30px] shrink-0 rounded-lg" />
        </div>
        <div className="mt-2.5 space-y-2 py-1">
          <Skeleton className="h-2.5 w-full" />
          <Skeleton className="h-2.5 w-3/5" />
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-2.5 w-16" />
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-border/70 bg-surface-sunken/40 px-5 py-2.5">
        <Skeleton className="h-7 flex-1 rounded-lg" shimmer={false} />
        <Skeleton className="h-7 w-16 rounded-lg" shimmer={false} />
      </div>
    </div>
  );
}

/** `CertificateCard` in admin/certificates/page.tsx. */
export function AdminCertificateCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs">
      <div className="flex items-start gap-5 p-5">
        <Skeleton className="size-24 shrink-0 rounded-xl sm:size-28" />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-2.5 w-2/3" />
            </div>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <Skeleton className="h-[22px] w-20 rounded-full" />
            <Skeleton className="h-[22px] w-24 rounded-full" />
          </div>
          <div className="mt-2 space-y-2 py-1">
            <Skeleton className="h-2.5 w-full" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
          <div className="mt-auto flex gap-3 pt-3">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
      </div>
      <div className="mt-auto flex items-center gap-2 border-t border-border/70 bg-muted/30 px-4 py-2.5">
        <Skeleton className="h-7 flex-1 rounded-lg" shimmer={false} />
        <Skeleton className="h-7 w-20 rounded-lg" shimmer={false} />
      </div>
    </div>
  );
}

/** The grid the three catalogue lists and certificates lay their cards in. */
export function AdminCardGrid({
  kind,
  count = 6,
}: {
  kind: 'product' | 'course' | 'academy' | 'certificate';
  count?: number;
}) {
  const grid =
    kind === 'academy' ? 'grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3' : 'grid grid-cols-1 gap-4 lg:grid-cols-2';
  const Card =
    kind === 'product'
      ? AdminProductCardSkeleton
      : kind === 'course'
        ? AdminCourseCardSkeleton
        : kind === 'academy'
          ? AdminAcademyCardSkeleton
          : AdminCertificateCardSkeleton;
  return <CardGridSkeleton count={count} className={grid} card={() => <Card />} />;
}

/** The date-range control on users / certificates toolbars. */
function DateRangeSkeleton() {
  return <Skeleton className="h-9 w-[15.5rem] max-w-full rounded-lg border border-border/80 bg-card" />;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Dashboard — components/admin/dashboard-view.tsx
 * ═══════════════════════════════════════════════════════════════════════════ */

/** The hairline five-cell KPI strip, shared with the view's own loading branch. */
export function DashboardKpiStripSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-px bg-border/60 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <Repeat count={5}>
        {(i) => (
          <div key={i} className="flex flex-col gap-3 bg-card px-4 py-5 sm:px-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex h-4 items-center">
                  <Skeleton className="h-2.5 w-20" />
                </div>
                <Skeleton className="mt-2 h-7 w-24" />
                <div className="mt-1.5 flex h-4 items-center">
                  <Skeleton className="h-2.5 w-28" />
                </div>
              </div>
              <Skeleton className="size-9 shrink-0 rounded-lg" />
            </div>
            <Skeleton className="h-7 w-full" />
          </div>
        )}
      </Repeat>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <SkeletonRegion>
      <div className="w-full">
        <CommandBarSkeleton
          crumbs={['w-36', 'w-20']}
          actions={[{ className: 'w-[12.5rem]' }, 'icon']}
          primary="w-32"
        />
        <div className="mx-auto w-full max-w-[1560px] space-y-6 pt-6">
          <div className="space-y-5">
            <div className="min-w-0">
              <div className="flex h-[18px] items-center">
                <Skeleton className="h-2.5 w-24" />
              </div>
              <div className="mt-2 flex h-8 items-center sm:h-[41px]">
                <Skeleton className="h-6 w-56 sm:h-8 sm:w-80" />
              </div>
              <div className="mt-2 space-y-2 py-1">
                <Skeleton className="h-3 w-full max-w-xl" />
                <Skeleton className="h-3 w-1/2 sm:hidden" />
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs">
              <DashboardKpiStripSkeleton />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-8">
              <PanelSkeleton titleWidth="w-36" tone="attention" action="w-7 rounded-full" bodyClassName="p-0">
                <PanelListSkeleton rows={3} rowClassName="px-4 py-3.5 sm:px-5" trailing="w-10" />
              </PanelSkeleton>
              <PanelSkeleton titleWidth="w-28" action="w-24">
                <div className="space-y-5">
                  <Repeat count={2}>
                    {(i) => (
                      <div key={i}>
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <Skeleton className="h-2.5 w-20" />
                          <Skeleton className="h-4 w-16" />
                        </div>
                        <div className="flex h-24 items-end gap-[2px]">
                          {[30, 46, 38, 62, 50, 74, 58, 80, 64, 70, 52, 86, 60, 72].map((h, j) => (
                            <Skeleton key={j} className="flex-1 rounded-b-none rounded-t-[3px]" style={{ height: `${h}%` }} shimmer={false} />
                          ))}
                        </div>
                      </div>
                    )}
                  </Repeat>
                </div>
              </PanelSkeleton>
              <PanelSkeleton titleWidth="w-32" subtitle={false} action="w-16" bodyClassName="p-0">
                <PanelListSkeleton rows={5} lead="index" trailing="w-20" />
              </PanelSkeleton>
            </div>
            <div className="space-y-6 lg:col-span-4">
              <PanelSkeleton titleWidth="w-32">
                <div className="space-y-4">
                  <Skeleton className="h-2 w-full rounded-full" />
                  <div className="space-y-2.5">
                    <Repeat count={3}>
                      {(i) => (
                        <div key={i} className="flex h-5 items-center justify-between gap-2">
                          <Skeleton className="h-2.5 w-24" />
                          <Skeleton className="h-3 w-8" />
                        </div>
                      )}
                    </Repeat>
                  </div>
                  <div className="border-t border-border/60 pt-3">
                    <Skeleton className="h-2.5 w-2/3" />
                  </div>
                </div>
              </PanelSkeleton>
              <PanelSkeleton titleWidth="w-32" subtitle={false} action="w-16" bodyClassName="p-0">
                <PanelListSkeleton rows={5} trailing="w-10" />
              </PanelSkeleton>
              <PanelSkeleton titleWidth="w-24" bodyClassName="p-3">
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
                  <Repeat count={7}>
                    {(i) => (
                      <div key={i} className="flex items-center gap-3 px-2.5 py-2">
                        <Skeleton className="size-8 shrink-0 rounded-lg" />
                        <Skeleton className={cn('h-3', ['w-24', 'w-20', 'w-28', 'w-16'][i % 4])} />
                      </div>
                    )}
                  </Repeat>
                </div>
              </PanelSkeleton>
            </div>
          </div>
        </div>
      </div>
    </SkeletonRegion>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Catalogue lists — products, courses, academies
 * ═══════════════════════════════════════════════════════════════════════════ */

/** admin/products/page.tsx */
export function AdminProductsSkeleton() {
  return (
    <ListPage bar={{ count: true, search: true, actions: ['icon'], primary: 'w-32' }}>
      <PageHeaderSkeleton titleWidth="w-40 sm:w-48" />
      <StatStripSkeleton />
      <ToolbarSkeleton>
        <PillTabsSkeleton tabs={[20, 34, 52, 52]} />
        <SelectSkeleton />
        <div className="ms-auto flex items-center justify-end gap-1.5">
          <SegmentedToggleSkeleton />
        </div>
      </ToolbarSkeleton>
      <AdminCardGrid kind="product" />
    </ListPage>
  );
}

/** admin/courses/page.tsx */
export function AdminCoursesSkeleton() {
  return (
    <ListPage bar={{ count: true, search: true, actions: ['icon'], primary: 'w-32' }}>
      <PageHeaderSkeleton titleWidth="w-36 sm:w-44" badge={BADGE} />
      <StatStripSkeleton
        rounded="rounded-xl"
        icon="size-9 rounded-full"
        grid="grid grid-cols-2 divide-border/70 sm:grid-cols-4 sm:divide-x rtl:sm:divide-x-reverse [&>*:nth-child(-n+2)]:border-b [&>*:nth-child(-n+2)]:border-border/70 sm:[&>*:nth-child(-n+2)]:border-b-0"
      />
      <ToolbarSkeleton>
        <PillTabsSkeleton tabs={[20, 34, 52, 52]} />
        <Skeleton className="h-9 w-36 shrink-0 rounded-full border border-border/80 bg-card" />
        <SelectSkeleton />
        <div className="ms-auto flex items-center justify-end gap-1.5">
          <SegmentedToggleSkeleton />
        </div>
      </ToolbarSkeleton>
      <AdminCardGrid kind="course" />
    </ListPage>
  );
}

/** admin/academies/page.tsx */
export function AdminAcademiesSkeleton() {
  return (
    <ListPage bar={{ count: true, search: true, actions: ['icon', 'button'], primary: 'w-36' }}>
      <PageHeaderSkeleton titleWidth="w-40 sm:w-52" badge={BADGE} />
      <StatStripSkeleton />
      <ToolbarSkeleton>
        <PillTabsSkeleton tabs={[20, 34, 52, 52]} />
        <div className="ms-auto flex items-center justify-end gap-1.5">
          <SegmentedToggleSkeleton />
        </div>
      </ToolbarSkeleton>
      <AdminCardGrid kind="academy" />
    </ListPage>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Editors — the shared editor kit
 * ═══════════════════════════════════════════════════════════════════════════ */

/** admin/products/[slug]/edit — ProductFormSections. */
export function ProductEditorSkeleton() {
  return (
    <EditorShellSkeleton
      crumbs={['w-20', 'w-40']}
      barActions={['button']}
      railSections={6}
      checks={6}
      sections={[
        { hint: true, rows: ['bilingual', 'bilingual', 'bilingual-area', 'grid3'] },
        { hint: true, rows: ['grid3', 'grid3'] },
        { hint: true, rows: ['grid2'] },
        { hint: true, rows: ['media'] },
      ]}
    />
  );
}

/** admin/academies/[slug]/edit. */
export function AcademyEditorSkeleton() {
  return (
    <EditorShellSkeleton
      crumbs={['w-24', 'w-40']}
      barActions={['button', 'button']}
      railSections={4}
      checks={5}
      sections={[
        { hint: true, rows: ['media'] },
        { hint: true, rows: ['bilingual', 'bilingual', 'bilingual-area'] },
        { hint: true, rows: ['list'] },
      ]}
    />
  );
}

/** admin/courses/[slug]/edit — CourseStudio, which opens on the basics step. */
export function CourseStudioSkeleton() {
  return (
    <EditorShellSkeleton
      crumbs={['w-20', 'w-40']}
      barActions={[]}
      header={{ extraActions: 2, preview: false }}
      railSections={6}
      checks={6}
      sections={[{ hint: true, rows: ['bilingual', 'bilingual', 'bilingual-area', 'grid3'] }, { hint: true, rows: ['media'] }]}
    />
  );
}

/** `/new` routes — CreateEntityPage: one centred card. */
export function CreateEntitySkeleton({ kind }: { kind: 'product' | 'course' | 'academy' }) {
  return (
    <SkeletonRegion>
      <div className="flex min-h-[70vh] items-start justify-center px-4 pt-10 sm:pt-16">
        <div className="mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
          <div className="flex flex-col gap-1.5 px-6 pb-2 pt-6">
            <div className="flex h-9 items-center">
              <Skeleton className="h-6 w-48" />
            </div>
            <Skeleton className="h-3 w-3/4" />
          </div>
          <div className="flex flex-col gap-5 px-6 py-5">
            <div className="space-y-1.5">
              <FieldSkeleton control="h-11" />
              <Skeleton className="h-2.5 w-44" />
            </div>
            {kind === 'product' && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FieldSkeleton control="h-11" label="w-20" />
                <FieldSkeleton control="h-11" label="w-20" />
              </div>
            )}
            {kind === 'course' && (
              <>
                <FieldSkeleton control="h-11" label="w-20" />
                <div className="space-y-2">
                  <Skeleton className="mb-2 h-3 w-24" />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <Repeat count={3}>
                      {(i) => <Skeleton key={i} className="h-[4.5rem] rounded-xl border border-border bg-card" />}
                    </Repeat>
                  </div>
                </div>
              </>
            )}
            {kind === 'academy' && (
              <div className="space-y-2">
                <Skeleton className="mb-2 h-3 w-16" />
                <div className="flex flex-wrap gap-2">
                  <Repeat count={6}>{(i) => <Skeleton key={i} className="size-10 rounded-full" />}</Repeat>
                </div>
              </div>
            )}
            <Skeleton className="h-14 w-full rounded-xl" shimmer={false} />
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-border/70 bg-muted/40 px-6 py-4 sm:flex-row sm:justify-end">
            <Skeleton className="h-11 w-full rounded-full sm:w-24" />
            <Skeleton className="h-11 w-full rounded-full bg-primary/25 sm:w-40" />
          </div>
        </div>
      </div>
    </SkeletonRegion>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * People — learners, staff, roles, audit
 * ═══════════════════════════════════════════════════════════════════════════ */

const LEARNER_COLUMNS: ColumnSpec[] = [
  { cell: 'person', size: 3, header: 56 },
  { cell: 'pill', size: 1.4, hideBelow: 'sm', header: 44 },
  { cell: 'text2', size: 1.6, hideBelow: 'sm', header: 88 },
  { cell: 'actions', size: '5rem', hideBelow: 'sm', header: 48 },
];

/** The learners table, shared with admin/users/page.tsx's loading branch. */
export function LearnersTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <TableCardSkeleton columns={LEARNER_COLUMNS} rows={rows} rowClassName="px-4 py-3.5 sm:px-6" footer />
  );
}

/** admin/users/page.tsx */
export function AdminUsersSkeleton() {
  return (
    <ListPage bar={{ count: true, search: true, actions: ['icon'] }}>
      <PageHeaderSkeleton titleWidth="w-36 sm:w-44" badge={BADGE} />
      <KpiGridSkeleton />
      <ToolbarSkeleton>
        <PillTabsSkeleton tabs={[20, 40, 72, 60]} />
        <DateRangeSkeleton />
      </ToolbarSkeleton>
      <LearnersTableSkeleton />
    </ListPage>
  );
}

const STAFF_COLUMNS: ColumnSpec[] = [
  { cell: 'person', size: 3, header: 60 },
  { cell: 'pill', size: 1.2, hideBelow: 'sm', header: 36 },
  { cell: 'text2', size: 1.4, hideBelow: 'md', header: 64 },
  { cell: 'pill', size: 1.1, hideBelow: 'lg', header: 48 },
  { cell: 'text', size: 1.1, hideBelow: 'lg', header: 44 },
  { cell: 'date', size: 1, hideBelow: 'xl', header: 64 },
  { cell: 'actions', size: '5rem', hideBelow: 'sm', header: 48 },
];

/** The staff table, shared with admin/staff/page.tsx's loading branch. */
export function StaffTableSkeleton({ rows = 8 }: { rows?: number }) {
  return <TableCardSkeleton columns={STAFF_COLUMNS} rows={rows} rowClassName="px-4 py-4 sm:px-6" footer />;
}

/** admin/staff/page.tsx */
export function AdminStaffSkeleton() {
  return (
    <ListPage bar={{ count: true, search: true, actions: ['icon', 'button', 'button'], primary: 'w-32', crumbs: ['w-36', 'w-24'] }}>
      <PageHeaderSkeleton titleWidth="w-44 sm:w-56" badge={BADGE} />
      <KpiGridSkeleton />
      <ToolbarSkeleton>
        <PillTabsSkeleton tabs={[20, 64, 48, 72]} />
        <Skeleton className="h-9 w-32 shrink-0 rounded-lg border border-border/70 bg-card" />
        <div className="ms-auto flex items-center justify-end gap-1.5">
          <SegmentedToggleSkeleton />
        </div>
      </ToolbarSkeleton>
      <StaffTableSkeleton />
    </ListPage>
  );
}

/** One role row in admin/staff/roles/page.tsx. */
export function RoleRowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex-1">
      <Repeat count={rows}>
        {(i) => (
          <div key={i} className="flex items-center justify-between border-b border-border/70 p-5 last:border-b-0">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <Skeleton className="size-11 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className={cn('h-4', ['w-36', 'w-28', 'w-44', 'w-32', 'w-40'][i % 5])} />
                <Skeleton className="h-3 w-2/3 max-w-xs" />
              </div>
            </div>
            <div className="hidden w-[260px] items-center justify-end gap-6 md:flex">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        )}
      </Repeat>
    </div>
  );
}

/** admin/staff/roles/page.tsx */
export function AdminRolesSkeleton() {
  return (
    <ListPage bar={{ crumbs: ['w-28', 'w-14'], primary: 'w-28' }}>
      <PageHeaderSkeleton titleWidth="w-40 sm:w-56" badge={BADGE} />
      <div className="flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs">
        <div className="hidden items-center justify-between border-b border-border/70 bg-muted/40 px-6 py-3 md:flex">
          <Skeleton className="h-2.5 w-10" shimmer={false} />
          <Skeleton className="h-2.5 w-24" shimmer={false} />
        </div>
        <RoleRowsSkeleton />
      </div>
    </ListPage>
  );
}

/** The audit entries, shared with staff/audit/audit-log.tsx's loading branch. */
export function AuditRowsSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/70 bg-card">
      <Repeat count={rows}>
        {(i) => (
          <div key={i} className="px-4 py-3">
            {/* Same three lines as an entry: action and time, the actor line, the "details" toggle. */}
            <div className="flex h-5 items-center justify-between gap-4">
              <Skeleton className={cn('h-3', ['w-40', 'w-32', 'w-48', 'w-36'][i % 4])} />
              <Skeleton className="h-2.5 w-28" />
            </div>
            <div className="mt-0.5 flex h-4 items-center">
              <Skeleton className="h-2.5 w-1/3" />
            </div>
            <div className="mt-1.5 flex h-4 items-center">
              <Skeleton className="h-2.5 w-12 bg-primary/20" shimmer={false} />
            </div>
          </div>
        )}
      </Repeat>
    </div>
  );
}

/** The whole audit body: filter form, entries, pager (the page's Suspense fallback). */
export function AuditLogBodySkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-72 max-w-full rounded-md border border-input bg-card" />
        <Skeleton className="h-9 w-20 rounded-md bg-primary/25" />
      </div>
      <AuditRowsSkeleton rows={rows} />
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-24 rounded-md" />
        <Skeleton className="h-2.5 w-12" />
        <Skeleton className="h-9 w-20 rounded-md" />
      </div>
    </div>
  );
}

/** admin/staff/audit/page.tsx — no command bar, a header, then the log. */
export function AdminAuditSkeleton() {
  return (
    <SkeletonRegion>
      <div className="mx-auto w-full max-w-[1500px] space-y-6">
        <PageHeaderSkeleton titleWidth="w-40 sm:w-52" />
        <AuditLogBodySkeleton />
      </div>
    </SkeletonRegion>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Operations — certificates, quotes, finance, analytics, alerts, partners
 * ═══════════════════════════════════════════════════════════════════════════ */

/** The issued tab of admin/certificates/page.tsx under the page header. */
export function CertificatesIssuedSkeleton() {
  return (
    <div className="space-y-6">
      <StatStripSkeleton rounded="rounded-xl" icon="size-10 rounded-full" />
      <ToolbarSkeleton>
        <PillTabsSkeleton tabs={[20, 40, 52, 48]} />
        <SelectSkeleton />
        <DateRangeSkeleton />
      </ToolbarSkeleton>
      <AdminCardGrid kind="certificate" count={4} />
    </div>
  );
}

/** admin/certificates/page.tsx */
export function AdminCertificatesSkeleton() {
  return (
    <ListPage bar={{ count: true, search: true, actions: ['icon'], primary: 'w-36' }}>
      <PageHeaderSkeleton titleWidth="w-44 sm:w-56" badge={BADGE} />
      <PillTabsSkeleton tabs={[44, 64]} counts={false} />
      <CertificatesIssuedSkeleton />
    </ListPage>
  );
}

/** The quote rows, shared with quotes/quotes-inbox.tsx's loading branch. */
export function QuoteRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      <Repeat count={rows}>
        {(i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-xs">
            <Skeleton className="h-[22px] w-20 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className={cn('h-3', ['w-1/2', 'w-2/5', 'w-3/5'][i % 3])} />
              <Skeleton className="h-2.5 w-1/3" />
            </div>
            <Skeleton className="h-2.5 w-16 shrink-0" />
            <Skeleton className="size-4 shrink-0 rounded" shimmer={false} />
          </div>
        )}
      </Repeat>
    </div>
  );
}

/** The whole inbox: filter bar and rows (the page's Suspense fallback). */
export function QuotesInboxSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-card p-2 shadow-xs">
        <div className="w-full sm:w-auto">
          <PillTabsSkeleton tabs={[20, 28, 56, 44, 40]} counts={false} />
        </div>
        <Skeleton className="ms-auto h-10 w-full rounded-md border border-input bg-card sm:w-64" />
      </div>
      <QuoteRowsSkeleton rows={rows} />
    </div>
  );
}

/** admin/quotes/page.tsx */
export function AdminQuotesSkeleton() {
  return (
    <SkeletonRegion>
      <div className="mx-auto w-full max-w-[1500px] space-y-6">
        <PageHeaderSkeleton titleWidth="w-40 sm:w-52" />
        <QuotesInboxSkeleton />
      </div>
    </SkeletonRegion>
  );
}

/** The budgets table in admin/finance/page.tsx. */
export function BudgetsTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs">
      <div className="border-b border-border/70 bg-surface-sunken/40 px-4 py-2.5 sm:px-5">
        <div className="grid h-4 grid-cols-12 items-center gap-2">
          <Repeat count={6}>
            {(i) => (
              <Skeleton key={i} className={cn('col-span-2 h-2.5 w-12', i >= 2 && 'ms-auto')} shimmer={false} />
            )}
          </Repeat>
        </div>
      </div>
      <Repeat count={rows}>
        {(i) => (
          <div key={i} className="grid grid-cols-12 items-center gap-2 border-b border-border/60 px-5 py-3 last:border-0">
            <Skeleton className="col-span-2 h-[22px] w-16 rounded-full" />
            <Skeleton className="col-span-2 h-3 w-20" />
            <Skeleton className="col-span-2 ms-auto h-3 w-14" />
            <Skeleton className="col-span-2 ms-auto h-3 w-14" />
            <Skeleton className="col-span-2 ms-auto h-3 w-12" />
            <div className="col-span-2 flex justify-end gap-1">
              <Skeleton className="size-8 rounded-lg" />
              <Skeleton className="size-8 rounded-lg" />
            </div>
          </div>
        )}
      </Repeat>
      <div className="flex items-center border-t border-border/70 bg-surface-sunken/30 px-4 py-3 sm:px-5">
        <Skeleton className="h-2.5 w-24" />
      </div>
    </div>
  );
}

/** admin/finance/page.tsx */
export function AdminFinanceSkeleton() {
  return (
    <ListPage bar={{ actions: ['icon'], primary: 'w-32' }}>
      <PageHeaderSkeleton titleWidth="w-32 sm:w-40" />
      <KpiGridSkeleton />
      <ToolbarSkeleton>
        <PillTabsSkeleton tabs={[64, 48, 56, 40]} counts={false} />
      </ToolbarSkeleton>
      <BudgetsTableSkeleton />
    </ListPage>
  );
}

/** A `TrendChart` panel (analytics-charts.tsx): header and a 260px plot. */
function TrendChartSkeleton({ legend = true }: { legend?: boolean }) {
  return (
    <PanelSkeleton variant="card" titleWidth="w-40">
      <div className="flex h-[260px] items-end gap-2">
        {[40, 62, 48, 78, 55, 88, 70, 64, 82].map((h, i) => (
          <Skeleton key={i} className="flex-1 rounded-b-none rounded-t-md" style={{ height: `${h}%` }} shimmer={false} />
        ))}
      </div>
      {/* The "compared with the previous period" legend under each series chart. */}
      {legend && (
        <div className="flex h-6 items-center gap-4">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-2.5 w-32" />
        </div>
      )}
    </PanelSkeleton>
  );
}

/** A "top courses" row: rank, title over a progress bar and a count line. */
function RankedRowSkeleton({ i }: { i: number }) {
  return (
    <div className="flex h-[76px] items-center gap-3 border-b border-border/60 last:border-b-0">
      <Skeleton className="size-8 shrink-0 rounded-full" shimmer={false} />
      <div className="min-w-0 flex-1">
        <div className="flex h-5 items-center">
          <Skeleton className={cn('h-3', ['w-2/5', 'w-1/3', 'w-1/2', 'w-1/4', 'w-2/5'][i % 5])} />
        </div>
        <Skeleton className="mt-1.5 h-1 w-full rounded-full" shimmer={false} />
        <div className="mt-1.5 flex h-4 items-center">
          <Skeleton className="h-2.5 w-20" />
        </div>
      </div>
      <Skeleton className="h-3 w-3 shrink-0" />
    </div>
  );
}

/** An insight card: icon, label, figure, explanation and a link. */
function InsightCardSkeleton() {
  return (
    <div className="space-y-2 rounded-xl border border-border/70 bg-card p-4">
      <Skeleton className="size-8 rounded-lg" shimmer={false} />
      <div className="flex h-5 items-center">
        <Skeleton className="h-3 w-3/5" />
      </div>
      <Skeleton className="h-7 w-10" />
      <div className="flex h-4 items-center">
        <Skeleton className="h-2.5 w-4/5" />
      </div>
      <div className="flex h-6 items-center">
        <Skeleton className="h-2.5 w-20" />
      </div>
    </div>
  );
}

/** The analytics body under the range bar, shared with analytics-dashboard.tsx. */
export function AnalyticsBodySkeleton() {
  return (
    <div className="space-y-6">
      <KpiGridSkeleton count={7} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" sparkline />
      {/* Four series charts and the revenue chart share one two-column grid. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Repeat count={4}>{(i) => <TrendChartSkeleton key={i} />}</Repeat>
        <TrendChartSkeleton legend={false} />
      </div>
      {/* Top courses by enrolment and by completion. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Repeat count={2}>
          {(i) => (
            <PanelSkeleton key={i} variant="card" titleWidth="w-44" action="w-6">
              <Repeat count={5}>{(r) => <RankedRowSkeleton key={r} i={r + i} />}</Repeat>
            </PanelSkeleton>
          )}
        </Repeat>
      </div>
      {/* Top products by revenue, and the actionable insights grid. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PanelSkeleton variant="card" titleWidth="w-48" action="w-6">
          <PanelListSkeleton rows={5} lead="square" trailing="w-12" rowClassName="py-3" />
        </PanelSkeleton>
        <PanelSkeleton variant="card" titleWidth="w-36" action="w-16">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Repeat count={4}>{(i) => <InsightCardSkeleton key={i} />}</Repeat>
          </div>
        </PanelSkeleton>
      </div>
      {/* Recent activity timeline. */}
      <PanelSkeleton variant="card" titleWidth="w-32" action="w-24">
        <PanelListSkeleton rows={3} lead="circle" trailing="w-12" rowClassName="py-2.5" />
      </PanelSkeleton>
      {/* "Last updated" footer line. */}
      <div className="flex h-[42px] items-center justify-between rounded-xl border border-dashed border-border/80 px-4">
        <Skeleton className="h-2.5 w-48" />
        <Skeleton className="h-2.5 w-24" />
      </div>
    </div>
  );
}

/** components/admin/analytics-dashboard.tsx */
export function AdminAnalyticsSkeleton() {
  return (
    <ListPage bar={{ actions: ['button', 'icon'] }}>
      <PageHeaderSkeleton titleWidth="w-36 sm:w-44" badge={BADGE} />
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-card p-2 shadow-xs">
        <PillTabsSkeleton tabs={[24, 28, 28, 28, 24]} counts={false} />
        <Skeleton className="h-9 w-44 rounded-lg border border-border/80 bg-card" />
        <Skeleton className="ms-auto hidden h-2.5 w-40 sm:block" />
      </div>
      <AnalyticsBodySkeleton />
    </ListPage>
  );
}

/** The alert list, shared with admin/alerts/page.tsx's loading branch. */
export function AlertListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2.5">
      <Repeat count={rows}>
        {(i) => (
          <div key={i} className="flex items-start gap-3.5 rounded-xl border border-border/60 bg-card p-4 shadow-xs">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2 pt-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className={cn('h-3.5', ['w-1/2', 'w-2/5', 'w-3/5'][i % 3])} />
                <Skeleton className="h-[18px] w-16 rounded-full" />
              </div>
              <Skeleton className="h-2.5 w-4/5" />
              <Skeleton className="h-2.5 w-1/3" />
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Skeleton className="size-8 rounded-lg" />
              <Skeleton className="size-8 rounded-lg" />
            </div>
          </div>
        )}
      </Repeat>
    </div>
  );
}

/** admin/alerts/page.tsx */
export function AdminAlertsSkeleton() {
  return (
    <ListPage width="max-w-[1400px]" bar={{ count: true, actions: ['button'], primary: 'w-36' }}>
      <PageHeaderSkeleton titleWidth="w-40 sm:w-52" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Repeat count={3}>
          {(i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-xs">
              <Skeleton className="size-10 shrink-0 rounded-lg" />
              <div className="min-w-0 space-y-2">
                <Skeleton className="h-7 w-16" />
                <Skeleton className="h-2.5 w-14" />
              </div>
            </div>
          )}
        </Repeat>
      </div>
      <ToolbarSkeleton>
        <PillTabsSkeleton tabs={[72, 44, 44, 28]} />
        <PillTabsSkeleton tabs={[56, 48, 40, 52]} />
        <Skeleton className="ms-auto h-[30px] w-28 rounded-full border border-border/80 bg-card" />
      </ToolbarSkeleton>
      <AlertListSkeleton />
    </ListPage>
  );
}

/** The application list in admin/partners/page.tsx. */
export function PartnerApplicationsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <Repeat count={rows}>
        {(i) => (
          <div key={i} className="space-y-2.5 rounded-xl border border-border/70 bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between gap-3">
              <div className="flex h-7 items-center">
                <Skeleton className={cn('h-4', ['w-48', 'w-36', 'w-56'][i % 3])} />
              </div>
              <Skeleton className="h-[22px] w-24 rounded-full" />
            </div>
            <Skeleton className="h-2.5 w-2/3" />
            <div className="max-w-prose space-y-2 py-1">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Repeat count={3}>{(j) => <Skeleton key={j} className="h-9 w-24 rounded-lg" />}</Repeat>
            </div>
          </div>
        )}
      </Repeat>
    </div>
  );
}

/** admin/partners/page.tsx — header with a status select, then the list. */
export function AdminPartnersSkeleton() {
  return (
    <SkeletonRegion>
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <PageHeaderSkeleton titleWidth="w-52 sm:w-72" description={false} badge="h-10 w-full rounded-lg md:w-28" />
        <PartnerApplicationsSkeleton />
      </div>
    </SkeletonRegion>
  );
}

/** The integrations panel body, shared with integrations-panel.tsx. */
export function IntegrationCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <CardGridSkeleton
      count={count}
      className="grid grid-cols-1 gap-4 lg:grid-cols-2"
      card={(i) => (
        <div className="h-full rounded-xl border border-border/70 bg-card shadow-xs">
          <div className="flex flex-col gap-1.5 p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2.5">
                <Skeleton className={cn('h-4', ['w-32', 'w-40', 'w-28'][i % 3])} />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <Skeleton className="h-[22px] w-24 shrink-0 rounded-full" />
            </div>
          </div>
          <div className="space-y-3 p-6 pt-0">
            <Skeleton className="h-2.5 w-1/2" />
            <div className="flex flex-wrap items-center gap-1.5">
              <Skeleton className="h-9 w-24 rounded-md" />
              <Skeleton className="h-9 w-28 rounded-md" />
            </div>
            <div className="border-t border-border/60 pt-3">
              <Skeleton className="h-2.5 w-14" />
            </div>
          </div>
        </div>
      )}
    />
  );
}

/** IntegrationsPanel as a whole: its own header, then the cards (Suspense fallback). */
export function IntegrationsPanelSkeleton() {
  return (
    <div className="space-y-5">
      <div>
        <div className="flex h-7 items-center">
          <Skeleton className="h-5 w-40" />
        </div>
        <Skeleton className="mt-2 h-3 w-2/3 max-w-lg" />
        <div className="mt-3 flex items-center gap-2">
          <Skeleton className="size-4 shrink-0 rounded" shimmer={false} />
          <Skeleton className="h-8 w-full max-w-xs rounded-md border border-input bg-card" />
        </div>
      </div>
      <IntegrationCardsSkeleton />
    </div>
  );
}

/** admin/integrations/page.tsx */
export function AdminIntegrationsSkeleton() {
  return (
    <SkeletonRegion>
      <div className="mx-auto w-full max-w-[1500px] space-y-6">
        <PageHeaderSkeleton titleWidth="w-40 sm:w-52" />
        <IntegrationsPanelSkeleton />
      </div>
    </SkeletonRegion>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Configuration — settings, AI assistant, theme, email, navigation
 * ═══════════════════════════════════════════════════════════════════════════ */

/** admin/settings/page.tsx */
export function AdminSettingsSkeleton() {
  return (
    <SkeletonRegion>
      <div className="w-full">
        <CommandBarSkeleton crumbs={['w-16']} />
        <div className="space-y-6 pt-6">
          <div className="mx-auto w-full max-w-6xl">
            <PageHeaderSkeleton titleWidth="w-36 sm:w-44" badge="h-[30px] w-28 rounded-full" />
          </div>
          <FormLayoutSkeleton
            aside={
              <>
                <SectionNavSkeleton items={4} />
                <AsideCardSkeleton eyebrow={false}>
                  <Skeleton className="h-2.5 w-20" />
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-7 w-full rounded-lg" />
                </AsideCardSkeleton>
              </>
            }
          >
            {/* Identity: name, a three-line description with a hint, the custom domain with a hint. */}
            <FormSectionSkeleton>
              <div className="space-y-5">
                <FieldSkeleton />
                <SettingsHintedField control="h-[102px]" />
                <SettingsHintedField />
              </div>
            </FormSectionSkeleton>
            {/* Branding: logo and favicon URLs, three colour fields with their preset swatches, the
                font field with its suggestion chips, and the live preview column from lg. */}
            <FormSectionSkeleton bodyClassName="p-0">
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div className="space-y-6 p-4 sm:p-5">
                  <FormSectionRows rows={['grid2']} />
                  <div className="space-y-5">
                    <Repeat count={3}>{(i) => <SettingsColorField key={i} />}</Repeat>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex h-[18px] items-center">
                      <Skeleton className="h-2.5 w-16" />
                    </div>
                    <Skeleton className="h-10 w-full rounded-lg" />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {['w-12', 'w-12', 'w-16', 'w-20', 'w-24', 'w-28', 'w-28'].map((w, i) => (
                        <Skeleton key={i} className={cn('h-[26px] rounded-full', w)} />
                      ))}
                    </div>
                    <div className="flex h-5 items-center">
                      <Skeleton className="h-2.5 w-56 max-w-full" />
                    </div>
                  </div>
                </div>
                <div className="border-t border-border/70 bg-muted/30 p-5 sm:p-6 lg:border-s lg:border-t-0">
                  <div className="flex h-4 items-center">
                    <Skeleton className="h-2.5 w-24" />
                  </div>
                  <Skeleton className="mt-3 h-48 w-full rounded-xl" />
                </div>
              </div>
            </FormSectionSkeleton>
            {/* Analytics: two measurement IDs side by side. */}
            <FormSectionSkeleton rows={['grid2']} />
            {/* Tools: two link cards. */}
            <FormSectionSkeleton bodyClassName="p-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Repeat count={2}>
                  {(i) => (
                    <div key={i} className="flex h-[74px] items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-xs">
                      <div className="flex min-w-0 items-center gap-3">
                        <Skeleton className="size-10 shrink-0 rounded-xl" shimmer={false} />
                        <div className="space-y-2">
                          <Skeleton className="h-3.5 w-24" />
                          <Skeleton className="h-2.5 w-40" />
                        </div>
                      </div>
                      <Skeleton className="h-2.5 w-14" />
                    </div>
                  )}
                </Repeat>
              </div>
            </FormSectionSkeleton>
          </FormLayoutSkeleton>
        </div>
      </div>
    </SkeletonRegion>
  );
}

function FormSectionRows({ rows }: { rows: Array<'grid2' | 'color' | 'field'> }) {
  return (
    <>
      {rows.map((r, i) =>
        r === 'grid2' ? (
          <div key={i} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldSkeleton label="w-20" />
            <FieldSkeleton label="w-24" />
          </div>
        ) : r === 'color' ? (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="size-10 shrink-0 rounded-lg" />
            <Skeleton className="h-10 flex-1 rounded-lg" />
          </div>
        ) : (
          <FieldSkeleton key={i} />
        ),
      )}
    </>
  );
}

/** A field with a one-line hint under the control, as the settings form renders it. */
function SettingsHintedField({ control = 'h-10' }: { control?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex h-[18px] items-center">
        <Skeleton className="h-2.5 w-24" />
      </div>
      <Skeleton className={cn('w-full rounded-lg', control)} />
      <div className="flex h-5 items-center">
        <Skeleton className="h-2.5 w-64 max-w-full" />
      </div>
    </div>
  );
}

/** `ColorField`: label, swatch beside the hex input, then the row of preset swatches. */
function SettingsColorField() {
  return (
    <div className="space-y-1.5">
      <div className="flex h-[18px] items-center">
        <Skeleton className="h-2.5 w-24" />
      </div>
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <Skeleton className="h-10 flex-1 rounded-lg" />
        </div>
        <div className="flex gap-1.5">
          <Repeat count={6}>{(i) => <Skeleton key={i} className="size-6 rounded-full" shimmer={false} />}</Repeat>
        </div>
      </div>
    </div>
  );
}

/** admin/settings/ai-assistant/page.tsx */
export function AiAssistantSettingsSkeleton() {
  return (
    <SkeletonRegion>
      <div className="w-full">
        <CommandBarSkeleton crumbs={['w-16', 'w-24']} actions={['button']} />
        <div className="space-y-6 pt-6">
          <div className="mx-auto w-full max-w-6xl">
            <PageHeaderSkeleton titleWidth="w-44 sm:w-60" badge="h-[22px] w-24 rounded-full" />
          </div>
          <FormLayoutSkeleton aside={<SectionNavSkeleton items={5} />}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Repeat count={3}>
                {(i) => (
                  <div key={i} className="h-full rounded-xl border border-border/70 bg-card p-5 shadow-xs">
                    <Skeleton className="h-2.5 w-24" />
                    <div className="mt-2.5 flex h-5 items-center gap-2">
                      <Skeleton className="size-4 rounded" shimmer={false} />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                )}
              </Repeat>
            </div>
            <FormSectionSkeleton rows={['grid2', 'field', 'grid2', 'switch']} />
            <FormSectionSkeleton rows={['area']} />
            <FormSectionSkeleton rows={['grid3']} />
          </FormLayoutSkeleton>
        </div>
      </div>
    </SkeletonRegion>
  );
}

/** admin/theme/theme-editor.tsx */
/** `TokenField`: label, swatch beside the hex input, then the contrast read-out line. */
function ThemeTokenFieldSkeleton() {
  return (
    <div className="h-[100px]">
      <div className="flex h-[18px] items-center">
        <Skeleton className="h-2.5 w-24" />
      </div>
      <div className="mt-[7px] flex items-center gap-2">
        <Skeleton className="h-[38px] flex-1 rounded-lg" />
        <Skeleton className="size-[38px] shrink-0 rounded-lg" />
      </div>
      <div className="mt-[17px] flex h-5 items-center justify-between">
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="h-[15px] w-9 rounded-full" shimmer={false} />
      </div>
    </div>
  );
}

/** `PreviewPanel`: header, the storefront mock, and the footer line naming mode and fonts. */
function ThemePreviewSkeleton() {
  return (
    <div className="shrink-0 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      <div className="flex h-[79px] flex-col justify-center gap-2 border-b border-border/70 px-5">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-2.5 w-44" />
      </div>
      <div className="h-[689px] p-4">
        <Skeleton className="h-full w-full rounded-xl" shimmer={false} />
      </div>
      <div className="flex h-[41px] items-center justify-between border-t border-border/70 px-5">
        <Skeleton className="h-2.5 w-12" />
        <Skeleton className="h-2.5 w-36" />
      </div>
    </div>
  );
}

export function ThemeEditorSkeleton() {
  return (
    <SkeletonRegion>
      <div className="w-full">
        <CommandBarSkeleton crumbs={['w-16']} live={false} actions={['button', 'button']} primary="w-28" />
        <div className="space-y-6 pt-6">
          <div className="mx-auto w-full max-w-[1600px]">
            <PageHeaderSkeleton titleWidth="w-32 sm:w-40" badge="h-[22px] w-20 rounded-full" />
          </div>
          <FormLayoutSkeleton
            className="max-w-[1600px] xl:grid-cols-[minmax(0,34rem)_minmax(0,1fr)]"
            aside={
              // The rail is capped at the viewport like the real one, so the preview is cut at the
              // same line instead of ending early.
              <div className="flex flex-col gap-4 xl:max-h-[calc(100vh-8rem)] xl:overflow-hidden">
                <SectionNavSkeleton items={4} className="max-w-[17rem]" />
                <ThemePreviewSkeleton />
              </div>
            }
          >
            {/* Typography: heading and body font pickers side by side, each a 2×2 grid of "Ag" tiles. */}
            <FormSectionSkeleton>
              <div className="grid gap-5 sm:grid-cols-2">
                <Repeat count={2}>
                  {(group) => (
                    <div key={group} className="space-y-2">
                      <Skeleton className="h-3 w-24" />
                      <div className="grid grid-cols-2 gap-2">
                        <Repeat count={4}>
                          {(i) => (
                            <div key={i} className="flex h-[81px] flex-col items-start gap-1.5 rounded-xl border border-border/70 px-3 py-2.5">
                              <Skeleton className="h-6 w-7" />
                              <Skeleton className="h-2.5 w-14" />
                              <Skeleton className="h-2 w-10" shimmer={false} />
                            </div>
                          )}
                        </Repeat>
                      </div>
                    </div>
                  )}
                </Repeat>
              </div>
            </FormSectionSkeleton>
            <FormSectionSkeleton rows={['grid3', 'grid3']} />
            {/* Colours: light/dark tabs, then brand, surfaces, text and borders groups of token fields. */}
            <FormSectionSkeleton actions="w-[93px] rounded-full">
              <div className="space-y-6">
                {[3, 3, 3, 2].map((count, group) => (
                  <div key={group}>
                    <div className="mb-3 flex h-4 items-center gap-3">
                      <Skeleton className="h-2.5 w-16" />
                      <span className="h-px flex-1 bg-border/70" aria-hidden="true" />
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Repeat count={count}>{(i) => <ThemeTokenFieldSkeleton key={i} />}</Repeat>
                    </div>
                  </div>
                ))}
              </div>
            </FormSectionSkeleton>
            {/* Contrast: four checked pairs, each with its ratio chip. */}
            <FormSectionSkeleton>
              <div className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/70">
                <Repeat count={4}>
                  {(i) => (
                    <div key={i} className="flex h-[39px] items-center justify-between gap-3 bg-card px-3.5">
                      <Skeleton className={cn('h-2.5', ['w-40', 'w-36', 'w-44', 'w-32'][i])} />
                      <Skeleton className="h-5 w-24 rounded-full" />
                    </div>
                  )}
                </Repeat>
              </div>
            </FormSectionSkeleton>
          </FormLayoutSkeleton>
        </div>
      </div>
    </SkeletonRegion>
  );
}

/** The template list, shared with email-templates-list.tsx's loading branch. */
export function EmailTemplateRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs">
      <Repeat count={rows}>
        {(i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border/60 px-4 py-3.5 last:border-b-0">
            <Skeleton className="size-9 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className={cn('h-3', ['w-1/3', 'w-2/5', 'w-1/4'][i % 3])} />
              <Skeleton className="h-2.5 w-1/4" />
            </div>
            <Skeleton className="hidden h-2.5 w-20 md:block" />
            <Skeleton className="h-[22px] w-16 shrink-0 rounded-full" />
          </div>
        )}
      </Repeat>
    </div>
  );
}

/** components/admin/email-templates-list.tsx */
export function AdminEmailSkeleton() {
  return (
    <ListPage bar={{ crumbs: ['w-12', 'w-24'], live: false, count: true, primary: 'w-36' }}>
      <PageHeaderSkeleton titleWidth="w-40 sm:w-52" />
      <div className="flex flex-wrap gap-1.5">
        {/* "All" plus one chip per template category (learning, commerce, community, system, guidance, auth). */}
        <Repeat count={7}>{(i) => <Skeleton key={i} className="h-[26px] w-20 rounded-full border border-border/70 bg-card" />}</Repeat>
      </div>
      <EmailTemplateRowsSkeleton />
    </ListPage>
  );
}

/** components/admin/email-template-editor.tsx */
export function EmailTemplateEditorSkeleton() {
  return (
    <SkeletonRegion>
      <div className="w-full">
        <CommandBarSkeleton crumbs={['w-12', 'w-24', 'w-32']} live={false} primary="w-28" />
        <div className="space-y-6 pt-6">
          <div className="mx-auto w-full max-w-[1500px]">
            <PageHeaderSkeleton titleWidth="w-48 sm:w-72" badge="h-[22px] w-20 rounded-full" />
          </div>
          <div className="mx-auto w-full max-w-[1500px] xl:hidden">
            <Skeleton className="h-10 w-full rounded-full" />
          </div>
          <div className="mx-auto grid w-full max-w-[1500px] grid-cols-1 items-start gap-6 pb-28 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <div className="flex min-w-0 flex-col gap-6">
              <FormSectionSkeleton rows={['grid2', 'field']} />
              <FormSectionSkeleton rows={['field', 'area']} />
            </div>
            <div className="hidden min-w-0 xl:block">
              <Skeleton className="h-[28rem] w-full rounded-xl border border-border/70" />
            </div>
          </div>
        </div>
      </div>
    </SkeletonRegion>
  );
}

/** components/admin/navigation-editor.tsx */
export function NavigationEditorSkeleton() {
  return (
    <SkeletonRegion>
      <div className="w-full">
        <CommandBarSkeleton crumbs={['w-24']} live={false} />
        <div className="space-y-6 pt-6">
          <div className="mx-auto w-full max-w-6xl">
            <PageHeaderSkeleton titleWidth="w-40 sm:w-52" badge="h-4 w-20" />
          </div>
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-start gap-6 pb-28 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <FormSectionSkeleton actions="w-28">
              <div className="space-y-2">
                <Repeat count={5}>
                  {(i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-xl border border-border/70 bg-card px-3 py-3"
                      style={{ marginInlineStart: i === 2 || i === 3 ? 24 : 0 }}
                    >
                      <Skeleton className="size-4 shrink-0 rounded" shimmer={false} />
                      <Skeleton className={cn('h-3', ['w-24', 'w-32', 'w-20', 'w-28', 'w-24'][i])} />
                      <Skeleton className="hidden h-2.5 w-28 sm:block" />
                      <Skeleton className="ms-auto size-8 rounded-lg" />
                    </div>
                  )}
                </Repeat>
              </div>
            </FormSectionSkeleton>
            {/* Live preview: titled header with the desktop/mobile toggle, then the rendered menu. */}
            <section className="min-w-0 overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs">
              <div className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1 space-y-2 py-1">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-2.5 w-44" />
                  <Skeleton className="h-2.5 w-32" />
                </div>
                <Skeleton className="h-8 w-[86px] shrink-0 rounded-full" />
              </div>
              <div className="p-5">
                <div className="h-[193px] space-y-2 rounded-lg border border-border/60 p-3">
                  <div className="flex flex-wrap gap-2">
                    {['w-16', 'w-14', 'w-12', 'w-12'].map((w, i) => (
                      <Skeleton key={i} className={cn('h-7 rounded-md', w)} />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['w-16', 'w-14', 'w-20'].map((w, i) => (
                      <Skeleton key={i} className={cn('h-7 rounded-md', w)} />
                    ))}
                  </div>
                  <Skeleton className="h-[92px] w-full rounded-lg" shimmer={false} />
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </SkeletonRegion>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Path → replica, for AdminGate
 * ═══════════════════════════════════════════════════════════════════════════ */

const EXACT: Record<string, () => ReactNode> = {
  '/admin': () => <DashboardSkeleton />,
  '/admin/products': () => <AdminProductsSkeleton />,
  '/admin/products/new': () => <CreateEntitySkeleton kind="product" />,
  '/admin/courses': () => <AdminCoursesSkeleton />,
  '/admin/courses/new': () => <CreateEntitySkeleton kind="course" />,
  '/admin/academies': () => <AdminAcademiesSkeleton />,
  '/admin/academies/new': () => <CreateEntitySkeleton kind="academy" />,
  '/admin/users': () => <AdminUsersSkeleton />,
  '/admin/staff': () => <AdminStaffSkeleton />,
  '/admin/staff/roles': () => <AdminRolesSkeleton />,
  '/admin/staff/audit': () => <AdminAuditSkeleton />,
  '/admin/certificates': () => <AdminCertificatesSkeleton />,
  '/admin/quotes': () => <AdminQuotesSkeleton />,
  '/admin/finance': () => <AdminFinanceSkeleton />,
  '/admin/analytics': () => <AdminAnalyticsSkeleton />,
  '/admin/alerts': () => <AdminAlertsSkeleton />,
  '/admin/partners': () => <AdminPartnersSkeleton />,
  '/admin/integrations': () => <AdminIntegrationsSkeleton />,
  '/admin/settings': () => <AdminSettingsSkeleton />,
  '/admin/settings/ai-assistant': () => <AiAssistantSettingsSkeleton />,
  '/admin/theme': () => <ThemeEditorSkeleton />,
  '/admin/email': () => <AdminEmailSkeleton />,
  '/admin/navigation': () => <NavigationEditorSkeleton />,
  '/admin/builder': () => <BuilderSkeleton />,
};

const PATTERNS: Array<[RegExp, () => ReactNode]> = [
  [/^\/admin\/products\/[^/]+\/edit$/, () => <ProductEditorSkeleton />],
  [/^\/admin\/courses\/[^/]+\/edit$/, () => <CourseStudioSkeleton />],
  [/^\/admin\/academies\/[^/]+\/edit$/, () => <AcademyEditorSkeleton />],
  [/^\/admin\/email\/templates\/[^/]+$/, () => <EmailTemplateEditorSkeleton />],
];

/** Fallback for an admin path with no replica of its own: bar, header, a table. */
export function AdminGenericSkeleton() {
  return (
    <ListPage bar={{}}>
      <PageHeaderSkeleton />
      <TableCardSkeleton columns={[{ cell: 'text2', size: 3 }, { cell: 'pill', size: 1, hideBelow: 'sm' }, { cell: 'actions', size: '5rem' }]} rows={6} />
    </ListPage>
  );
}

/**
 * The replica for an admin path, or `null` for a path with none.
 */
export function adminSkeletonFor(pathname: string): ReactNode | null {
  const path = pathname.replace(/\/+$/, '') || '/';
  const exact = EXACT[path];
  if (exact) return exact();
  for (const [pattern, render] of PATTERNS) if (pattern.test(path)) return render();
  return null;
}
