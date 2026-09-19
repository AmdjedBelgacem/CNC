'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  X,
  Loader2,
  UserX,
  UserCheck,
  KeyRound,
  LogIn,
  ShieldX,
  MonitorSmartphone,
  History,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import { ROLE_OPTIONS, ADMIN_ROLES, userInitials, type AdminUserRow } from './users-shared';
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
function ConfirmButton({
  label,
  confirmLabel,
  icon: Icon,
  className,
  onConfirm,
}: {
  label: string;
  confirmLabel: string;
  icon: typeof UserX;
  className?: string;
  onConfirm: () => Promise<void>;
}) {
  const [arming, setArming] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!arming) {
          setArming(true);
          return;
        }
        setBusy(true);
        try {
          await onConfirm();
        } finally {
          setBusy(false);
          setArming(false);
        }
      }}
      onBlur={() => setArming(false)}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition disabled:opacity-50',
        arming
          ? 'border-red-500 bg-red-500 text-white'
          : (className ?? 'border-border hover:bg-muted'),
      )}
    >
      {' '}
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}{' '}
      {busy ? 'Working…' : arming ? confirmLabel : label}{' '}
    </button>
  );
}
export function UserDrawer({
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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newRole, setNewRole] = useState('');
  const [impersonating, setImpersonating] = useState(false); // Current viewer (drives action visibility + self-impersonation guard)
  const [myRole, setMyRole] = useState('');
  const [myId, setMyId] = useState('');
  useEffect(() => {
    fetch('/api/proxy/auth/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => {
        setMyRole(me?.role ?? '');
        setMyId(me?.id ?? '');
      })
      .catch(() => {});
  }, []);
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
      if (!uRes.ok) throw new Error(`Failed to load user (${uRes.status})`);
      setUser(await uRes.json());
      if (sRes.ok) setSessions((await sRes.json())?.sessions ?? []);
      if (aRes.ok) {
        const logs = await aRes.json();
        setAudit(Array.isArray(logs) ? logs : (logs?.items ?? []));
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
  const suspend = () =>
    mutate(
      `/api/proxy/admin/users/${userId}/suspend`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Suspended from admin panel' }),
      },
      'User suspended',
    ).then(loadAll);
  const unsuspend = () =>
    mutate(
      `/api/proxy/admin/users/${userId}/unsuspend`,
      { method: 'POST' },
      'User unsuspended',
    ).then(loadAll);
  const forceReset = () =>
    mutate(
      `/api/proxy/admin/users/${userId}/force-password-reset`,
      { method: 'POST' },
      'Password reset forced',
    ).then(loadAll);
  const changeRole = async () => {
    if (!newRole || newRole === user?.role) return;
    await mutate(
      `/api/proxy/admin/users/${userId}/role`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      },
      `Role changed to ${newRole}`,
    );
    setNewRole('');
    loadAll();
  };
  const revokeSession = (sessionId: string) =>
    mutate(
      `/api/proxy/admin/sessions/${sessionId}/revoke`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      },
      'Session revoked',
    ).then(loadAll);
  const impersonate = async () => {
    setImpersonating(true);
    try {
      const res = await fetch(`/api/proxy/admin/users/${userId}/impersonate`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? `Failed (${res.status})`);
      }
      toast({
        type: 'ok',
        title: 'Impersonation started',
        description: 'You are now browsing as this user.',
      });
      window.location.href = '/';
    } catch (e: any) {
      toast({ type: 'err', title: 'Impersonation failed', description: e?.message });
      setImpersonating(false);
    }
  };
  const canModerate = ADMIN_ROLES.includes(myRole); // suspend/unsuspend
  const isSuper = myRole === 'super_admin'; // reset/role/impersonate/revoke-session
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {' '}
      {/* Backdrop */}{' '}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />{' '}
      {/* Panel */}{' '}
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border bg-card shadow-sm">
        {' '}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-card px-5 py-4">
          {' '}
          {loading ? (
            <div className="flex items-center gap-3">
              {' '}
              <div className="h-11 w-11 animate-pulse rounded-md bg-muted" />{' '}
              <div className="space-y-2">
                {' '}
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />{' '}
                <div className="h-3 w-44 animate-pulse rounded bg-muted" />{' '}
              </div>{' '}
            </div>
          ) : user ? (
            <div className="flex items-center gap-3">
              {' '}
              <span className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-sm font-bold text-primary">
                {' '}
                {userInitials(user.name, user.email)}{' '}
              </span>{' '}
              <div className="min-w-0">
                {' '}
                <p className="truncate font-semibold">
                  {user.name || user.email.split('@')[0]}
                </p>{' '}
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>{' '}
              </div>{' '}
            </div>
          ) : (
            <p className="font-semibold">User</p>
          )}{' '}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            {' '}
            <X className="h-5 w-5" />{' '}
          </button>{' '}
        </div>{' '}
        <div className="space-y-6 px-5 py-5">
          {' '}
          {loadError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3">
              {' '}
              <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>{' '}
              <button
                type="button"
                onClick={loadAll}
                className="mt-1 text-sm font-medium underline"
              >
                {' '}
                Retry{' '}
              </button>{' '}
            </div>
          )}{' '}
          {!loading && user && (
            <>
              {' '}
              {/* Profile */}{' '}
              <section className="space-y-2.5">
                {' '}
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Profile
                </h3>{' '}
                <dl className="space-y-1.5 rounded-xl border border-border p-3 text-sm">
                  {' '}
                  <div className="flex justify-between gap-3">
                    {' '}
                    <dt className="text-muted-foreground">Username</dt>{' '}
                    <dd className="truncate font-medium">{user.username || '—'}</dd>{' '}
                  </div>{' '}
                  <div className="flex justify-between gap-3">
                    {' '}
                    <dt className="text-muted-foreground">Role</dt>{' '}
                    <dd className="font-medium capitalize">{user.role.replace('_', ' ')}</dd>{' '}
                  </div>{' '}
                  <div className="flex justify-between gap-3">
                    {' '}
                    <dt className="text-muted-foreground">Status</dt>{' '}
                    <dd
                      className={cn(
                        'font-medium capitalize',
                        user.accountStatus === 'suspended' && 'text-red-600 dark:text-red-400',
                      )}
                    >
                      {' '}
                      {user.accountStatus.replace(/_/g, ' ')}{' '}
                    </dd>{' '}
                  </div>{' '}
                  <div className="flex justify-between gap-3">
                    {' '}
                    <dt className="text-muted-foreground">Joined</dt>{' '}
                    <dd className="font-medium">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </dd>{' '}
                  </div>{' '}
                </dl>{' '}
              </section>{' '}
              {/* Actions */}{' '}
              <section className="space-y-2">
                {' '}
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Actions
                </h3>{' '}
                {canModerate &&
                  (user.accountStatus === 'suspended' ? (
                    <button
                      type="button"
                      onClick={unsuspend}
                      className="flex w-full items-center gap-2 rounded-lg border border-green-500/40 px-3 py-2 text-sm font-medium text-green-600 transition hover:bg-green-500/10 dark:text-green-400"
                    >
                      {' '}
                      <UserCheck className="h-4 w-4" /> Unsuspend user{' '}
                    </button>
                  ) : (
                    <ConfirmButton
                      label="Suspend user"
                      confirmLabel="Click again to confirm suspension"
                      icon={UserX}
                      className="border-red-500/40 text-red-600 dark:text-red-400"
                      onConfirm={suspend}
                    />
                  ))}{' '}
                {isSuper && (
                  <ConfirmButton
                    label="Force password reset"
                    confirmLabel="Click again to force reset"
                    icon={KeyRound}
                    onConfirm={forceReset}
                  />
                )}{' '}
                {isSuper && user.role !== 'super_admin' && (
                  <div className="flex gap-2">
                    {' '}
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-sm capitalize outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {' '}
                      <option value="">Change role…</option>{' '}
                      {ROLE_OPTIONS.filter((r) => r !== user.role).map((r) => (
                        <option key={r} value={r}>
                          {' '}
                          {r.replace('_', ' ')}{' '}
                        </option>
                      ))}{' '}
                    </select>{' '}
                    <button
                      type="button"
                      disabled={!newRole}
                      onClick={changeRole}
                      className="h-9 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-40"
                    >
                      {' '}
                      Apply{' '}
                    </button>{' '}
                  </div>
                )}{' '}
                {isSuper && !isSelf && (
                  <button
                    type="button"
                    disabled={impersonating || user.accountStatus === 'suspended'}
                    onClick={impersonate}
                    className="flex w-full items-center gap-2 rounded-lg border border-blue-500/40 px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-500/10 disabled:opacity-40 dark:text-blue-400"
                  >
                    {' '}
                    {impersonating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <LogIn className="h-4 w-4" />
                    )}{' '}
                    Impersonate user{' '}
                  </button>
                )}{' '}
              </section>{' '}
              {/* Sessions */}{' '}
              <section className="space-y-2">
                {' '}
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {' '}
                  <MonitorSmartphone className="h-3.5 w-3.5" /> Active sessions ({sessions.length}
                  ){' '}
                </h3>{' '}
                {sessions.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                    {' '}
                    No active sessions{' '}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {' '}
                    {sessions.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2"
                      >
                        {' '}
                        <div className="min-w-0 text-xs">
                          {' '}
                          <p className="truncate font-medium">
                            {s.userAgent?.split(')')[0]?.replace(/^Mozilla\/5\.0 \(/, '') ||
                              'Unknown device'}
                          </p>{' '}
                          <p className="truncate text-muted-foreground">
                            {' '}
                            {s.ipAddress ? `${s.ipAddress} · ` : ''}{' '}
                            {s.lastActiveAt
                              ? `active ${new Date(s.lastActiveAt).toLocaleString()}`
                              : ''}{' '}
                          </p>{' '}
                        </div>{' '}
                        {isSuper && (
                          <button
                            type="button"
                            title="Revoke session"
                            onClick={() => revokeSession(s.id)}
                            className="shrink-0 rounded-lg p-1.5 text-red-600 transition hover:bg-red-500/10 dark:text-red-400"
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
              {/* Audit trail */}{' '}
              <section className="space-y-2">
                {' '}
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {' '}
                  <History className="h-3.5 w-3.5" /> Recent audit trail{' '}
                </h3>{' '}
                {audit.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                    {' '}
                    No audit entries{' '}
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {' '}
                    {audit.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-1.5 text-xs"
                      >
                        {' '}
                        <span className="truncate font-mono">{a.action}</span>{' '}
                        <span className="shrink-0 text-muted-foreground">
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
      </aside>{' '}
    </div>
  );
}
