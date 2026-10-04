'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, Shield, Trash2, Loader2, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import {
  AdminCommandBar,
  BarPrimaryButton,
  AdminPageHeader,
} from '@/components/admin/admin-chrome';
import { Modal, ModalHeader, GLASS_SUB } from '@/components/ui/modal';
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
  super_admin: 'bg-primary text-primary-foreground',
  admin: 'bg-primary text-primary-foreground',
  instructor: 'bg-success text-success-foreground',
  moderator: 'bg-info text-info-foreground',
  sponsor: 'bg-orange-600 text-white',
};
export default function AdminRolesPage() {
  const tAdmin = useTranslations('admin');
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
        trail={[
          {
            label: tAdmin('access.breadcrumb', { default: 'Staff & Access' }),
            href: '/admin/staff',
          },
          { label: tAdmin('tabs.roles', { default: 'Roles' }) },
        ]}
        count={roles ? roles.length : null}
        live={tAdmin('live', { default: 'Live' })}
        primary={
          canManage ? (
            <BarPrimaryButton
              icon={<Plus className="size-4" strokeWidth={2.5} />}
              onClick={() => setCreating(true)}
            >
              {tAdmin('roles.newRole', { default: 'New role' })}
            </BarPrimaryButton>
          ) : undefined
        }
      />
      <div className="mx-auto w-full max-w-[1500px] space-y-6 pt-6">
        <AdminPageHeader
          title={tAdmin('roles.title', { default: 'Roles & Permissions' })}
          description={tAdmin('roles.description', {
            default: 'Define custom roles and the precise access each staff member gets.',
          })}
          badge={
            <span className="flex items-center gap-2 self-start rounded-full border border-success/80 bg-success/80 px-3 py-1.5 text-xs font-medium text-success shadow-sm md:self-auto dark:border-success/40 dark:bg-success/40 dark:text-success">
              <Shield className="size-4 text-success dark:text-success" />
              {tAdmin('roles.auditedChanges', { default: 'Audited changes' })}
            </span>
          }
        />
        <div>
          <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
            <div className="hidden border-b border-border bg-muted/40 px-6 py-2.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground md:flex md:items-center md:justify-between">
              <span className="flex-1">{tAdmin('roles.roleColumn', { default: 'Role' })}</span>
              <span className="w-[260px] text-right">
                {tAdmin('roles.permissionsMembers', { default: 'Permissions · Members' })}
              </span>
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
                      <Skeleton className="h-12 w-12 rounded-xl" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-36 rounded" />
                        <Skeleton className="h-3 w-52 rounded" />
                      </div>
                    </div>
                    <Skeleton className="h-7 w-24 rounded-md" />
                  </div>
                ))}
              {!loading && roles && roles.length === 0 && (
                <div className="px-6 py-20 text-center">
                  {' '}
                  <p className="font-sans text-base font-medium text-foreground">
                    {tAdmin('roles.noCustomRoles', { default: 'No custom roles yet' })}
                  </p>{' '}
                  <p className="mt-1 font-sans text-sm text-muted-foreground">
                    {tAdmin('roles.noCustomRolesHint', {
                      default: 'Create a role to grant a tailored set of permissions.',
                    })}
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
                          <Shield className="size-5" />{' '}
                        </span>{' '}
                        <div className="min-w-0">
                          {' '}
                          <div className="flex items-center gap-2">
                            {' '}
                            <p className="truncate font-sans text-[17px] font-semibold text-foreground">
                              {r.name}
                            </p>{' '}
                            {r.isSystem && (
                              <span className="rounded-md border border-primary/25 bg-primary/5 px-2 py-0.5 font-sans text-2xs font-semibold uppercase tracking-wide text-primary ">
                                {' '}
                                {tAdmin('role.system', { default: 'System' })}{' '}
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
                        <span>
                          {tAdmin('drawer.permissionsCount', {
                            count: r.permissionCount ?? 0,
                            default: '{count, plural, one {# permission} other {# permissions}}',
                          })}
                        </span>{' '}
                        <span>
                          {tAdmin('roles.membersCount', {
                            count: r.userCount ?? 0,
                            default: '{count, plural, one {# member} other {# members}}',
                          })}
                        </span>{' '}
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
  const tAdmin = useTranslations('admin');
  const tCommon = useTranslations('common');
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
      toast({ type: 'err', title: tAdmin('roles.nameRequired', { default: 'Name required' }) });
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
          const m =
            (await res.json().catch(() => ({})))?.message ??
            tAdmin('roles.createFailed', { default: 'Failed to create role' });
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
          const m =
            (await res.json().catch(() => ({})))?.message ??
            tAdmin('roles.updateFailed', { default: 'Failed to update role' });
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
        const m =
          (await pRes.json().catch(() => ({})))?.message ??
          tAdmin('roles.savePermissionsFailed', { default: 'Failed to save permissions' });
        throw new Error(m);
      }
      toast({
        type: 'ok',
        title:
          mode === 'create'
            ? tAdmin('roles.roleCreated', { default: 'Role created' })
            : tAdmin('roles.roleUpdated', { default: 'Role updated' }),
      });
      onSaved();
    } catch (e: any) {
      toast({
        type: 'err',
        title: tAdmin('roles.saveFailed', { default: 'Save failed' }),
        description: e?.message,
      });
    } finally {
      setBusy(false);
    }
  };
  const del = async () => {
    if (!role) return;
    if (
      !confirm(
        tAdmin('roles.deleteConfirm', {
          name: role.name,
          default: 'Delete the role “{name}”? This cannot be undone.',
        }),
      )
    )
      return;
    setBusy(true);
    try {
      const res = await fetch(`/api/proxy/admin/roles/${role.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const m =
          (await res.json().catch(() => ({})))?.message ??
          tAdmin('roles.deleteFailed', { default: 'Failed to delete' });
        throw new Error(m);
      }
      toast({ type: 'ok', title: tAdmin('roles.roleDeleted', { default: 'Role deleted' }) });
      onDeleted?.();
    } catch (e: any) {
      toast({
        type: 'err',
        title: tAdmin('roles.deleteFailedToast', { default: 'Delete failed' }),
        description: e?.message,
      });
    } finally {
      setBusy(false);
    }
  };
  const totalSelected = selected.length;
  const modalTitle =
    mode === 'create'
      ? tAdmin('roles.newRole', { default: 'New role' })
      : (role?.name ?? tAdmin('roles.role', { default: 'Role' }));
  return (
    <Modal
      onClose={onClose}
      width="max-w-[560px]"
      title={modalTitle}
      header={
        <ModalHeader
          loading={false}
          initials="R"
          gradient="bg-foreground text-background"
          title={modalTitle}
          subtitle={
            mode === 'create'
              ? tAdmin('roles.defineCustomRole', { default: 'Define a custom role' })
              : role?.isSystem
                ? tAdmin('roles.systemRole', { default: 'System role' })
                : tAdmin('roles.customRole', { default: 'Custom role' })
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
              {tAdmin('roles.nameLabel', { default: 'Name' })}
            </label>{' '}
            <input
              value={name}
              disabled={mode === 'edit' && role?.isSystem}
              onChange={(e) => {
                setDirty(true);
                setName(e.target.value);
              }}
              placeholder={tAdmin('roles.namePlaceholder', { default: 'e.g. Content Editor' })}
              className={cn(
                GLASS_SUB,
                'w-full rounded-lg px-3 py-2.5 font-sans text-sm text-foreground outline-none transition focus:ring-2 focus:ring-accent/30',
              )}
            />{' '}
          </div>{' '}
          <div>
            {' '}
            <label className="mb-1.5 block font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {tAdmin('roles.descriptionLabel', { default: 'Description' })}
            </label>{' '}
            <input
              value={description}
              disabled={mode === 'edit' && role?.isSystem}
              onChange={(e) => {
                setDirty(true);
                setDescription(e.target.value);
              }}
              placeholder={tAdmin('roles.descriptionPlaceholder', {
                default: 'Short description of this role',
              })}
              className={cn(
                GLASS_SUB,
                'w-full rounded-lg px-3 py-2.5 font-sans text-sm text-foreground outline-none transition focus:ring-2 focus:ring-accent/30',
              )}
            />{' '}
          </div>{' '}
          {mode === 'edit' && role?.isSystem && (
            <p className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 font-sans text-xs text-primary ">
              {' '}
              {tAdmin('roles.systemRoleLocked', {
                default:
                  'System roles cannot be renamed but a super admin may adjust their permissions.',
              })}{' '}
            </p>
          )}{' '}
        </section>{' '}
        <section>
          {' '}
          <div className="mb-3 flex items-center justify-between gap-3">
            {' '}
            <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {' '}
              {tAdmin('drawer.permissionsLabel', { default: 'Permissions' })}{' '}
              {totalSelected > 0 && (
                <span className="text-accent">
                  {tAdmin('roles.selectedCount', {
                    count: totalSelected,
                    default: '· {count} selected',
                  })}
                </span>
              )}{' '}
            </h3>{' '}
            <div className="relative w-48">
              {' '}
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />{' '}
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tAdmin('roles.filterPermissions', { default: 'Filter permissions' })}
                className={cn(
                  GLASS_SUB,
                  'w-full rounded-lg py-2 ps-9 pe-3 font-sans text-sm text-foreground outline-none transition focus:ring-2 focus:ring-accent/30',
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
                {tAdmin('roles.loadingPermissions', { default: 'Loading permissions…' })}
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
                        {allOn
                          ? tCommon('clear')
                          : tAdmin('roles.selectAll', { default: 'Select all' })}{' '}
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
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:bg-muted/50',
                            )}
                          >
                            {' '}
                              <span
                                className={cn(
                                  'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-md border transition',
                                  on
                                    ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                                    : 'border-border bg-background',
                                )}
                              >
                              {' '}
                              {on && <Check className="size-3.5" />}{' '}
                            </span>{' '}
                            <span className="min-w-0">
                              {' '}
                              <span className="block font-sans text-sm font-medium text-foreground">
                                {p.label}
                              </span>{' '}
                              <span className="block truncate font-mono text-2xs text-muted-foreground">
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
                {tAdmin('roles.noPermissionsMatch', {
                  search,
                  default: 'No permissions match “{search}”',
                })}
              </p>
            )}{' '}
          </div>{' '}
        </section>{' '}
        <div className="sticky bottom-0 -mx-6 flex items-center justify-between gap-3 border-t border-border bg-card px-6 py-4">
          {' '}
          <div>
            {' '}
            {mode === 'edit' && role && !role.isSystem && (
              <button
                type="button"
                onClick={del}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-lg border border-destructive/70 px-3 py-2 font-sans text-sm font-medium text-destructive transition hover:bg-destructive/70 disabled:opacity-40 dark:border-red-900/40 dark:text-destructive dark:hover:bg-red-950/30"
              >
                {' '}
                <Trash2 className="size-4" /> {tCommon('delete')}{' '}
              </button>
            )}{' '}
          </div>{' '}
          <div className="flex items-center gap-3">
            {' '}
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 font-sans text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              {tCommon('cancel')}
            </button>{' '}
            <button
              onClick={save}
              disabled={busy || (!dirty && mode === 'edit')}
              className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2 font-sans text-sm font-medium text-accent-foreground transition hover:bg-primary disabled:opacity-40"
            >
              {' '}
              {busy && <Loader2 className="size-4 animate-spin" />}{' '}
              {mode === 'create'
                ? tAdmin('roles.createRole', { default: 'Create role' })
                : tAdmin('saveChanges')}{' '}
            </button>{' '}
          </div>{' '}
        </div>{' '}
      </div>{' '}
    </Modal>
  );
}
