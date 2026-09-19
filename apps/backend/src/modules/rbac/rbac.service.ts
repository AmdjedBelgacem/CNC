import { Injectable, ForbiddenException, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { roles, permissions, rolePermissions, userRoles } from '../../database/schema/rbac';
import { users } from '../../database/schema/users';
import { auditLogs } from '../../database/schema/auth';
import { eq, and, inArray, sql } from 'drizzle-orm';
import {
  SUPER_ADMIN_KEY,
  PROTECTED_ROLE_KEYS,
  ROLE_PRIVILEGE,
  SYSTEM_ROLE_PERMISSIONS,
  PERMISSION_CATALOG,
} from './rbac.constants';

@Injectable()
export class RbacService {
  constructor(private drizzle: DrizzleService) {}

  // ---- Permission resolution -------------------------------------------------

  /** Resolve effective permissions for a user in a tenant. */
  async resolvePermissions(userId: string, role: string, tenantId: string): Promise<string[]> {
    if (role === SUPER_ADMIN_KEY) return ['*'];
    const assignments = await this.drizzle.db
      .select({ roleId: userRoles.roleId })
      .from(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.tenantId, tenantId)));
    const roleIds = assignments.map((a) => a.roleId);
    const keys = await this.permissionsForRoles(roleIds, tenantId);
    if (keys.length > 0) return keys;
    // Transition fallback: legacy fixed-role permissions.
    return SYSTEM_ROLE_PERMISSIONS[role] ?? [];
  }

  private async permissionsForRoles(roleIds: string[], tenantId: string): Promise<string[]> {
    if (roleIds.length === 0) return [];
    const rows = await this.drizzle.db
      .selectDistinct({ key: permissions.key })
      .from(rolePermissions)
      .innerJoin(roles, eq(rolePermissions.roleId, roles.id))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(and(eq(roles.tenantId, tenantId), inArray(rolePermissions.roleId, roleIds)));
    return rows.map((r) => r.key);
  }

  // ---- Catalog -----------------------------------------------------------------

  async listPermissions(): Promise<{ group: string; label: string; permissions: { key: string; label: string; description?: string; resource: string }[] }[]> {
    const rows = await this.drizzle.db.select().from(permissions).orderBy(permissions.group, permissions.key);
    const catalog = rows.length ? rows : PERMISSION_CATALOG;
    const map = new Map<string, { key: string; label: string; description?: string; resource: string }[]>();
    for (const p of catalog as { group: string; key: string; label: string | null; description: string | null }[]) {
      if (!map.has(p.group)) map.set(p.group, []);
      map.get(p.group)!.push({ key: p.key, label: p.label ?? p.key, description: p.description ?? undefined, resource: p.group });
    }
    return Array.from(map.entries()).map(([group, permissions]) => ({
      group,
      label: group.charAt(0).toUpperCase() + group.slice(1),
      permissions,
    }));
  }

  // ---- Roles -------------------------------------------------------------------

  async listRoles(tenantId: string) {
    const rows = await this.drizzle.db.query.roles.findMany({
      where: eq(roles.tenantId, tenantId),
      orderBy: (r: any, { asc }: any) => [asc(r.isSystem), asc(r.name)],
    });
    return Promise.all(
      rows.map(async (r: typeof roles.$inferSelect) => {
        const [perm] = await this.drizzle.db
          .select({ c: sql<number>`count(*)` })
          .from(rolePermissions)
          .where(eq(rolePermissions.roleId, r.id));
        const [usr] = await this.drizzle.db
          .select({ c: sql<number>`count(*)` })
          .from(userRoles)
          .where(eq(userRoles.roleId, r.id));
        return {
          ...r,
          permissionCount: Number(perm?.c ?? 0),
          userCount: Number(usr?.c ?? 0),
        };
      }),
    );
  }

  async getRole(tenantId: string, roleId: string) {
    const role = await this.drizzle.db.query.roles.findFirst({
      where: and(eq(roles.id, roleId), eq(roles.tenantId, tenantId)),
    });
    if (!role) throw new NotFoundException('Role not found');
    const perms = await this.permissionsForRoles([role.id], tenantId);
    return { ...role, permissions: perms };
  }

  async createRole(
    actor: { id: string },
    tenantId: string,
    body: { name: string; description?: string; key?: string },
  ) {
    const roleKey = (body.key || this.slugify(body.name)).toLowerCase();
    if (PROTECTED_ROLE_KEYS.includes(roleKey)) throw new BadRequestException('Reserved role key');
    const existing = await this.drizzle.db.query.roles.findFirst({
      where: and(eq(roles.tenantId, tenantId), eq(roles.key, roleKey)),
    });
    if (existing) throw new ConflictException('A role with this key already exists in this tenant');
    const [row] = await this.drizzle.db
      .insert(roles)
      .values({
        tenantId,
        key: roleKey,
        name: body.name,
        description: body.description ?? null,
        isSystem: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    await this.audit(actor.id, 'role.create', 'role', row!.id, { key: roleKey, name: body.name }, tenantId);
    return row;
  }

  async updateRole(
    actor: { id: string },
    tenantId: string,
    roleId: string,
    body: { name?: string; description?: string },
  ) {
    const role = await this.requireRole(tenantId, roleId);
    if (role.isSystem) throw new ForbiddenException('System roles cannot be edited');
    const [row] = await this.drizzle.db
      .update(roles)
      .set({ name: body.name ?? role.name, description: body.description ?? role.description, updatedAt: new Date() })
      .where(eq(roles.id, roleId))
      .returning();
    await this.audit(actor.id, 'role.update', 'role', roleId, { name: body.name, description: body.description }, tenantId);
    return row;
  }

  async deleteRole(actor: { id: string }, tenantId: string, roleId: string) {
    const role = await this.requireRole(tenantId, roleId);
    if (role.isSystem) throw new ForbiddenException('System roles cannot be deleted');
    await this.drizzle.db
      .delete(userRoles)
      .where(and(eq(userRoles.roleId, roleId), eq(userRoles.tenantId, tenantId)));
    await this.drizzle.db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
    await this.drizzle.db.delete(roles).where(eq(roles.id, roleId));
    await this.audit(actor.id, 'role.delete', 'role', roleId, { key: role.key, name: role.name }, tenantId);
    return { message: 'Role deleted' };
  }

  async setRolePermissions(
    actor: { id: string; role: string; permissions?: string[] },
    tenantId: string,
    roleId: string,
    permissionKeys: string[],
  ) {
    const role = await this.requireRole(tenantId, roleId);
    if (role.key === SUPER_ADMIN_KEY) throw new ForbiddenException('The super_admin role cannot be modified');
    if (role.isSystem && actor.role !== SUPER_ADMIN_KEY) {
      throw new ForbiddenException('Only super_admin can modify system role permissions');
    }
    if (!this.canGrant(actor.permissions ?? [], permissionKeys)) {
      throw new ForbiddenException('You cannot grant permissions you do not have');
    }
    const permRows = await this.drizzle.db
      .select()
      .from(permissions)
      .where(inArray(permissions.key, permissionKeys));
    const known = new Set(permRows.map((p) => p.key));
    const unknown = permissionKeys.filter((k) => !known.has(k));
    if (unknown.length) throw new BadRequestException(`Unknown permission(s): ${unknown.join(', ')}`);

    const before = await this.permissionsForRoles([roleId], tenantId);
    await this.drizzle.db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
    if (permRows.length) {
      await this.drizzle.db
        .insert(rolePermissions)
        .values(permRows.map((p) => ({ roleId, permissionId: p.id })));
    }
    await this.drizzle.db.update(roles).set({ updatedAt: new Date() }).where(eq(roles.id, roleId));
    await this.audit(actor.id, 'role.permissions.update', 'role', roleId, { before, after: permissionKeys }, tenantId);
    return { permissions: permissionKeys };
  }

  // ---- User role assignment ----------------------------------------------------

  async getUserRoles(tenantId: string, userId: string) {
    const assignments = await this.drizzle.db
      .select({ roleId: userRoles.roleId })
      .from(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.tenantId, tenantId)));
    if (assignments.length === 0) return [];
    const roleRows = await this.drizzle.db
      .select()
      .from(roles)
      .where(and(eq(roles.tenantId, tenantId), inArray(roles.id, assignments.map((a) => a.roleId))));
    return roleRows.map((r) => ({ id: r.id, key: r.key, name: r.name, isSystem: r.isSystem, description: r.description }));
  }

  async setUserRoles(
    actor: { id: string; role: string; permissions?: string[] },
    tenantId: string,
    userId: string,
    roleIds: string[],
  ) {
    const target = await this.drizzle.db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!target) throw new NotFoundException('User not found');

    const targetIsSuper =
      target.role === SUPER_ADMIN_KEY || (await this.hasRole(userId, tenantId, SUPER_ADMIN_KEY));
    if (targetIsSuper && actor.role !== SUPER_ADMIN_KEY) {
      throw new ForbiddenException('You cannot modify a super_admin user');
    }

    const roleRows = await this.drizzle.db
      .select()
      .from(roles)
      .where(and(eq(roles.tenantId, tenantId), inArray(roles.id, roleIds)));
    if (roleRows.length !== roleIds.length) throw new BadRequestException('One or more roles are invalid');
    if (roleRows.some((r) => r.key === SUPER_ADMIN_KEY)) {
      throw new ForbiddenException('You cannot assign the super_admin role');
    }

    const requested = await this.permissionsForRoles(roleIds, tenantId);
    if (!this.canGrant(actor.permissions ?? [], requested)) {
      throw new ForbiddenException('You cannot assign permissions you do not have');
    }

    await this.drizzle.db
      .delete(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.tenantId, tenantId)));
    if (roleRows.length) {
      await this.drizzle.db
        .insert(userRoles)
        .values(roleRows.map((r) => ({ userId, tenantId, roleId: r.id, assignedBy: actor.id })));
    }

    // Keep the legacy users.role column in sync (backward compat with @Roles checks).
    const coarse = this.pickCoarseRole(roleRows);
    if (coarse) {
      await this.drizzle.db.update(users).set({ role: coarse, updatedAt: new Date() }).where(eq(users.id, userId));
    }

    await this.audit(actor.id, 'user.roles.update', 'user', userId, {
      roleIds,
      keys: roleRows.map((r) => r.key),
      primaryRole: coarse ?? target.role,
    }, tenantId);

    return {
      roles: roleRows.map((r) => ({ id: r.id, key: r.key, name: r.name, isSystem: r.isSystem })),
      primaryRole: coarse ?? target.role,
    };
  }

  // ---- Helpers -----------------------------------------------------------------

  private async requireRole(tenantId: string, roleId: string) {
    const role = await this.drizzle.db.query.roles.findFirst({
      where: and(eq(roles.id, roleId), eq(roles.tenantId, tenantId)),
    });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  private async hasRole(userId: string, tenantId: string, key: string): Promise<boolean> {
    const rows = await this.drizzle.db
      .select({ id: roles.id })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(and(eq(userRoles.userId, userId), eq(userRoles.tenantId, tenantId), eq(roles.key, key)))
      .limit(1);
    return rows.length > 0;
  }

  private canGrant(actorPerms: string[], requested: string[]): boolean {
    if (actorPerms.includes('*')) return true;
    return requested.every((p) => actorPerms.includes(p));
  }

  /** Pick the legacy coarse role to store on users.role: highest-privilege assigned system role. */
  private pickCoarseRole(roleRows: { key: string }[]): string | null {
    let best: string | null = null;
    let bestP = -1;
    for (const r of roleRows) {
      const p = ROLE_PRIVILEGE[r.key] ?? 0;
      if (p > bestP) {
        bestP = p;
        best = r.key;
      }
    }
    return best;
  }

  private slugify(s: string): string {
    return (
      s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 80) || 'role'
    );
  }

  private async audit(
    userId: string | undefined,
    action: string,
    entityType: string,
    entityId: string,
    details: Record<string, unknown>,
    tenantId?: string,
  ) {
    await this.drizzle.db.insert(auditLogs).values({
      userId: userId || null,
      action,
      entityType,
      entityId: entityId || null,
      details,
      tenantId: tenantId || null,
      createdAt: new Date(),
    });
  }
}
