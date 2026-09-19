'use client';
import { useCallback, useEffect, useState } from 'react';
import { Loader2, UserX, UserCheck, KeyRound, LogIn, ShieldX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import { RightSheet, RightSheetHeader, GLASS_SUB } from '@/components/ui/right-sheet';
import { useAuthStore } from '@/stores/auth-store';
import { useCan, useCanAny, useIsSuper } from '@/lib/use-permissions';
import { userInitials, type AdminUserRow } from '../users/users-shared';
const roleGrad: Record<string, string> = {
  super_admin: 'bg-purple-600 text-white',
  admin: 'bg-blue-600 text-white',
  instructor: 'bg-emerald-600 text-white',
  moderator: 'bg-cyan-600 text-white',
  sponsor: 'bg-orange-600 text-white',
};
const roleLabel: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  instructor: 'Instructor',
  moderator: 'Moderator',
  sponsor: 'Sponsor',
};
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
  const myId = me?.id ?? '';
  const canSuspend = useCanAny(['staff:suspend', 'users:suspend']);
  const canForcePw = useCan('users:force_password_reset');
  const canImpersonate = useCan('staff:impersonate');
  const canRevoke = useCanAny(['staff:impersonate', 'users:manage', 'staff:assign_roles']);
  const canAssignRoles = useCan('staff:assign_roles');
  const isSuper = useIsSuper();
  const [user, setUser] = useState<(AdminUserRow & { bio?: string | null }) | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [allRoles, setAllRoles] = useState<RoleSummary[]>([]);
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [savingRoles, setSavingRoles] = useState(false);
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
        fetch(`/api/proxy/admin/audit-logs?userId=${userId}&limit=8`, { credentials: 'include' }),
      ]);
      if (!uRes.ok) throw new Error(`Failed to load (${uRes.status})`);
      setUser(await uRes.json());
      if (sRes.ok) setSessions((await sRes.json())?.sessions ?? []);
      if (aRes.ok) {
        const l = await aRes.json();
        setAudit(Array.isArray(l) ? l : (l?.items ?? []));
      }
    } catch (e: any) {
      setLoadError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [userId]);
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
  const targetIsSuper = user?.role === 'super_admin';
  const editableRoles = !targetIsSuper || isSuper;
  const assignableRoles = allRoles.filter((r) => r.key !== 'super_admin');
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
        'Roles updated',
      );
    } finally {
      setSavingRoles(false);
    }
  };
  return (
    <RightSheet
      onClose={onClose}
      width="max-w-[460px]"
      header={
        <RightSheetHeader
          loading={loading}
          initials={user ? userInitials(user.name, user.email) : ''}
          gradient={
            user ? (roleGrad[user.role] ?? roleGrad.admin!) : 'bg-muted text-muted-foreground'
          }
          title={user ? user.name || user.email.split('@')[0] || user.email : 'Staff'}
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
        {!loading && user && (
          <>
            {' '}
            {/* Profile */}{' '}
            <section>
              {' '}
              <SectionLabel>Profile</SectionLabel>{' '}
              <dl
                className={cn(
                  GLASS_SUB,
                  'divide-y divide-border px-4 py-1',
                )}
              >
                {' '}
                {[
                  ['Username', user.username || '—'],
                  ['Role', roleLabel[user.role] ?? user.role.replace('_', ' ')],
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
                  <div
                    key={k}
                    className="flex items-center justify-between py-2.5 font-sans text-sm"
                  >
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
            {/* Roles */}{' '}
            {canAssignRoles && (
              <section>
                {' '}
                <SectionLabel>Roles</SectionLabel>{' '}
                <div className={cn(GLASS_SUB, 'space-y-2 p-3')}>
                  {' '}
                  {rolesLoading ? (
                    <p className="px-1 py-2 font-sans text-sm text-muted-foreground">
                      Loading roles…
                    </p>
                  ) : assignableRoles.length === 0 ? (
                    <p className="px-1 py-2 font-sans text-sm text-muted-foreground">
                      No roles available
                    </p>
                  ) : (
                    assignableRoles.map((r) => {
                      const checked = assignedIds.includes(r.id);
                      return (
                        <label
                          key={r.id}
                          className={cn(
                            'flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition',
                            editableRoles
                              ? 'hover:bg-muted'
                              : 'cursor-default',
                            r.isSystem && 'opacity-90',
                          )}
                        >
                          {' '}
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
                            className="h-4 w-4 rounded border-border accent-blue-600"
                          />{' '}
                          <span className="min-w-0 flex-1">
                            {' '}
                            <span className="block font-sans text-sm font-medium text-foreground">
                              {r.name}
                            </span>{' '}
                            <span className="block truncate font-sans text-xs text-muted-foreground">
                              {' '}
                              {r.isSystem ? 'System role · ' : ''}
                              {r.permissionCount ?? 0} permissions{' '}
                            </span>{' '}
                          </span>{' '}
                          {r.isSystem && (
                            <span className="rounded-md border border-purple-100 bg-purple-50/60 px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wide text-purple-700 dark:border-purple-900/40 dark:bg-purple-950/30 dark:text-purple-300">
                              {' '}
                              System{' '}
                            </span>
                          )}{' '}
                        </label>
                      );
                    })
                  )}{' '}
                  {editableRoles && (
                    <button
                      type="button"
                      disabled={savingRoles}
                      onClick={saveRoles}
                      className="mt-1 w-full rounded-lg bg-accent px-3.5 py-2.5 font-sans text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-40"
                    >
                      {' '}
                      {savingRoles ? 'Saving…' : 'Save roles'}{' '}
                    </button>
                  )}{' '}
                  {!editableRoles && (
                    <p className="px-1 pt-1 font-sans text-xs text-muted-foreground">
                      A super admin’s roles can only be changed by another super admin.
                    </p>
                  )}{' '}
                </div>{' '}
              </section>
            )}{' '}
            {/* Actions */}{' '}
            <section>
              {' '}
              <SectionLabel>Actions</SectionLabel>{' '}
              <div className="space-y-2">
                {' '}
                {canSuspend &&
                  (user.accountStatus === 'suspended' ? (
                    <ActionButton
                      label="Unsuspend staff"
                      icon={UserCheck}
                      variant="success"
                      onConfirm={() =>
                        mutate(
                          `/api/proxy/admin/users/${userId}/unsuspend`,
                          { method: 'POST' },
                          'Staff unsuspended',
                        )
                      }
                    />
                  ) : (
                    <ActionButton
                      label="Suspend staff"
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
                          'Staff suspended',
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
                {canImpersonate && !isSelf && user.role !== 'super_admin' && (
                  <ActionButton
                    label="Impersonate staff"
                    icon={LogIn}
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
            {/* Sessions */}{' '}
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
            {/* Audit */}{' '}
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
        )}{' '}
      </div>{' '}
    </RightSheet>
  );
}
