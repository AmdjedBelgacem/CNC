'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  UserX,
  UserCheck,
  KeyRound,
  MonitorSmartphone,
  ShieldX,
  CreditCard,
  GraduationCap,
  Lock,
  Award,
  Users,
  Activity,
  Trash2,
  RefreshCw,
  FileText,
  BookOpen,
  Clock,
  Mail,
  CalendarDays,
  Fingerprint,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { Modal, GLASS_SUB } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useAuthStore } from '@/stores/auth-store';
import { useCan, useCanAny, useIsSuper } from '@/lib/use-permissions';
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
interface RoleSummary {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissionCount?: number;
  userCount?: number;
}

type TabKey = 'overview' | 'roles' | 'purchases' | 'learning' | 'security';

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'overview', label: 'Overview', icon: Users },
  { key: 'roles', label: 'Roles', icon: ShieldX },
  { key: 'purchases', label: 'Purchases', icon: CreditCard },
  { key: 'learning', label: 'Learning', icon: GraduationCap },
  { key: 'security', label: 'Security', icon: Lock },
];

const STATUS_META: Record<string, { label: string; variant: 'success' | 'destructive' | 'warning' | 'soft-muted' }> = {
  active: { label: 'Active', variant: 'success' },
  suspended: { label: 'Suspended', variant: 'destructive' },
  pending_verification: { label: 'Pending', variant: 'warning' },
  deleted: { label: 'Deleted', variant: 'soft-muted' },
};

const roleLabel: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  instructor: 'Instructor',
  moderator: 'Moderator',
  sponsor: 'Sponsor',
  learner: 'Learner',
};

const roleBadge: Record<string, 'default' | 'info' | 'success' | 'warning' | 'accent' | 'secondary'> = {
  super_admin: 'default',
  admin: 'default',
  instructor: 'success',
  moderator: 'info',
  sponsor: 'warning',
  learner: 'secondary',
};

function SectionLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {children}
      </h3>
      {hint && <span className="font-sans text-2xs text-muted-foreground/70">{hint}</span>}
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone = 'default',
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}) {
  return (
    <div className={cn(GLASS_SUB, 'flex items-start gap-3 px-3.5 py-3')}>
      <span
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-lg',
          tone === 'success' && 'bg-success/10 text-success',
          tone === 'warning' && 'bg-warning/15 text-warning',
          tone === 'danger' && 'bg-destructive/10 text-destructive',
          tone === 'info' && 'bg-info/10 text-info',
          tone === 'default' && 'bg-muted text-muted-foreground',
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="font-sans text-lg font-semibold tabular-nums leading-tight text-foreground">
          {value}
        </p>
        <p className="truncate font-sans text-2xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function ActionButton({
  label,
  icon: Icon,
  variant = 'default',
  onConfirm,
}: {
  label: string;
  icon: React.ElementType;
  variant?: 'default' | 'danger' | 'success' | 'info';
  onConfirm: () => Promise<void>;
}) {
  const tAdmin = useTranslations('admin');
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
        'flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-2.5 font-sans text-sm font-medium transition-all duration-200',
        confirm
          ? variant === 'danger'
            ? 'border-red-500 bg-destructive text-destructive-foreground'
            : 'border-accent bg-accent text-accent-foreground'
          : variant === 'danger'
            ? 'border-destructive/70 text-destructive hover:bg-destructive/70 dark:border-red-900/40 dark:text-destructive dark:hover:bg-red-950/30'
            : variant === 'success'
              ? 'border-success/70 text-success hover:bg-success/70 dark:border-success/40 dark:text-success dark:hover:bg-success/30'
              : variant === 'info'
                ? 'border-primary/40 text-primary hover:bg-primary/10'
                : 'border-border text-foreground hover:bg-muted',
      )}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
      {busy
        ? tAdmin('drawer.working', { default: 'Working…' })
        : confirm
          ? tAdmin('drawer.confirm', { default: 'Confirm' })
          : label}
    </button>
  );
}

function MetaRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5 font-sans text-sm">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="ms-auto truncate font-medium text-foreground">{value}</dd>
    </div>
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
  const [purchases, setPurchases] = useState<{ items: UserPurchaseRow[]; total: number } | null>(null);
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
  const [allRoles, setAllRoles] = useState<RoleSummary[]>([]);
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [savingRoles, setSavingRoles] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  const me = useAuthStore((s) => s.user);
  const tAdmin = useTranslations('admin');
  const tCommon = useTranslations('common');
  const myId = me?.id ?? '';
  const canSuspend = useCanAny(['users:suspend', 'staff:suspend']);
  const canForcePw = useCan('users:force_password_reset');
  const canImpersonate = useCan('users:impersonate');
  const canRevoke = useCanAny(['users:manage', 'staff:impersonate']);
  const canAssignRoles = useCan('staff:assign_roles');
  const canDelete = useIsSuper();
  const isSuper = useIsSuper();

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
      if (!uRes.ok) {
        throw new Error(
          tAdmin('drawer.failedToLoadStatus', {
            status: uRes.status,
            default: 'Failed to load ({status})',
          }),
        );
      }
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
    } catch (e) {
      setLoadError(
        e instanceof Error
          ? e.message
          : tAdmin('drawer.failedToLoad', { default: 'Failed to load' }),
      );
    } finally {
      setLoading(false);
    }
  }, [userId, tAdmin]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!canAssignRoles) return;
    let cancelled = false;
    (async () => {
      setRolesLoading(true);
      try {
        const [rolesRes, assignedRes] = await Promise.all([
          fetch('/api/proxy/admin/roles', { credentials: 'include' }),
          fetch(`/api/proxy/admin/users/${userId}/roles`, { credentials: 'include' }),
        ]);
        if (!cancelled && rolesRes.ok) setAllRoles(await rolesRes.json());
        if (!cancelled && assignedRes.ok) {
          const assigned = await assignedRes.json();
          setAssignedIds(Array.isArray(assigned) ? assigned.map((r: RoleSummary) => r.id) : []);
        }
      } catch {
      } finally {
        if (!cancelled) setRolesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canAssignRoles, userId]);

  const mutate = async (path: string, init: RequestInit, okMessage: string) => {
    const res = await fetch(path, { credentials: 'include', ...init });
    if (!res.ok) {
      let msg = tAdmin('drawer.requestFailed', {
        status: res.status,
        default: 'Request failed ({status})',
      });
      try {
        msg = (await res.json())?.message ?? msg;
      } catch {}
      toast({
        type: 'err',
        title: tAdmin('drawer.actionFailed', { default: 'Action failed' }),
        description: msg,
      });
      throw new Error(msg);
    }
    onChanged(okMessage);
  };

  const suspendReason = tAdmin('learnerDrawer.suspendReason', {
    default: 'Suspended from admin panel',
  });

  const isSelf = myId !== '' && myId === userId;
  const targetIsSuper = user?.role === 'super_admin';
  const editableRoles = !targetIsSuper || isSuper;
  const assignableRoles = useMemo(
    () => allRoles.filter((r) => r.key !== 'super_admin'),
    [allRoles],
  );

  const fmt = (cents: number, cur = 'usd') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: cur.toUpperCase() }).format(
      cents / 100,
    );

  const statusMeta = user ? (STATUS_META[user.accountStatus] ?? STATUS_META.active!) : null;
  const joined = user
    ? new Date(user.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '—';
  const enrolledCount = enrollments?.total ?? learningProgress?.totalEnrollments ?? 0;
  const completedCount =
    enrollments?.items?.filter((e) => e.status === 'completed').length ?? 0;
  const spendCents = purchases?.items?.reduce((sum, p) => sum + (p.total || 0), 0) ?? 0;
  const completionPct =
    enrolledCount > 0 ? Math.round((completedCount / enrolledCount) * 100) : 0;

  const saveRoles = async () => {
    if (!editableRoles) return;
    setSavingRoles(true);
    try {
      await mutate(
        `/api/proxy/admin/users/${userId}/roles`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roleIds: assignedIds }),
        },
        tAdmin('drawer.rolesUpdated', { default: 'Roles updated' }),
      );
    } finally {
      setSavingRoles(false);
    }
  };

  const toggleSuspend = async (suspend: boolean) => {
    if (!canSuspend) return;
    setTogglingStatus(true);
    try {
      await mutate(
        suspend
          ? `/api/proxy/admin/users/${userId}/suspend`
          : `/api/proxy/admin/users/${userId}/unsuspend`,
        suspend
          ? {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reason: suspendReason }),
            }
          : { method: 'POST' },
        suspend
          ? tAdmin('learnerDrawer.learnerSuspended', { default: 'Learner suspended' })
          : tAdmin('learnerDrawer.learnerUnsuspended', { default: 'Learner unsuspended' }),
      );
      await loadAll();
    } finally {
      setTogglingStatus(false);
    }
  };

  const renderTab = () => {
    if (!user) return null;

    if (activeTab === 'overview') {
      return (
        <div className="space-y-7">
          <section>
            <SectionLabel hint={user.id.slice(0, 8)}>
              {tAdmin('drawer.account', { default: 'Account' })}
            </SectionLabel>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile
                icon={GraduationCap}
                label={tAdmin('enrollments')}
                value={enrolledCount}
                tone="info"
              />
              <StatTile
                icon={Award}
                label={tAdmin('certificates')}
                value={certificates?.total ?? 0}
                tone="success"
              />
              <StatTile
                icon={CreditCard}
                label={tAdmin('learnerDrawer.orders', { default: 'Orders' })}
                value={purchases?.total ?? 0}
              />
              <StatTile
                icon={Clock}
                label={tAdmin('learnerDrawer.watchTime', { default: 'Watch time' })}
                value={`${Math.floor((learningProgress?.totalWatchTimeSeconds ?? 0) / 60)}m`}
              />
            </div>
          </section>

          <section>
            <SectionLabel>{tAdmin('drawer.profile', { default: 'Profile' })}</SectionLabel>
            <dl className={cn(GLASS_SUB, 'divide-y divide-border px-4 py-1')}>
              <MetaRow icon={Mail} label={tAdmin('drawer.email', { default: 'Email' })} value={user.email} />
              <MetaRow icon={Fingerprint} label={tAdmin('drawer.username', { default: 'Username' })} value={user.username || '—'} />
              <MetaRow
                icon={Users}
                label={tAdmin('drawer.role', { default: 'Role' })}
                value={tAdmin(`role.${user.role}`, {
                  default: roleLabel[user.role] ?? user.role.replace('_', ' '),
                })}
              />
              <MetaRow icon={CalendarDays} label={tAdmin('drawer.joined', { default: 'Joined' })} value={joined} />
              <MetaRow icon={Activity} label={tAdmin('drawer.userId', { default: 'User ID' })} value={user.id} />
            </dl>
            {user.bio && (
              <p className={cn(GLASS_SUB, 'mt-3 px-4 py-3 font-sans text-sm leading-relaxed text-muted-foreground')}>
                {user.bio}
              </p>
            )}
          </section>

          <section>
            <SectionLabel
              hint={
                canSuspend
                  ? undefined
                  : tAdmin('drawer.noPermission', { default: 'No permission' })
              }
            >
              {tAdmin('drawer.statusControls', { default: 'Status & controls' })}
            </SectionLabel>
            <div className={cn(GLASS_SUB, 'space-y-4 px-4 py-4')}>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-sans text-sm font-medium text-foreground">
                    {tAdmin('drawer.accountActive', { default: 'Account active' })}
                  </p>
                  <p className="mt-0.5 font-sans text-xs text-muted-foreground">
                    {user.accountStatus === 'suspended'
                      ? tAdmin('learnerDrawer.suspendedCannotSignIn', {
                          default: 'This account is suspended and cannot sign in.',
                        })
                      : tAdmin('learnerDrawer.canAccessCourses', {
                          default: 'Learner can sign in and access courses.',
                        })}
                  </p>
                </div>
                <Switch
                  checked={user.accountStatus !== 'suspended' && user.accountStatus !== 'deleted'}
                  disabled={!canSuspend || togglingStatus || isSelf || user.accountStatus === 'deleted'}
                  onCheckedChange={(next) => toggleSuspend(!next)}
                  aria-label={tAdmin('drawer.toggleSuspension', {
                    default: 'Toggle account suspension',
                  })}
                />
              </div>
              <Separator />
              <div className="space-y-2">
                {canForcePw && (
                  <ActionButton
                    label={tAdmin('drawer.forcePasswordReset', { default: 'Force password reset' })}
                    icon={KeyRound}
                    onConfirm={() =>
                      mutate(
                        `/api/proxy/admin/users/${userId}/force-password-reset`,
                        { method: 'POST' },
                        tAdmin('drawer.passwordResetForced', { default: 'Password reset forced' }),
                      )
                    }
                  />
                )}
                {canImpersonate && !isSelf && (
                  <ActionButton
                    label={tAdmin('learnerDrawer.impersonateLearner', { default: 'Impersonate learner' })}
                    icon={MonitorSmartphone}
                    variant="info"
                    onConfirm={async () => {
                      const res = await fetch(`/api/proxy/admin/users/${userId}/impersonate`, {
                        method: 'POST',
                        credentials: 'include',
                      });
                      if (!res.ok) {
                        toast({
                          type: 'err',
                          title: tAdmin('drawer.impersonationFailed', {
                            default: 'Impersonation failed',
                          }),
                        });
                        throw new Error('failed');
                      }
                      toast({
                        type: 'ok',
                        title: tAdmin('drawer.impersonating', { default: 'Impersonating' }),
                        description: tAdmin('drawer.redirecting', { default: 'Redirecting…' }),
                      });
                      window.location.href = '/';
                    }}
                  />
                )}
                {canSuspend && user.accountStatus === 'suspended' && (
                  <ActionButton
                    label={tAdmin('learnerDrawer.unsuspendLearner', { default: 'Unsuspend learner' })}
                    icon={UserCheck}
                    variant="success"
                    onConfirm={() =>
                      mutate(
                        `/api/proxy/admin/users/${userId}/unsuspend`,
                        { method: 'POST' },
                        tAdmin('learnerDrawer.learnerUnsuspended', { default: 'Learner unsuspended' }),
                      )
                    }
                  />
                )}
                {canSuspend && user.accountStatus !== 'suspended' && user.accountStatus !== 'deleted' && (
                  <ActionButton
                    label={tAdmin('learnerDrawer.suspendLearner', { default: 'Suspend learner' })}
                    icon={UserX}
                    variant="danger"
                    onConfirm={() =>
                      mutate(
                        `/api/proxy/admin/users/${userId}/suspend`,
                        {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ reason: suspendReason }),
                        },
                        tAdmin('learnerDrawer.learnerSuspended', { default: 'Learner suspended' }),
                      )
                    }
                  />
                )}
                {canDelete && !isSelf && (
                  <ActionButton
                    label={tAdmin('learnerDrawer.deleteLearner', { default: 'Delete learner' })}
                    icon={Trash2}
                    variant="danger"
                    onConfirm={async () => {
                      await mutate(
                        `/api/proxy/admin/users/${userId}`,
                        { method: 'DELETE' },
                        tAdmin('learnerDrawer.learnerDeleted', { default: 'Learner deleted' }),
                      );
                      onClose();
                    }}
                  />
                )}
              </div>
            </div>
          </section>
        </div>
      );
    }

    if (activeTab === 'roles') {
      if (!canAssignRoles) {
        return (
          <EmptyState
            icon={ShieldX}
            title={tAdmin('drawer.noAccessToRoles', { default: 'No access to roles' })}
            description={tAdmin('learnerDrawer.needAssignRoles', {
              default: 'You need the staff:assign_roles permission to view or change roles.',
            })}
            compact
          />
        );
      }
      return (
        <div className="space-y-7">
          <section>
            <SectionLabel
              hint={tAdmin('drawer.assignedCount', {
                count: assignedIds.length,
                default: '{count} assigned',
              })}
            >
              {tAdmin('drawer.assignedRoles', { default: 'Assigned roles' })}
            </SectionLabel>
            <div className={cn(GLASS_SUB, 'space-y-1.5 p-3')}>
              {rolesLoading ? (
                <LoadingState
                  label={tAdmin('drawer.loadingRoles', { default: 'Loading roles…' })}
                  rows={4}
                />
              ) : assignableRoles.length === 0 ? (
                <EmptyState
                  icon={ShieldX}
                  title={tAdmin('drawer.noRolesAvailable', { default: 'No roles available' })}
                  compact
                />
              ) : (
                assignableRoles.map((r) => {
                  const checked = assignedIds.includes(r.id);
                  return (
                    <label
                      key={r.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2.5 transition',
                        editableRoles ? 'hover:bg-muted' : 'cursor-default',
                        r.isSystem && 'opacity-90',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!editableRoles}
                        onChange={(e) =>
                          setAssignedIds((prev) =>
                            e.target.checked
                              ? [...prev, r.id]
                              : prev.filter((id) => id !== r.id),
                          )
                        }
                        className="size-4 rounded border-border accent-primary"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-sans text-sm font-medium text-foreground">
                          {r.name}
                        </span>
                        <span className="block truncate font-sans text-xs text-muted-foreground">
                          {r.isSystem
                            ? tAdmin('drawer.systemRolePrefix', { default: 'System role · ' })
                            : ''}
                          {tAdmin('drawer.permissionsCount', {
                            count: r.permissionCount ?? 0,
                            default: '{count, plural, one {# permission} other {# permissions}}',
                          })}
                          {r.description ? ` · ${r.description}` : ''}
                        </span>
                      </span>
                      {r.isSystem && (
                        <Badge variant="soft">{tAdmin('role.system', { default: 'System' })}</Badge>
                      )}
                    </label>
                  );
                })
              )}
              {editableRoles && (
                <Button
                  type="button"
                  className="mt-2 w-full"
                  disabled={savingRoles || rolesLoading}
                  loading={savingRoles}
                  onClick={saveRoles}
                >
                  {savingRoles ? tCommon('saving') : tAdmin('drawer.saveRoles', { default: 'Save roles' })}
                </Button>
              )}
              {!editableRoles && (
                <p className="px-1 pt-1 font-sans text-xs text-muted-foreground">
                  {tAdmin('drawer.superAdminRolesLocked', {
                    default: 'A super admin’s roles can only be changed by another super admin.',
                  })}
                </p>
              )}
            </div>
          </section>
          <section>
            <SectionLabel>{tAdmin('drawer.primaryRole', { default: 'Primary role' })}</SectionLabel>
            <div className={cn(GLASS_SUB, 'flex items-center justify-between gap-3 px-4 py-3.5')}>
              <div>
                <p className="font-sans text-sm font-medium text-foreground">
                  {tAdmin(`role.${user.role}`, { default: roleLabel[user.role] ?? user.role })}
                </p>
                <p className="font-sans text-xs text-muted-foreground">
                  {tAdmin('drawer.legacyRoleNote', {
                    default: 'Legacy account role used for tenant scoping',
                  })}
                </p>
              </div>
              <Badge variant={roleBadge[user.role] ?? 'secondary'}>{user.role}</Badge>
            </div>
          </section>
        </div>
      );
    }

    if (activeTab === 'purchases') {
      if (!purchases?.items.length) {
        return (
          <EmptyState
            icon={CreditCard}
            title={tAdmin('learnerDrawer.noPurchasesYet', { default: 'No purchases yet' })}
            description={tAdmin('learnerDrawer.noPurchasesHint', {
              default: 'Orders and payment history will appear here.',
            })}
            compact
          />
        );
      }
      return (
        <div className="space-y-7">
          <section>
            <SectionLabel
              hint={tAdmin('learnerDrawer.totalCount', {
                count: purchases.total,
                default: '{count} total',
              })}
            >
              {tAdmin('learnerDrawer.spend', { default: 'Spend' })}
            </SectionLabel>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatTile
                icon={CreditCard}
                label={tAdmin('learnerDrawer.totalSpent', { default: 'Total spent' })}
                value={fmt(spendCents)}
                tone="success"
              />
              <StatTile
                icon={FileText}
                label={tAdmin('learnerDrawer.orders', { default: 'Orders' })}
                value={purchases.total}
              />
              <StatTile
                icon={Activity}
                label={tAdmin('status.completed', { default: 'Completed' })}
                value={purchases.items.filter((p) => p.status === 'completed' || p.status === 'paid').length}
                tone="info"
              />
            </div>
          </section>
          <section>
            <SectionLabel>{tAdmin('learnerDrawer.orderHistory', { default: 'Order history' })}</SectionLabel>
            <div className={cn(GLASS_SUB, 'divide-y divide-border px-4 py-1')}>
              {purchases.items.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 py-3 font-sans text-sm">
                  <div className="min-w-0">
                    <p className="font-medium tabular-nums text-foreground">{fmt(p.total, p.currency)}</p>
                    <p className="truncate text-xs capitalize text-muted-foreground">
                      {p.status.replace(/_/g, ' ')}
                      {p.stripePaymentIntentId ? ` · ${p.stripePaymentIntentId.slice(0, 12)}…` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      );
    }

    if (activeTab === 'learning') {
      return (
        <div className="space-y-7">
          {learningProgress && (
            <section>
              <SectionLabel>
                {tAdmin('learnerDrawer.progressOverview', { default: 'Progress overview' })}
              </SectionLabel>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile icon={BookOpen} label={tAdmin('enrollments')} value={learningProgress.totalEnrollments} tone="info" />
                <StatTile icon={GraduationCap} label={tAdmin('learnerDrawer.lessonsDone', { default: 'Lessons done' })} value={learningProgress.completedLessons} tone="success" />
                <StatTile icon={Clock} label={tAdmin('learnerDrawer.watchTime', { default: 'Watch time' })} value={`${Math.floor(learningProgress.totalWatchTimeSeconds / 60)}m`} />
                <StatTile icon={Award} label={tAdmin('certificates')} value={learningProgress.certificatesEarned} tone="warning" />
              </div>
              <div className={cn(GLASS_SUB, 'mt-3 px-4 py-3.5')}>
                <div className="mb-2 flex items-center justify-between font-sans text-xs">
                  <span className="text-muted-foreground">
                    {tAdmin('learnerDrawer.courseCompletion', { default: 'Course completion' })}
                  </span>
                  <span className="font-semibold tabular-nums text-foreground">{completionPct}%</span>
                </div>
                <Progress
                  value={completionPct}
                  label={tAdmin('learnerDrawer.courseCompletion', { default: 'Course completion' })}
                />
              </div>
            </section>
          )}

          <section>
            <SectionLabel hint={enrollments ? `${enrollments.total}` : undefined}>
              {tAdmin('enrollments')}
            </SectionLabel>
            {!enrollments?.items.length ? (
              <EmptyState
                icon={BookOpen}
                title={tAdmin('learnerDrawer.noEnrollmentsYet', { default: 'No enrollments yet' })}
                compact
              />
            ) : (
              <div className={cn(GLASS_SUB, 'divide-y divide-border px-4 py-1')}>
                {enrollments.items.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-3 py-3 font-sans text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{e.courseTitle}</p>
                      <p className="text-xs capitalize text-muted-foreground">
                        {e.status.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge
                        variant={
                          e.status === 'completed'
                            ? 'success'
                            : e.status === 'active' || e.status === 'in_progress'
                              ? 'info'
                              : 'soft-muted'
                        }
                      >
                        {e.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(e.startedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionLabel hint={certificates ? `${certificates.total}` : undefined}>
              {tAdmin('certificates')}
            </SectionLabel>
            {!certificates?.items.length ? (
              <EmptyState
                icon={Award}
                title={tAdmin('learnerDrawer.noCertificatesYet', {
                  default: 'No certificates earned yet',
                })}
                compact
              />
            ) : (
              <div className={cn(GLASS_SUB, 'divide-y divide-border px-4 py-1')}>
                {certificates.items.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 py-3 font-sans text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{c.courseTitle}</p>
                      <p className="text-xs text-muted-foreground">#{c.certificateNumber}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {c.revokedAt ? (
                        <Badge variant="destructive">
                          {tAdmin('status.revoked', { default: 'Revoked' })}
                        </Badge>
                      ) : (
                        <Badge variant="success">
                          {tAdmin('status.issued', { default: 'Issued' })}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(c.issuedAt).toLocaleDateString()}
                      </span>
                      {c.pdfUrl && (
                        <a
                          href={c.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-foreground underline"
                        >
                          PDF
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      );
    }

    if (activeTab === 'security') {
      return (
        <div className="space-y-7">
          <section>
            <SectionLabel>{tAdmin('drawer.activeSessions', { default: 'Active sessions' })}</SectionLabel>
            {sessions.length === 0 ? (
              <EmptyState
                icon={Lock}
                title={tAdmin('drawer.noActiveSessions', { default: 'No active sessions' })}
                compact
              />
            ) : (
              <ul className="space-y-2">
                {sessions.map((s) => (
                  <li key={s.id} className={cn(GLASS_SUB, 'flex items-center justify-between gap-2 px-4 py-3')}>
                    <div className="min-w-0 font-sans text-xs">
                      <p className="truncate font-medium text-foreground">
                        {s.userAgent?.split(')')[0]?.replace(/^Mozilla\/5\.0 \(/, '') ||
                          tAdmin('drawer.unknownDevice', { default: 'Unknown device' })}
                      </p>
                      <p className="truncate text-muted-foreground">
                        {s.ipAddress}
                        {s.lastActiveAt ? ` · ${new Date(s.lastActiveAt).toLocaleString()}` : ''}
                      </p>
                    </div>
                    {canRevoke && (
                      <button
                        type="button"
                        title={tAdmin('drawer.revokeSession', { default: 'Revoke session' })}
                        onClick={() =>
                          mutate(
                            `/api/proxy/admin/sessions/${s.id}/revoke`,
                            {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ userId }),
                            },
                            tAdmin('drawer.sessionRevoked', { default: 'Session revoked' }),
                          ).then(() => loadAll())
                        }
                        className="shrink-0 rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive dark:hover:bg-red-950/30 dark:hover:text-destructive"
                      >
                        <ShieldX className="size-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <SectionLabel hint={`${audit.length}`}>
              {tAdmin('learnerDrawer.recentActivity', { default: 'Recent activity' })}
            </SectionLabel>
            {audit.length === 0 ? (
              <EmptyState
                icon={Activity}
                title={tAdmin('drawer.noActivityRecorded', { default: 'No activity recorded' })}
                compact
              />
            ) : (
              <ul className={cn(GLASS_SUB, 'divide-y divide-border px-2 py-1')}>
                {audit.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 px-2 py-2 font-sans text-xs">
                    <span className="truncate font-mono text-muted-foreground">{a.action}</span>
                    <span className="shrink-0 text-muted-foreground/70">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      );
    }
    return null;
  };

  return (
    <Modal
      onClose={onClose}
      width="max-w-3xl"
      tabs={TABS.map((tab) => ({
        ...tab,
        label: tAdmin(`tabs.${tab.key}`, { default: tab.label }),
      }))}
      activeTab={activeTab}
      onTabChange={(k) => setActiveTab(k as TabKey)}
      title={
        user?.name || user?.email || tAdmin('learnerDrawer.learnerDetails', { default: 'Learner details' })
      }
      header={
        <div className="border-b border-border bg-card px-6 py-5">
          {loading ? (
            <div className="flex items-center gap-4">
              <Skeleton className="h-14 w-14 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40 rounded" />
                <Skeleton className="h-3 w-56 rounded" />
              </div>
            </div>
          ) : user ? (
            <div className="flex items-start gap-4">
              <span
                className={cn(
                  'flex h-14 w-14 shrink-0 items-center justify-center rounded-xl font-sans text-xl font-semibold',
                  user.accountStatus === 'suspended'
                    ? 'bg-destructive text-destructive-foreground'
                    : 'bg-foreground text-background',
                )}
              >
                {userInitials(user.name, user.email)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-display text-[26px] font-semibold leading-tight text-foreground">
                    {user.name || user.email.split('@')[0] || user.email}
                  </p>
                  {statusMeta && (
                    <Badge variant={statusMeta.variant}>
                      {tAdmin(`status.${user.accountStatus}`, { default: statusMeta.label })}
                    </Badge>
                  )}
                  <Badge variant={roleBadge[user.role] ?? 'secondary'}>
                    {tAdmin(`role.${user.role}`, { default: roleLabel[user.role] ?? user.role })}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate font-sans text-sm text-muted-foreground">
                  {user.email}
                  {user.username ? ` · @${user.username}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  title={tCommon('refresh')}
                  aria-label={tCommon('refresh')}
                  onClick={() => loadAll()}
                >
                  <RefreshCw className="size-4" />
                </Button>
                <button
                  type="button"
                  aria-label={tAdmin('drawer.closePanel', { default: 'Close panel' })}
                  onClick={onClose}
                  className="rounded-xl p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground active:scale-95"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>
          ) : (
            <p className="font-sans text-sm text-muted-foreground">
              {tAdmin('learnerDrawer.learner', { default: 'Learner' })}
            </p>
          )}
        </div>
      }
    >
      <div className="flex-1 space-y-0 overflow-y-auto px-6 py-6">
        {loadError && (
          <ErrorState
            title={tAdmin('learnerDrawer.couldNotLoad', { default: 'Could not load learner' })}
            description={loadError}
            onRetry={loadAll}
            compact
            className="mb-4 rounded-xl border border-destructive/40 bg-destructive/5"
          />
        )}
        {loading && !user ? (
          <LoadingState
            label={tAdmin('learnerDrawer.loadingLearner', { default: 'Loading learner…' })}
            rows={4}
          />
        ) : (
          renderTab()
        )}
      </div>
    </Modal>
  );
}
