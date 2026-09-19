'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  UserX,
  UserCheck,
  KeyRound,
  MonitorSmartphone,
  ShieldX,
  Package,
  CreditCard,
  GraduationCap,
  Lock,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import { RightSheet, RightSheetHeader, GLASS_SUB } from '@/components/ui/right-sheet';
import { useAuthStore } from '@/stores/auth-store';
import { useCan, useCanAny } from '@/lib/use-permissions';
import {
  userInitials,
  type AdminUserRow,
  type UserPurchaseRow,
  type UserEnrollmentRow,
  type UserCertificateRow,
  type UserLearningProgress,
} from './users-shared';
interface SessionRow {
  id: string;
  lastActiveAt?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  createdAt?: string | null;
}
interface AuditRow {
  id: string;
  action: string;
  createdAt: string;
  details?: Record<string, unknown> | null;
}
type TabKey = 'overview' | 'purchases' | 'subscriptions' | 'learning' | 'security';
const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'overview', label: 'Overview', icon: Package },
  { key: 'purchases', label: 'Purchases', icon: CreditCard },
  { key: 'subscriptions', label: 'Subscriptions', icon: Package },
  { key: 'learning', label: 'Learning', icon: GraduationCap },
  { key: 'security', label: 'Security', icon: Lock },
];
function ActionButton({
  label,
  icon: Icon,
  variant = 'default',
  onConfirm,
}: {
  label: string;
  icon: typeof UserX;
  variant?: 'default' | 'danger' | 'success' | 'info';
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onBlur={() => setConfirm(false)}
      onClick={async () => {
        if (!confirm) {
          setConfirm(true);
          return;
        }
        setBusy(true);
        try {
          await onConfirm();
        } finally {
          setBusy(false);
          setConfirm(false);
        }
      }}
      className={cn(
        'flex w-full items-center gap-2 rounded-xl border px-3.5 py-2.5 font-sans text-sm font-medium transition-all duration-200',
        confirm
          ? variant === 'danger'
            ? 'border-red-500 bg-red-500 text-white'
            : 'border-accent bg-accent text-white'
          : variant === 'danger'
            ? 'border-red-200/70 text-red-600 hover:bg-red-50/70 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-950/30'
            : variant === 'success'
              ? 'border-emerald-200/70 text-emerald-600 hover:bg-emerald-50/70 dark:border-emerald-900/40 dark:text-emerald-400 dark:hover:bg-emerald-950/30'
              : variant === 'info'
                ? 'border-blue-200/70 text-blue-600 hover:bg-blue-50/70 dark:border-blue-900/40 dark:text-blue-400 dark:hover:bg-blue-950/30'
                : 'border-border text-foreground hover:bg-muted',
      )}
    >
      {' '}
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}{' '}
      {busy ? 'Working…' : confirm ? 'Confirm' : label}{' '}
    </button>
  );
}
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  );
}
export function LearnerDrawer({
  userId,
  onClose,
  onChanged,
}: {
  userId: string;
  onClose: () => void;
  onChanged: (message: string) => void;
}) {
  const [user, setUser] = useState<(AdminUserRow & { bio?: string | null }) | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [purchases, setPurchases] = useState<{ items: UserPurchaseRow[]; total: number } | null>(
    null,
  );
  const [enrollments, setEnrollments] = useState<{
    items: UserEnrollmentRow[];
    total: number;
  } | null>(null);
  const [certificates, setCertificates] = useState<{
    items: UserCertificateRow[];
    total: number;
  } | null>(null);
  const [learningProgress, setLearningProgress] = useState<UserLearningProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const me = useAuthStore((s) => s.user);
  const myId = me?.id ?? '';
  const canSuspend = useCanAny(['users:suspend', 'staff:suspend']);
  const canForcePw = useCan('users:force_password_reset');
  const canImpersonate = useCan('users:impersonate');
  const canRevoke = useCanAny(['users:manage', 'staff:impersonate']);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [uRes, sRes, aRes, pRes, eRes, cRes, lRes] = await Promise.all([
        fetch(`/api/proxy/admin/users/${userId}`, { credentials: 'include' }),
        fetch(`/api/proxy/admin/sessions?userId=${userId}`, { credentials: 'include' }),
        fetch(`/api/proxy/admin/audit-logs?userId=${userId}&limit=20`, { credentials: 'include' }),
        fetch(`/api/proxy/admin/users/${userId}/purchases?limit=20`, { credentials: 'include' }),
        fetch(`/api/proxy/admin/users/${userId}/enrollments?limit=20`, { credentials: 'include' }),
        fetch(`/api/proxy/admin/users/${userId}/certificates?limit=20`, { credentials: 'include' }),
        fetch(`/api/proxy/admin/users/${userId}/learning`, { credentials: 'include' }),
      ]);
      if (!uRes.ok) throw new Error(`Failed to load (${uRes.status})`);
      setUser(await uRes.json());
      if (sRes.ok) setSessions((await sRes.json())?.sessions ?? []);
      if (aRes.ok) {
        const l = await aRes.json();
        setAudit(Array.isArray(l) ? l : (l?.items ?? []));
      }
      if (pRes.ok) setPurchases(await pRes.json());
      if (eRes.ok) setEnrollments(await eRes.json());
      if (cRes.ok) setCertificates(await cRes.json());
      if (lRes.ok) setLearningProgress(await lRes.json());
    } catch (e: any) {
      setLoadError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [userId]);
  useEffect(() => {
    loadAll();
  }, [loadAll]);
  const mutate = async (path: string, init: RequestInit, okMessage: string) => {
    const res = await fetch(path, { credentials: 'include', ...init });
    if (!res.ok) {
      let msg = `Request failed (${res.status})`;
      try {
        msg = (await res.json())?.message ?? msg;
      } catch {}
      toast({ type: 'err', title: 'Action failed', description: msg });
      throw new Error(msg);
    }
    onChanged(okMessage);
  };
  const isSelf = myId !== '' && myId === userId;
  const fmt = (cents: number, cur = 'usd') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: cur.toUpperCase() }).format(
      cents / 100,
    );
  const renderTab = () => {
    if (!user) return null;
    if (activeTab === 'overview') {
      return (
        <>
          {' '}
          <section>
            {' '}
            <SectionLabel>Profile</SectionLabel>{' '}
            <dl
              className={cn(GLASS_SUB, 'divide-y divide-border px-4 py-1')}
            >
              {' '}
              {[
                ['Username', user.username || '—'],
                ['Role', user.role.replace('_', ' ')],
                ['Status', user.accountStatus.replace(/_/g, ' ')],
                [
                  'Joined',
                  new Date(user.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  }),
                ],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-2.5 font-sans text-sm">
                  {' '}
                  <dt className="text-muted-foreground">{k}</dt>{' '}
                  <dd
                    className={cn(
                      'font-medium text-foreground',
                      k === 'Status' &&
                        user!.accountStatus === 'suspended' &&
                        'text-red-600 dark:text-red-400',
                    )}
                  >
                    {v}
                  </dd>{' '}
                </div>
              ))}{' '}
            </dl>{' '}
          </section>{' '}
          <section>
            {' '}
            <SectionLabel>Actions</SectionLabel>{' '}
            <div className="space-y-2">
              {' '}
              {canSuspend &&
                (user.accountStatus === 'suspended' ? (
                  <ActionButton
                    label="Unsuspend learner"
                    icon={UserCheck}
                    variant="success"
                    onConfirm={() =>
                      mutate(
                        `/api/proxy/admin/users/${userId}/unsuspend`,
                        { method: 'POST' },
                        'Learner unsuspended',
                      )
                    }
                  />
                ) : (
                  <ActionButton
                    label="Suspend learner"
                    icon={UserX}
                    variant="danger"
                    onConfirm={() =>
                      mutate(
                        `/api/proxy/admin/users/${userId}/suspend`,
                        {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ reason: 'Suspended from admin panel' }),
                        },
                        'Learner suspended',
                      )
                    }
                  />
                ))}{' '}
              {canForcePw && (
                <ActionButton
                  label="Force password reset"
                  icon={KeyRound}
                  onConfirm={() =>
                    mutate(
                      `/api/proxy/admin/users/${userId}/force-password-reset`,
                      { method: 'POST' },
                      'Password reset forced',
                    )
                  }
                />
              )}{' '}
              {canImpersonate && !isSelf && (
                <ActionButton
                  label="Impersonate learner"
                  icon={MonitorSmartphone}
                  variant="info"
                  onConfirm={async () => {
                    const res = await fetch(`/api/proxy/admin/users/${userId}/impersonate`, {
                      method: 'POST',
                      credentials: 'include',
                    });
                    if (!res.ok) {
                      toast({ type: 'err', title: 'Impersonation failed' });
                      throw new Error('failed');
                    }
                    toast({ type: 'ok', title: 'Impersonating', description: 'Redirecting…' });
                    window.location.href = '/';
                  }}
                />
              )}{' '}
            </div>{' '}
          </section>{' '}
        </>
      );
    }
    if (activeTab === 'purchases') {
      return (
        <section>
          {' '}
          <SectionLabel>Purchase history</SectionLabel>{' '}
          {!purchases?.items.length ? (
            <p
              className={cn(
                GLASS_SUB,
                'px-4 py-8 text-center font-sans text-sm text-muted-foreground',
              )}
            >
              No purchases yet
            </p>
          ) : (
            <div
              className={cn(GLASS_SUB, 'divide-y divide-border px-4 py-1')}
            >
              {' '}
              {purchases.items.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 py-3 font-sans text-sm"
                >
                  {' '}
                  <div>
                    {' '}
                    <p className="font-medium text-foreground">{fmt(p.total, p.currency)}</p>{' '}
                    <p className="text-xs capitalize text-muted-foreground">
                      {p.status.replace(/_/g, ' ')}
                    </p>{' '}
                  </div>{' '}
                  <span className="text-xs text-muted-foreground">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </span>{' '}
                </div>
              ))}{' '}
            </div>
          )}{' '}
        </section>
      );
    }
    if (activeTab === 'subscriptions') {
      return (
        <section
          className={cn(
            GLASS_SUB,
            'flex flex-col items-center justify-center px-3 py-12 text-center',
          )}
        >
          {' '}
          <AlertCircle className="mb-3 h-8 w-8 text-muted-foreground/40" />{' '}
          <p className="font-sans text-sm font-medium text-foreground">Subscriptions coming soon</p>{' '}
          <p className="mt-1 font-sans text-xs text-muted-foreground">
            Subscription data will appear here
          </p>{' '}
        </section>
      );
    }
    if (activeTab === 'learning') {
      return (
        <>
          {' '}
          {learningProgress && (
            <section>
              {' '}
              <SectionLabel>Progress</SectionLabel>{' '}
              <div className="grid grid-cols-2 gap-3">
                {' '}
                {[
                  ['Enrollments', learningProgress.totalEnrollments],
                  ['Lessons done', learningProgress.completedLessons],
                  ['Watch time', `${Math.floor(learningProgress.totalWatchTimeSeconds / 60)}m`],
                  ['Certificates', learningProgress.certificatesEarned],
                ].map(([k, v]) => (
                  <div key={k} className={cn(GLASS_SUB, 'px-3 py-3 text-center')}>
                    {' '}
                    <p className="font-sans text-xl font-semibold tabular-nums text-foreground">
                      {v}
                    </p>{' '}
                    <p className="mt-0.5 font-sans text-xs text-muted-foreground">{k}</p>{' '}
                  </div>
                ))}{' '}
              </div>{' '}
            </section>
          )}{' '}
          <section>
            {' '}
            <SectionLabel>Enrollments</SectionLabel>{' '}
            {!enrollments?.items.length ? (
              <p
                className={cn(
                  GLASS_SUB,
                  'px-4 py-8 text-center font-sans text-sm text-muted-foreground',
                )}
              >
                No enrollments yet
              </p>
            ) : (
              <div
                className={cn(
                  GLASS_SUB,
                  'divide-y divide-border px-4 py-1',
                )}
              >
                {' '}
                {enrollments.items.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between gap-3 py-3 font-sans text-sm"
                  >
                    {' '}
                    <div className="min-w-0">
                      {' '}
                      <p className="truncate font-medium text-foreground">{e.courseTitle}</p>{' '}
                      <p className="text-xs capitalize text-muted-foreground">
                        {e.status.replace(/_/g, ' ')}
                      </p>{' '}
                    </div>{' '}
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(e.startedAt).toLocaleDateString()}
                    </span>{' '}
                  </div>
                ))}{' '}
              </div>
            )}{' '}
          </section>{' '}
          <section>
            {' '}
            <SectionLabel>Certificates</SectionLabel>{' '}
            {!certificates?.items.length ? (
              <p
                className={cn(
                  GLASS_SUB,
                  'px-4 py-8 text-center font-sans text-sm text-muted-foreground',
                )}
              >
                No certificates earned yet
              </p>
            ) : (
              <div
                className={cn(
                  GLASS_SUB,
                  'divide-y divide-border px-4 py-1',
                )}
              >
                {' '}
                {certificates.items.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-3 py-3 font-sans text-sm"
                  >
                    {' '}
                    <div className="min-w-0">
                      {' '}
                      <p className="truncate font-medium text-foreground">{c.courseTitle}</p>{' '}
                      <p className="text-xs text-muted-foreground">#{c.certificateNumber}</p>{' '}
                    </div>{' '}
                    <div className="shrink-0 text-right">
                      {' '}
                      <span className="text-xs text-muted-foreground">
                        {new Date(c.issuedAt).toLocaleDateString()}
                      </span>{' '}
                      {c.pdfUrl && (
                        <a
                          href={c.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 text-xs font-medium text-foreground underline"
                        >
                          PDF
                        </a>
                      )}{' '}
                    </div>{' '}
                  </div>
                ))}{' '}
              </div>
            )}{' '}
          </section>{' '}
        </>
      );
    }
    if (activeTab === 'security') {
      return (
        <>
          {' '}
          <section>
            {' '}
            <SectionLabel>Active sessions ({sessions.length})</SectionLabel>{' '}
            {sessions.length === 0 ? (
              <p
                className={cn(
                  GLASS_SUB,
                  'px-4 py-6 text-center font-sans text-sm text-muted-foreground',
                )}
              >
                No active sessions
              </p>
            ) : (
              <ul className="space-y-2">
                {' '}
                {sessions.map((s) => (
                  <li
                    key={s.id}
                    className={cn(GLASS_SUB, 'flex items-center justify-between gap-2 px-4 py-3')}
                  >
                    {' '}
                    <div className="min-w-0 font-sans text-xs">
                      {' '}
                      <p className="truncate font-medium text-foreground">
                        {s.userAgent?.split(')')[0]?.replace(/^Mozilla\/5\.0 \(/, '') ||
                          'Unknown device'}
                      </p>{' '}
                      <p className="truncate text-muted-foreground">
                        {s.ipAddress}
                        {s.lastActiveAt ? ` · ${new Date(s.lastActiveAt).toLocaleString()}` : ''}
                      </p>{' '}
                    </div>{' '}
                    {canRevoke && (
                      <button
                        type="button"
                        title="Revoke session"
                        onClick={() =>
                          mutate(
                            `/api/proxy/admin/sessions/${s.id}/revoke`,
                            {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ userId }),
                            },
                            'Session revoked',
                          )
                        }
                        className="shrink-0 rounded-md p-1.5 text-muted-foreground transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                      >
                        {' '}
                        <ShieldX className="h-4 w-4" />{' '}
                      </button>
                    )}{' '}
                  </li>
                ))}{' '}
              </ul>
            )}{' '}
          </section>{' '}
          <section>
            {' '}
            <SectionLabel>Recent activity</SectionLabel>{' '}
            {audit.length === 0 ? (
              <p
                className={cn(
                  GLASS_SUB,
                  'px-4 py-6 text-center font-sans text-sm text-muted-foreground',
                )}
              >
                No activity recorded
              </p>
            ) : (
              <ul
                className={cn(
                  GLASS_SUB,
                  'divide-y divide-border px-2 py-1',
                )}
              >
                {' '}
                {audit.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-2 px-2 py-2 font-sans text-xs"
                  >
                    {' '}
                    <span className="truncate font-mono text-muted-foreground">
                      {a.action}
                    </span>{' '}
                    <span className="shrink-0 text-muted-foreground/70">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </span>{' '}
                  </li>
                ))}{' '}
              </ul>
            )}{' '}
          </section>{' '}
        </>
      );
    }
    return null;
  };
  return (
    <RightSheet
      onClose={onClose}
      width="max-w-[520px]"
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={(k) => setActiveTab(k as typeof activeTab)}
      header={
        <RightSheetHeader
          loading={loading}
          initials={user ? userInitials(user.name, user.email) : ''}
          gradient="bg-foreground text-background"
          title={user ? user.name || user.email.split('@')[0] || user.email : 'Learner'}
          subtitle={user ? user.email : ''}
          onClose={onClose}
        />
      }
    >
      {' '}
      <div className="flex-1 space-y-7 overflow-y-auto px-6 py-6">
        {' '}
        {loadError && (
          <div className="rounded-xl border border-red-200/60 bg-red-50/60 px-4 py-3 font-sans text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
            {' '}
            <p className="flex-1">{loadError}</p>{' '}
            <button onClick={loadAll} className="mt-1 font-medium underline">
              Retry
            </button>{' '}
          </div>
        )}{' '}
        {renderTab()}{' '}
      </div>{' '}
    </RightSheet>
  );
}
