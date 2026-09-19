'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, Shield, Trash2, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import {
  AdminCommandBar,
  BarPrimaryButton,
  AdminPageHeader,
} from '@/components/admin/admin-chrome';
import { RightSheet, RightSheetHeader, GLASS_SUB } from '@/components/ui/right-sheet';
import { useCan } from '@/lib/use-permissions';
interface PermDef {
  key: string;
  label: string;
  description?: string;
  resource: string;
}
interface PermGroup {
  group: string;
  label: string;
  permissions: PermDef[];
}
interface RoleSummary {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissionCount?: number;
  userCount?: number;
  permissions?: string[];
}
const roleGrad: Record<string, string> = {
  super_admin: 'bg-purple-600 text-white',
  admin: 'bg-blue-600 text-white',
  instructor: 'bg-emerald-600 text-white',
  moderator: 'bg-cyan-600 text-white',
  sponsor: 'bg-orange-600 text-white',
};
export default function AdminRolesPage() {
  const canManage = useCan('staff:manage_roles');
  const [roles, setRoles] = useState<RoleSummary[] | null>(null);
  const [catalog, setCatalog] = useState<PermGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<RoleSummary | null>(null);
  const [creating, setCreating] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, cRes] = await Promise.all([
        fetch('/api/proxy/admin/roles', { credentials: 'include' }),
        fetch('/api/proxy/admin/permissions', { credentials: 'include' }),
      ]);
      if (rRes.ok) setRoles(await rRes.json());
      if (cRes.ok) setCatalog(await cRes.json());
    } catch {
      setRoles(null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <div className="w-full">
      <AdminCommandBar
        trail={[{ label: 'Staff & Access', href: '/admin/staff' }, { label: 'Roles' }]}
        count={roles ? roles.length : null}
        live="Live"
        primary={
          canManage ? (
            <BarPrimaryButton
              icon={<Plus className="h-4 w-4" strokeWidth={2.5} />}
              onClick={() => setCreating(true)}
            >
              New role
            </BarPrimaryButton>
          ) : undefined
        }
      />
      <div className="mx-auto w-full max-w-[1500px] space-y-6 pt-6">
        <AdminPageHeader
          title="Roles & Permissions"
          description="Define custom roles and the precise access each staff member gets."
          badge={
            <span className="flex items-center gap-2 self-start rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3 py-1.5 text-xs font-medium text-emerald-800 shadow-sm md:self-auto dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200">
              <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Audited changes
            </span>
          }
        />
        <div>
          <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
            <div className="hidden border-b border-border bg-muted/40 px-6 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:flex md:items-center md:justify-between">
              <span className="flex-1">Role</span>
              <span className="w-[260px] text-right">Permissions · Members</span>
            </div>
            <div className="flex-1">
              {loading &&
                !roles &&
                Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between border-b border-border p-6"
                  >
                    <div className="flex items-center gap-5">
                      <div className="h-12 w-12 animate-pulse rounded-xl bg-muted" />
                      <div className="space-y-2">
                        <div className="h-4 w-36 animate-pulse rounded bg-muted" />
                        <div className="h-3 w-52 animate-pulse rounded bg-muted" />
                      </div>
                    </div>
                    <div className="h-7 w-24 animate-pulse rounded-md bg-muted" />
                  </div>
                ))}
              {!loading && roles && roles.length === 0 && (
                <div className="px-6 py-20 text-center">
                  {' '}
                  <p className="font-sans text-base font-medium text-foreground">
                    No custom roles yet
                  </p>{' '}
                  <p className="mt-1 font-sans text-sm text-muted-foreground">
                    Create a role to grant a tailored set of permissions.
                  </p>{' '}
                </div>
              )}{' '}
              {!loading &&
                roles &&
                roles.map((r) => {
                  const rm = roleGrad[r.key] ?? 'from-muted to-muted/60 text-foreground';
                  const canEdit = canManage && (!r.isSystem || canManage);
                  return (
                    <button
                      key={r.id}
                      disabled={!canEdit}
                      onClick={() => setEditing(r)}
                      className={cn(
                        'group flex w-full items-center justify-between border-b border-border p-5 text-left transition-all duration-200 last:border-b-0',
                        canEdit ? 'cursor-pointer hover:bg-muted/50' : 'cursor-default',
                      )}
                    >
                      {' '}
                      <div className="flex min-w-0 flex-1 items-center gap-4">
                        {' '}
                        <span
                          className={cn(
                            'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-semibold',
                            rm,
                          )}
                        >
                          {' '}
                          <Shield className="h-5 w-5" />{' '}
                        </span>{' '}
                        <div className="min-w-0">
                          {' '}
                          <div className="flex items-center gap-2">
                            {' '}
                            <p className="truncate font-sans text-[17px] font-semibold text-foreground">
                              {r.name}
                            </p>{' '}
                            {r.isSystem && (
                              <span className="rounded-md border border-purple-100 bg-purple-50/60 px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wide text-purple-700 dark:border-purple-900/40 dark:bg-purple-950/30 dark:text-purple-300">
                                {' '}
                                System{' '}
                              </span>
                            )}{' '}
                          </div>{' '}
                          <p className="truncate font-sans text-sm text-muted-foreground">
                            {r.description || r.key}
                          </p>{' '}
                        </div>{' '}
                      </div>{' '}
                      <div className="flex w-[260px] items-center justify-end gap-6 font-sans text-sm text-muted-foreground">
                        {' '}
                        <span>{r.permissionCount ?? 0} permissions</span>{' '}
                        <span>{r.userCount ?? 0} members</span>{' '}
                      </div>{' '}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
      {creating && (
        <RoleEditor
          mode="create"
          catalog={catalog}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            load();
          }}
        />
      )}{' '}
      {editing && (
        <RoleEditor
          mode="edit"
          role={editing}
          catalog={catalog}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
          onDeleted={() => {
            setEditing(null);
            load();
          }}
        />
      )}{' '}
    </div>
  );
}
function RoleEditor({
  mode,
  role,
  catalog,
  onClose,
  onSaved,
  onDeleted,
}: {
  mode: 'create' | 'edit';
  role?: RoleSummary;
  catalog: PermGroup[];
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}) {
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [selected, setSelected] = useState<string[]>(role?.permissions ?? []);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loadingRole, setLoadingRole] = useState(false);
  useEffect(() => {
    if (mode === 'edit' && role?.id) {
      let cancelled = false;
      setLoadingRole(true);
      fetch(`/api/proxy/admin/roles/${role.id}`, { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!cancelled && data?.permissions) setSelected(data.permissions as string[]);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoadingRole(false);
        });
      return () => {
        cancelled = true;
      };
    }
  }, [mode, role?.id]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catalog;
    return catalog
      .map((g) => ({
        ...g,
        permissions: g.permissions.filter(
          (p) => p.key.toLowerCase().includes(q) || p.label.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.permissions.length > 0);
  }, [catalog, search]);
  const toggle = (key: string) => {
    setDirty(true);
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };
  const toggleGroup = (keys: string[]) => {
    setDirty(true);
    const allOn = keys.every((k) => selected.includes(k));
    setSelected((prev) =>
      allOn ? prev.filter((k) => !keys.includes(k)) : Array.from(new Set([...prev, ...keys])),
    );
  };
  const save = async () => {
    if (!name.trim()) {
      toast({ type: 'err', title: 'Name required' });
      return;
    }
    setBusy(true);
    try {
      let roleId = role?.id;
      if (mode === 'create') {
        const res = await fetch('/api/proxy/admin/roles', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
        });
        if (!res.ok) {
          const m = (await res.json().catch(() => ({})))?.message ?? 'Failed to create role';
          throw new Error(m);
        }
        roleId = (await res.json()).id;
      } else if (role) {
        const res = await fetch(`/api/proxy/admin/roles/${role.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
        });
        if (!res.ok) {
          const m = (await res.json().catch(() => ({})))?.message ?? 'Failed to update role';
          throw new Error(m);
        }
      }
      const pRes = await fetch(`/api/proxy/admin/roles/${roleId}/permissions`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: selected }),
      });
      if (!pRes.ok) {
        const m = (await pRes.json().catch(() => ({})))?.message ?? 'Failed to save permissions';
        throw new Error(m);
      }
      toast({ type: 'ok', title: mode === 'create' ? 'Role created' : 'Role updated' });
      onSaved();
    } catch (e: any) {
      toast({ type: 'err', title: 'Save failed', description: e?.message });
    } finally {
      setBusy(false);
    }
  };
  const del = async () => {
    if (!role) return;
    if (!confirm(`Delete the role “${role.name}”? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/proxy/admin/roles/${role.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const m = (await res.json().catch(() => ({})))?.message ?? 'Failed to delete';
        throw new Error(m);
      }
      toast({ type: 'ok', title: 'Role deleted' });
      onDeleted?.();
    } catch (e: any) {
      toast({ type: 'err', title: 'Delete failed', description: e?.message });
    } finally {
      setBusy(false);
    }
  };
  const totalSelected = selected.length;
  return (
    <RightSheet
      onClose={onClose}
      width="max-w-[560px]"
      header={
        <RightSheetHeader
          loading={false}
          initials="R"
          gradient="bg-foreground text-background"
          title={mode === 'create' ? 'New role' : (role?.name ?? 'Role')}
          subtitle={
            mode === 'create'
              ? 'Define a custom role'
              : role?.isSystem
                ? 'System role'
                : 'Custom role'
          }
          onClose={onClose}
        />
      }
    >
      {' '}
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-6">
        {' '}
        <section className="space-y-3">
          {' '}
          <div>
            {' '}
            <label className="mb-1.5 block font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Name
            </label>{' '}
            <input
              value={name}
              disabled={mode === 'edit' && role?.isSystem}
              onChange={(e) => {
                setDirty(true);
                setName(e.target.value);
              }}
              placeholder="e.g. Content Editor"
              className={cn(
                GLASS_SUB,
                'w-full rounded-lg px-3 py-2.5 font-sans text-sm text-foreground outline-none transition focus:ring-2 focus:ring-accent/30',
              )}
            />{' '}
          </div>{' '}
          <div>
            {' '}
            <label className="mb-1.5 block font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Description
            </label>{' '}
            <input
              value={description}
              disabled={mode === 'edit' && role?.isSystem}
              onChange={(e) => {
                setDirty(true);
                setDescription(e.target.value);
              }}
              placeholder="Short description of this role"
              className={cn(
                GLASS_SUB,
                'w-full rounded-lg px-3 py-2.5 font-sans text-sm text-foreground outline-none transition focus:ring-2 focus:ring-accent/30',
              )}
            />{' '}
          </div>{' '}
          {mode === 'edit' && role?.isSystem && (
            <p className="rounded-lg border border-purple-100 bg-purple-50/60 px-3 py-2 font-sans text-xs text-purple-700 dark:border-purple-900/40 dark:bg-purple-950/30 dark:text-purple-300">
              {' '}
              System roles cannot be renamed but a super admin may adjust their permissions.{' '}
            </p>
          )}{' '}
        </section>{' '}
        <section>
          {' '}
          <div className="mb-3 flex items-center justify-between gap-3">
            {' '}
            <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {' '}
              Permissions{' '}
              {totalSelected > 0 && (
                <span className="text-accent">· {totalSelected} selected</span>
              )}{' '}
            </h3>{' '}
            <div className="relative w-48">
              {' '}
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />{' '}
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter permissions"
                className={cn(
                  GLASS_SUB,
                  'w-full rounded-lg py-2 pl-9 pr-3 font-sans text-sm text-foreground outline-none transition focus:ring-2 focus:ring-accent/30',
                )}
              />{' '}
            </div>{' '}
          </div>{' '}
          <div className="space-y-4">
            {' '}
            {loadingRole && (
              <p
                className={cn(
                  GLASS_SUB,
                  'px-4 py-6 text-center font-sans text-sm text-muted-foreground',
                )}
              >
                Loading permissions…
              </p>
            )}{' '}
            {!loadingRole &&
              filtered.map((g) => {
                const keys = g.permissions.map((p) => p.key);
                const allOn = keys.length > 0 && keys.every((k) => selected.includes(k));
                return (
                  <div key={g.group} className={cn(GLASS_SUB, 'p-3')}>
                    {' '}
                    <div className="mb-2 flex items-center justify-between">
                      {' '}
                      <span className="font-sans text-sm font-semibold capitalize text-foreground">
                        {g.label}
                      </span>{' '}
                      <button
                        type="button"
                        onClick={() => toggleGroup(keys)}
                        className="rounded-md px-2 py-1 font-sans text-xs font-medium text-accent transition hover:bg-muted/50"
                      >
                        {' '}
                        {allOn ? 'Clear' : 'Select all'}{' '}
                      </button>{' '}
                    </div>{' '}
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {' '}
                      {g.permissions.map((p) => {
                        const on = selected.includes(p.key);
                        return (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() => toggle(p.key)}
                            className={cn(
                              'flex items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition',
                              on
                                ? 'border-blue-500 bg-blue-500/5'
                                : 'border-border hover:bg-muted/50',
                            )}
                          >
                            {' '}
                              <span
                                className={cn(
                                  'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-md border transition',
                                  on
                                    ? 'border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                                    : 'border-border bg-background',
                                )}
                              >
                              {' '}
                              {on && <Check className="h-3 w-3" />}{' '}
                            </span>{' '}
                            <span className="min-w-0">
                              {' '}
                              <span className="block font-sans text-sm font-medium text-foreground">
                                {p.label}
                              </span>{' '}
                              <span className="block truncate font-mono text-[10px] text-muted-foreground">
                                {p.key}
                              </span>{' '}
                            </span>{' '}
                          </button>
                        );
                      })}{' '}
                    </div>{' '}
                  </div>
                );
              })}{' '}
            {filtered.length === 0 && (
              <p
                className={cn(
                  GLASS_SUB,
                  'px-4 py-6 text-center font-sans text-sm text-muted-foreground',
                )}
              >
                No permissions match “{search}”
              </p>
            )}{' '}
          </div>{' '}
        </section>{' '}
        <div className="sticky bottom-0 -mx-6 flex items-center justify-between gap-3 border-t border-border bg-white px-6 py-4">
          {' '}
          <div>
            {' '}
            {mode === 'edit' && role && !role.isSystem && (
              <button
                type="button"
                onClick={del}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-lg border border-red-200/70 px-3 py-2 font-sans text-sm font-medium text-red-600 transition hover:bg-red-50/70 disabled:opacity-40 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                {' '}
                <Trash2 className="h-4 w-4" /> Delete{' '}
              </button>
            )}{' '}
          </div>{' '}
          <div className="flex items-center gap-3">
            {' '}
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 font-sans text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              Cancel
            </button>{' '}
            <button
              onClick={save}
              disabled={busy || (!dirty && mode === 'edit')}
              className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2 font-sans text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-40"
            >
              {' '}
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}{' '}
              {mode === 'create' ? 'Create role' : 'Save changes'}{' '}
            </button>{' '}
          </div>{' '}
        </div>{' '}
      </div>{' '}
    </RightSheet>
  );
}
