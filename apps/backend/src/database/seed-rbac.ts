import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, inArray } from 'drizzle-orm';
import * as schema from './schema';
import {
  PERMISSION_CATALOG,
  SYSTEM_ROLE_KEYS,
  SYSTEM_ROLE_PERMISSIONS,
} from '../modules/rbac/rbac.constants';

async function seedRbac(db: any) {
  console.log('Seeding RBAC permissions + system roles...');

  for (const p of PERMISSION_CATALOG) {
    await db
      .insert(schema.permissions)
      .values({
        key: p.key,
        group: p.group,
        label: p.label,
        description: p.description ?? null,
      })
      .onConflictDoNothing({ target: [schema.permissions.key] });
  }
  console.log('Upserted permission catalog');

  const tenants = await db
    .select({ id: schema.tenants.id, slug: schema.tenants.slug })
    .from(schema.tenants);
  const tenantIds = tenants.map((t: any) => t.id);

  for (const tenantId of tenantIds) {
    const roleKeyToId = new Map<string, string>();
    for (const key of SYSTEM_ROLE_KEYS) {
      const [role] = await db
        .insert(schema.roles)
        .values({
          tenantId,
          key,
          name: key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
          description: `${key} system role`,
          isSystem: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoNothing({ target: [schema.roles.tenantId, schema.roles.key] })
        .returning({ id: schema.roles.id });

      const roleId =
        role?.id ||
        (
          await db
            .select({ id: schema.roles.id })
            .from(schema.roles)
            .where(eq(schema.roles.key, key))
            .limit(1)
        )[0]?.id;
      if (roleId) roleKeyToId.set(key, roleId);

      const permKeys = SYSTEM_ROLE_PERMISSIONS[key] ?? [];
      if (roleId && permKeys.length) {
        const permRows = await db
          .select({ id: schema.permissions.id })
          .from(schema.permissions)
          .where(inArray(schema.permissions.key, permKeys));
        await db
          .delete(schema.rolePermissions)
          .where(eq(schema.rolePermissions.roleId, roleId));
        if (permRows.length) {
          await db.insert(schema.rolePermissions).values(
            permRows.map((pr: { id: string }) => ({ roleId, permissionId: pr.id })),
          );
        }
      }
    }

    const users = await db
      .select({ id: schema.users.id, tenantId: schema.users.tenantId, role: schema.users.role })
      .from(schema.users)
      .where(eq(schema.users.tenantId, tenantId));

    for (const u of users) {
      const roleId = roleKeyToId.get(u.role);
      if (roleId) {
        await db
          .insert(schema.userRoles)
          .values({ userId: u.id, tenantId, roleId, assignedBy: null })
          .onConflictDoNothing({
            target: [schema.userRoles.userId, schema.userRoles.tenantId, schema.userRoles.roleId],
          });
      }
    }
    console.log(`Seeded RBAC for tenant ${tenantId} (${users.length} users)`);
  }
  console.log('RBAC seed complete!');
}

async function main() {
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client, { schema });
  try {
    await seedRbac(db);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('RBAC seed failed:', err);
  process.exit(1);
});
