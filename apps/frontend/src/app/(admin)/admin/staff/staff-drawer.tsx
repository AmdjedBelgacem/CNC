'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  UserX,
  UserCheck,
  KeyRound,
  MonitorSmartphone,
  ShieldX,
  Users,
  Activity,
  Lock,
  Trash2,
  RefreshCw,
  Mail,
  CalendarDays,
  Fingerprint,
  X,
  ShieldCheck,
  Key,
  Clock,
  FileText,
  UserCog,
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
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useAuthStore } from '@/stores/auth-store';
import { useCan, useCanAny, useIsSuper } from '@/lib/use-permissions';
import { userInitials, type AdminUserRow } from '../users/users-shared';

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
interface RoleDetail extends RoleSummary {
  permissions?: string[];
}
interface PermissionDef {
  key: string;
  label: string;
  description?: string;
  resource: string;
}
interface PermissionGroup {
  group: string;
  label: string;
  permissions: PermissionDef[];
}

type TabKey = 'overview' | 'roles' | 'permissions' | 'security' | 'activity';

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'overview', label: 'Overview', icon: Users },
  { key: 'roles', label: 'Roles', icon: ShieldCheck },
  { key: 'permissions', label: 'Permissions', icon: Key },
  { key: 'security', label: 'Security', icon: Lock },
  { key: 'activity', label: 'Activity', icon: Activity },
];

const STATUS_META: Record<
  string,
  { label: string; variant: 'success' | 'destructive' | 'warning' | 'soft-muted' }
> = {
  active: { label: 'Active', variant: 'success' },
  suspended: { label: 'Suspended', variant: 'destructive' },
  pending_verification: { label: 'Pending', variant: 'warning' },
  pending: { label: 'Pending', variant: 'warning' },
  deleted: { label: 'Deleted', variant: 'soft-muted' },
};

const roleLabel: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  instructor: 'Instructor',
  moderator: 'Moderator',
  sponsor: 'Sponsor',
};

const roleBadge: Record<
  string,
  'default' | 'info' | 'success' | 'warning' | 'accent' | 'secondary'
> = {
  super_admin: 'default',
  admin: 'default',
  instructor: 'success',
  moderator: 'info',
  sponsor: 'warning',
};

const roleGrad: Record<string, string> = {
  super_admin: 'bg-primary text-primary-foreground',
  admin: 'bg-secondary text-secondary-foreground',
  instructor: 'bg-success text-success-foreground',
  moderator: 'bg-info text-info-foreground',
  sponsor: 'bg-warning text-warning-foreground',
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

function MetaRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 font-sans text-sm">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="ms-auto truncate font-medium text-foreground">{value}</dd>
    </div>
  );
}

function deviceLabel(ua: string | null | undefined, unknownDevice: string) {
  return ua?.split(')')[0]?.replace(/^Mozilla\/5\.0 \(/, '') || unknownDevice;
}

export function StaffDrawer({
  userId,
  onClose,
  onChanged,
}: {
  userId: string;
  onClose: () => void;
  onChanged: (message: string) => void;
}) {
  const me = useAuthStore((s) => s.user);
  const tAdmin = useTranslations('admin');
  const tCommon = useTranslations('common');
  const myId = me?.id ?? '';
  const canSuspend = useCanAny(['staff:suspend', 'users:suspend', 'staff:unsuspend', 'users:unsuspend']);
  const canForcePw = useCan('users:force_password_reset');
  const canImpersonate = useCanAny(['staff:impersonate', 'users:impersonate']);
  const canRevoke = useCanAny(['staff:impersonate', 'users:manage', 'staff:assign_roles']);
  const canAssignRoles = useCan('staff:assign_roles');
  const canManageRoles = useCan('staff:manage_roles');
  const canChangeRole = useIsSuper();
  const isSuper = useIsSuper();
  const canDelete = useIsSuper();

  const [user, setUser] = useState<(AdminUserRow & { bio?: string | null }) | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [allRoles, setAllRoles] = useState<RoleSummary[]>([]);
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [savingRoles, setSavingRoles] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [roleDetails, setRoleDetails] = useState<RoleDetail[]>([]);
  const [permCatalog, setPermCatalog] = useState<PermissionGroup[]>([]);
  const [permsLoading, setPermsLoading] = useState(false);
  const [pendingRole, setPendingRole] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [uRes, sRes, aRes] = await Promise.all([
        fetch(`/api/proxy/admin/users/${userId}`, { credentials: 'include' }),
        fetch(`/api/proxy/admin/sessions?userId=${userId}`, { credentials: 'include' }),
        fetch(`/api/proxy/admin/audit-logs?userId=${userId}&limit=20`, { credentials: 'include' }),
      ]);
      if (!uRes.ok) {
        throw new Error(
          tAdmin('drawer.failedToLoadStatus', {
            status: uRes.status,
            default: 'Failed to load ({status})',
          }),
        );
      }
      const profile = await uRes.json();
      setUser(profile);
      setPendingRole(profile?.role ?? '');
      if (sRes.ok) {
        const payload = await sRes.json();
        const list = Array.isArray(payload) ? payload : (payload?.sessions ?? []);
        setSessions(list);
      }
      if (aRes.ok) {
        const l = await aRes.json();
        setAudit(Array.isArray(l) ? l : (l?.items ?? []));
      }
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

  useEffect(() => {
    if (activeTab !== 'permissions' || !canManageRoles || assignedIds.length === 0) {
      setRoleDetails([]);
      if (activeTab === 'permissions' && assignedIds.length === 0) setPermCatalog([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setPermsLoading(true);
      try {
        const [catRes, ...detailRes] = await Promise.all([
          fetch('/api/proxy/admin/permissions', { credentials: 'include' }),
          ...assignedIds.map((id) =>
            fetch(`/api/proxy/admin/roles/${id}`, { credentials: 'include' }),
          ),
        ]);
        if (!cancelled && catRes.ok) setPermCatalog(await catRes.json());
        const details: RoleDetail[] = [];
        for (const res of detailRes) {
          if (res.ok) details.push(await res.json());
        }
        if (!cancelled) setRoleDetails(details);
      } catch {
      } finally {
        if (!cancelled) setPermsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, assignedIds, canManageRoles]);

  const mutate = async (path: string, init: RequestInit, okMessage: string) => {
    const res = await fetch(path, { credentials: 'include', ...init });
    if (!res.ok) {
      let msg = tAdmin('drawer.requestFailed', {
        status: res.status,
        default: 'Request failed ({status})',
      });
      try {
        msg = (await res.json())?.message ?? msg;
      } catch {
        /* keep default */
      }
      toast({
        type: 'err',
        title: tAdmin('drawer.actionFailed', { default: 'Action failed' }),
        description: msg,
      });
      throw new Error(msg);
    }
    onChanged(okMessage);
  };

  const suspendReason = tAdmin('drawer.suspendReason', {
    default: 'Suspended from staff admin',
  });

  const isSelf = myId !== '' && myId === userId;
  const targetIsSuper = user?.role === 'super_admin';
  const editableRoles = !targetIsSuper || isSuper;
  const assignableRoles = useMemo(
    () => allRoles.filter((r) => r.key !== 'super_admin'),
    [allRoles],
  );

  const statusMeta = user ? (STATUS_META[user.accountStatus] ?? STATUS_META.active!) : null;
  const joined = user
    ? new Date(user.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '—';
  const tenureDays = user
    ? Math.max(
        0,
        Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
      )
    : 0;
  const uniquePermKeys = useMemo(() => {
    const set = new Set<string>();
    for (const r of roleDetails) for (const p of r.permissions ?? []) set.add(p);
    return [...set].sort();
  }, [roleDetails]);

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
      if (activeTab === 'permissions') setActiveTab('permissions');
    } finally {
      setSavingRoles(false);
    }
  };

  const changePrimaryRole = async () => {
    if (!canChangeRole || !pendingRole || pendingRole === user?.role) return;
    setSavingRoles(true);
    try {
      await mutate(
        `/api/proxy/admin/users/${userId}/role`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: pendingRole }),
        },
        tAdmin('drawer.primaryRoleUpdated', { default: 'Primary role updated' }),
      );
      await loadAll();
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
          ? tAdmin('drawer.staffSuspended', { default: 'Staff suspended' })
          : tAdmin('drawer.staffUnsuspended', { default: 'Staff unsuspended' }),
      );
      await loadAll();
    } finally {
      setTogglingStatus(false);
    }
  };

  const labelForPerm = (key: string) => {
    for (const g of permCatalog) {
      const hit = g.permissions.find((p) => p.key === key);
      if (hit) return hit;
    }
    return null;
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
                icon={Lock}
                label={tAdmin('drawer.sessions', { default: 'Sessions' })}
                value={sessions.length}
                tone="info"
              />
              <StatTile
                icon={ShieldCheck}
                label={tAdmin('drawer.assignedRoles', { default: 'Assigned roles' })}
                value={canAssignRoles ? assignedIds.length : '—'}
                tone="success"
              />
              <StatTile
                icon={FileText}
                label={tAdmin('drawer.auditEvents', { default: 'Audit events' })}
                value={audit.length}
              />
              <StatTile
                icon={Clock}
                label={tAdmin('drawer.tenureDays', { default: 'Tenure (days)' })}
                value={tenureDays}
                tone="warning"
              />
            </div>
          </section>

          <section>
            <SectionLabel>{tAdmin('drawer.profile', { default: 'Profile' })}</SectionLabel>
            <dl className={cn(GLASS_SUB, 'divide-y divide-border px-4 py-1')}>
              <MetaRow
                icon={Mail}
                label={tAdmin('drawer.email', { default: 'Email' })}
                value={user.email}
              />
              <MetaRow
                icon={Fingerprint}
                label={tAdmin('drawer.username', { default: 'Username' })}
                value={user.username || '—'}
              />
              <MetaRow
                icon={Users}
                label={tAdmin('drawer.role', { default: 'Role' })}
                value={tAdmin(`role.${user.role}`, {
                  default: roleLabel[user.role] ?? user.role.replace('_', ' '),
                })}
              />
              <MetaRow
                icon={CalendarDays}
                label={tAdmin('drawer.joined', { default: 'Joined' })}
                value={joined}
              />
              <MetaRow
                icon={Activity}
                label={tAdmin('drawer.userId', { default: 'User ID' })}
                value={user.id}
              />
            </dl>
            {user.bio && (
              <p
                className={cn(
                  GLASS_SUB,
                  'mt-3 px-4 py-3 font-sans text-sm leading-relaxed text-muted-foreground',
                )}
              >
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
                      ? tAdmin('drawer.staffSuspendedHint', {
                          default: 'This staff account is suspended and cannot sign in.',
                        })
                      : tAdmin('drawer.staffCanSignIn', {
                          default: 'Staff member can sign in and access the admin panel.',
                        })}
                  </p>
                </div>
                <Switch
                  checked={
                    user.accountStatus !== 'suspended' && user.accountStatus !== 'deleted'
                  }
                  disabled={
                    !canSuspend || togglingStatus || isSelf || user.accountStatus === 'deleted'
                  }
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
                    label={tAdmin('drawer.forcePasswordReset', {
                      default: 'Force password reset',
                    })}
                    icon={KeyRound}
                    onConfirm={() =>
                      mutate(
                        `/api/proxy/admin/users/${userId}/force-password-reset`,
                        { method: 'POST' },
                        tAdmin('drawer.passwordResetForced', {
                          default: 'Password reset forced',
                        }),
                      ).then(() => loadAll())
                    }
                  />
                )}
                {canImpersonate && !isSelf && user.role !== 'super_admin' && (
                  <ActionButton
                    label={tAdmin('drawer.impersonateStaff', { default: 'Impersonate staff' })}
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
                    label={tAdmin('drawer.unsuspendStaff', { default: 'Unsuspend staff' })}
                    icon={UserCheck}
                    variant="success"
                    onConfirm={() =>
                      mutate(
                        `/api/proxy/admin/users/${userId}/unsuspend`,
                        { method: 'POST' },
                        tAdmin('drawer.staffUnsuspended', { default: 'Staff unsuspended' }),
                      ).then(() => loadAll())
                    }
                  />
                )}
                {canSuspend &&
                  user.accountStatus !== 'suspended' &&
                  user.accountStatus !== 'deleted' && (
                    <ActionButton
                      label={tAdmin('drawer.suspendStaff', { default: 'Suspend staff' })}
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
                          tAdmin('drawer.staffSuspended', { default: 'Staff suspended' }),
                        ).then(() => loadAll())
                      }
                    />
                  )}
                {canDelete && !isSelf && (
                  <ActionButton
                    label={tAdmin('drawer.deleteStaffMember', {
                      default: 'Delete staff member',
                    })}
                    icon={Trash2}
                    variant="danger"
                    onConfirm={async () => {
                      await mutate(
                        `/api/proxy/admin/users/${userId}`,
                        { method: 'DELETE' },
                        tAdmin('drawer.staffMemberDeleted', {
                          default: 'Staff member deleted',
                        }),
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
      if (!canAssignRoles && !canChangeRole) {
        return (
          <EmptyState
            icon={ShieldX}
            title={tAdmin('drawer.noAccessToRoles', { default: 'No access to roles' })}
            description={tAdmin('drawer.needAssignRoles', {
              default: 'You need staff:assign_roles or super admin to view or change roles.',
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
              {!canAssignRoles ? (
                <EmptyState
                  icon={ShieldX}
                  title={tAdmin('drawer.noAccessRoleAssignment', {
                    default: 'No access to role assignment',
                  })}
                  compact
                />
              ) : rolesLoading ? (
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
              {canAssignRoles && editableRoles && (
                <Button
                  type="button"
                  className="mt-2 w-full"
                  disabled={savingRoles || rolesLoading}
                  loading={savingRoles}
                  onClick={saveRoles}
                >
                  {savingRoles
                    ? tCommon('saving')
                    : tAdmin('drawer.saveRoles', { default: 'Save roles' })}
                </Button>
              )}
              {canAssignRoles && !editableRoles && (
                <p className="px-1 pt-1 font-sans text-xs text-muted-foreground">
                  {tAdmin('drawer.superAdminRolesLocked', {
                    default:
                      'A super admin’s roles can only be changed by another super admin.',
                  })}
                </p>
              )}
            </div>
          </section>

          <section>
            <SectionLabel
              hint={
                canChangeRole
                  ? tAdmin('drawer.superAdminOnly', { default: 'super admin only' })
                  : undefined
              }
            >
              {tAdmin('drawer.primaryRole', { default: 'Primary role' })}
            </SectionLabel>
            <div className={cn(GLASS_SUB, 'space-y-3 px-4 py-3.5')}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-sans text-sm font-medium text-foreground">
                    {tAdmin(`role.${user.role}`, { default: roleLabel[user.role] ?? user.role })}
                  </p>
                  <p className="font-sans text-xs text-muted-foreground">
                    {tAdmin('drawer.legacyRoleNote', {
                      default: 'Legacy account role used for tenant scoping',
                    })}
                  </p>
                </div>
                <Badge variant={roleBadge[user.role] ?? 'secondary'}>
                  {tAdmin(`role.${user.role}`, { default: roleLabel[user.role] ?? user.role })}
                </Badge>
              </div>
              {canChangeRole && (
                <>
                  <Separator />
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <label className="min-w-0 flex-1 space-y-1.5">
                      <span className="text-xs font-semibold text-muted-foreground">
                        {tAdmin('drawer.changePrimaryRole', { default: 'Change primary role' })}
                      </span>
                      <select
                        value={pendingRole}
                        onChange={(e) => setPendingRole(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 font-sans text-sm text-foreground outline-none focus:border-primary"
                      >
                        {['super_admin', 'admin', 'instructor', 'moderator', 'sponsor', 'learner'].map(
                          (r) => (
                            <option key={r} value={r}>
                              {tAdmin(`role.${r}`, { default: roleLabel[r] ?? r.replace('_', ' ') })}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      disabled={
                        savingRoles || !pendingRole || pendingRole === user.role || isSelf
                      }
                      loading={savingRoles}
                      onClick={changePrimaryRole}
                    >
                      {tAdmin('drawer.updateRole', { default: 'Update role' })}
                    </Button>
                  </div>
                  {isSelf && (
                    <p className="font-sans text-xs text-muted-foreground">
                      {tAdmin('drawer.cannotChangeOwnRole', {
                        default: 'You cannot change your own primary role.',
                      })}
                    </p>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
      );
    }

    if (activeTab === 'permissions') {
      if (!canManageRoles) {
        return (
          <EmptyState
            icon={Key}
            title={tAdmin('drawer.noAccessToPermissions', { default: 'No access to permissions' })}
            description={tAdmin('drawer.needManageRoles', {
              default:
                'You need the staff:manage_roles permission to inspect granted permissions.',
            })}
            compact
          />
        );
      }
      if (assignedIds.length === 0) {
        return (
          <EmptyState
            icon={Key}
            title={tAdmin('drawer.noRolesAssigned', { default: 'No roles assigned' })}
            description={tAdmin('drawer.assignRolesFirst', {
              default: 'Assign roles first to see effective permissions.',
            })}
            compact
          />
        );
      }
      if (permsLoading) {
        return (
          <LoadingState
            label={tAdmin('drawer.loadingPermissions', { default: 'Loading permissions…' })}
            rows={5}
          />
        );
      }
      return (
        <div className="space-y-7">
          <section>
            <SectionLabel
              hint={tAdmin('drawer.uniqueCount', {
                count: uniquePermKeys.length,
                default: '{count} unique',
              })}
            >
              {tAdmin('drawer.effectivePermissions', { default: 'Effective permissions' })}
            </SectionLabel>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {roleDetails.map((r) => (
                <div key={r.id} className={cn(GLASS_SUB, 'px-4 py-3.5')}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-sans text-sm font-medium text-foreground">{r.name}</p>
                    <Badge variant={roleBadge[r.key] ?? 'secondary'}>
                      {tAdmin('drawer.permsShort', {
                        count: (r.permissions ?? []).length,
                        default: '{count} perms',
                      })}
                    </Badge>
                  </div>
                  {r.description && (
                    <p className="mt-1 font-sans text-xs text-muted-foreground">{r.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(r.permissions ?? []).slice(0, 12).map((p) => (
                      <span
                        key={p}
                        className="rounded-md border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-2xs text-muted-foreground"
                      >
                        {p}
                      </span>
                    ))}
                    {(r.permissions?.length ?? 0) > 12 && (
                      <span className="px-1 py-0.5 font-sans text-2xs text-muted-foreground">
                        {tAdmin('drawer.moreCount', {
                          count: r.permissions!.length - 12,
                          default: '+{count} more',
                        })}
                      </span>
                    )}
                    {(r.permissions ?? []).length === 0 && (
                      <span className="font-sans text-xs text-muted-foreground">
                        {tAdmin('drawer.noPermsOnRole', {
                          default: 'No permissions on this role',
                        })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {uniquePermKeys.length > 0 && (
            <section>
              <SectionLabel
                hint={tAdmin('drawer.unionOfRoles', { default: 'Union of assigned roles' })}
              >
                {tAdmin('drawer.permissionKeys', { default: 'Permission keys' })}
              </SectionLabel>
              <div className={cn(GLASS_SUB, 'divide-y divide-border px-4 py-1')}>
                {uniquePermKeys.map((key) => {
                  const meta = labelForPerm(key);
                  return (
                    <div key={key} className="flex items-start justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-medium text-foreground">{key}</p>
                        <p className="truncate font-sans text-xs text-muted-foreground">
                          {meta?.description ||
                            meta?.label ||
                            meta?.resource ||
                            tAdmin('drawer.grantedViaRole', { default: 'Granted via role' })}
                        </p>
                      </div>
                      <Badge variant="soft" className="shrink-0 capitalize">
                        {meta?.resource || key.split(':')[0]}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      );
    }

    if (activeTab === 'security') {
      return (
        <div className="space-y-7">
          <section>
            <SectionLabel
              hint={
                canSuspend
                  ? undefined
                  : tAdmin('drawer.noPermission', { default: 'No permission' })
              }
            >
              {tAdmin('drawer.sessionControls', { default: 'Session controls' })}
            </SectionLabel>
            <div className={cn(GLASS_SUB, 'space-y-3 px-4 py-4')}>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-sans text-sm font-medium text-foreground">
                    {tAdmin('drawer.signInAccess', { default: 'Sign-in access' })}
                  </p>
                  <p className="mt-0.5 font-sans text-xs text-muted-foreground">
                    {user.accountStatus === 'suspended'
                      ? tAdmin('drawer.blockedUntilUnsuspended', {
                          default: 'Blocked from signing in until unsuspended.',
                        })
                      : tAdmin('drawer.allowedToAuthenticate', {
                          default: 'Allowed to authenticate and maintain sessions.',
                        })}
                  </p>
                </div>
                <Switch
                  checked={
                    user.accountStatus !== 'suspended' && user.accountStatus !== 'deleted'
                  }
                  disabled={
                    !canSuspend || togglingStatus || isSelf || user.accountStatus === 'deleted'
                  }
                  onCheckedChange={(next) => toggleSuspend(!next)}
                  aria-label={tAdmin('drawer.toggleSignInAccess', {
                    default: 'Toggle sign-in access',
                  })}
                />
              </div>
              <Separator />
              <div className="grid gap-2 sm:grid-cols-2">
                {canForcePw && (
                  <ActionButton
                    label={tAdmin('drawer.forcePasswordReset', {
                      default: 'Force password reset',
                    })}
                    icon={KeyRound}
                    onConfirm={() =>
                      mutate(
                        `/api/proxy/admin/users/${userId}/force-password-reset`,
                        { method: 'POST' },
                        tAdmin('drawer.passwordResetForced', {
                          default: 'Password reset forced',
                        }),
                      )
                    }
                  />
                )}
                {canImpersonate && !isSelf && user.role !== 'super_admin' && (
                  <ActionButton
                    label={tAdmin('drawer.impersonateStaff', { default: 'Impersonate staff' })}
                    icon={UserCog}
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
                    label={tAdmin('drawer.unsuspendStaff', { default: 'Unsuspend staff' })}
                    icon={UserCheck}
                    variant="success"
                    onConfirm={() =>
                      mutate(
                        `/api/proxy/admin/users/${userId}/unsuspend`,
                        { method: 'POST' },
                        tAdmin('drawer.staffUnsuspended', { default: 'Staff unsuspended' }),
                      ).then(() => loadAll())
                    }
                  />
                )}
                {canSuspend &&
                  user.accountStatus !== 'suspended' &&
                  user.accountStatus !== 'deleted' && (
                    <ActionButton
                      label={tAdmin('drawer.suspendStaff', { default: 'Suspend staff' })}
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
                          tAdmin('drawer.staffSuspended', { default: 'Staff suspended' }),
                        ).then(() => loadAll())
                      }
                    />
                  )}
              </div>
            </div>
          </section>

          <section>
            <SectionLabel>
              {tAdmin('drawer.activeSessions', { default: 'Active sessions' })}
            </SectionLabel>
            {sessions.length === 0 ? (
              <EmptyState
                icon={Lock}
                title={tAdmin('drawer.noActiveSessions', { default: 'No active sessions' })}
                compact
              />
            ) : (
              <ul className="space-y-2">
                {sessions.map((s) => (
                  <li
                    key={s.id}
                    className={cn(GLASS_SUB, 'flex items-center justify-between gap-2 px-4 py-3')}
                  >
                    <div className="min-w-0 font-sans text-xs">
                      <p className="truncate font-medium text-foreground">
                        {deviceLabel(
                          s.userAgent,
                          tAdmin('drawer.unknownDevice', { default: 'Unknown device' }),
                        )}
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
        </div>
      );
    }

    if (activeTab === 'activity') {
      return (
        <div className="space-y-7">
          <section>
            <SectionLabel
              hint={tAdmin('drawer.recentCount', {
                count: audit.length,
                default: '{count} recent',
              })}
            >
              {tAdmin('drawer.auditTrail', { default: 'Audit trail' })}
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
                  <li
                    key={a.id}
                    className="flex items-start justify-between gap-3 px-2 py-2.5 font-sans text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-mono font-medium text-foreground">{a.action}</p>
                      {a.details && Object.keys(a.details).length > 0 && (
                        <p className="mt-0.5 truncate text-muted-foreground">
                          {Object.entries(a.details)
                            .slice(0, 3)
                            .map(([k, v]) => `${k}: ${String(v)}`)
                            .join(' · ')}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-muted-foreground/70">
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
      width="max-w-4xl"
      tabs={TABS.map((tab) => ({
        ...tab,
        label: tAdmin(`tabs.${tab.key}`, { default: tab.label }),
      }))}
      activeTab={activeTab}
      onTabChange={(k) => setActiveTab(k as TabKey)}
      title={
        user?.name ||
        user?.email ||
        tAdmin('drawer.staffDetails', { default: 'Staff details' })
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
                  roleGrad[user.role] ??
                    (user.accountStatus === 'suspended'
                      ? 'bg-destructive text-destructive-foreground'
                      : 'bg-foreground text-background'),
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
                  {isSelf && (
                    <Badge variant="soft">{tAdmin('drawer.you', { default: 'You' })}</Badge>
                  )}
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
              {tAdmin('drawer.staffMember', { default: 'Staff member' })}
            </p>
          )}
        </div>
      }
    >
      <div className="flex-1 space-y-0 overflow-y-auto px-6 py-6">
        {loadError && (
          <ErrorState
            title={tAdmin('drawer.couldNotLoadStaff', { default: 'Could not load staff member' })}
            description={loadError}
            onRetry={loadAll}
            compact
            className="mb-4 rounded-xl border border-destructive/40 bg-destructive/5"
          />
        )}
        {loading && !user ? (
          <LoadingState
            label={tAdmin('drawer.loadingStaffMember', { default: 'Loading staff member…' })}
            rows={4}
          />
        ) : (
          renderTab()
        )}
      </div>
    </Modal>
  );
}
