import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { DrizzleService } from '../src/database/drizzle.service';
import { notifications, tenants, users } from '../src/database/schema';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { WsGateway } from '../src/modules/ws/ws.gateway';

/**
 * A super admin holds two notification streams: their own account activity and
 * the cross-tenant platform feed. They are the same person, which is exactly
 * why the split has to be enforced in the personal service — the tenant filter
 * alone is not enough, because a platform alert caused by the reader's *own*
 * tenant satisfies it.
 *
 * These assertions deliberately call the personal service without a tenant id,
 * which is what internal callers such as `findByUser` do.
 */
describe('personal feed excludes platform alerts (integration)', () => {
  let drizzle: DrizzleService;
  let personal: NotificationsService;

  const suffix = `palerts-iso-${Date.now()}`;
  let tenantId: string;
  let superId: string;

  beforeAll(async () => {
    drizzle = new DrizzleService({ get: (k: string) => process.env[k] } as never);
    await drizzle.onModuleInit();
    personal = new NotificationsService(drizzle, new WsGateway() as never);

    const [t] = await drizzle.db
      .insert(tenants)
      .values({ name: `ISO ${suffix}`, slug: `${suffix}` })
      .returning();
    tenantId = t.id;
    const [u] = await drizzle.db
      .insert(users)
      .values({
        tenantId,
        email: `${suffix}@example.com`,
        name: 'Iso Super',
        passwordHash: 'x',
        // A plain admin, deliberately. The personal service filters on
        // audience and never looks at role, so the property under test holds
        // for any user; keeping this fixture out of the `super_admin` set stops
        // this spec from receiving the platform alerts that
        // `platform-alerts.spec.ts` broadcasts in parallel.
        role: 'admin',
      })
      .returning();
    superId = u.id;

    // A personal row, in the reader's own tenant.
    await drizzle.db.insert(notifications).values({
      tenantId,
      userId: superId,
      audience: 'personal',
      type: 'comment',
      category: 'social',
      title: 'Personal comment',
    });

    // A platform alert caused by that same tenant: the case a tenant-only
    // filter would wrongly let through.
    await drizzle.db.insert(notifications).values({
      tenantId,
      userId: superId,
      audience: 'platform',
      type: 'iso_test',
      category: 'platform',
      title: 'Platform alert in my own tenant',
      data: { group: 'payments', severity: 'critical' },
    });
  });

  afterAll(async () => {
    await drizzle.db.delete(notifications).where(eq(notifications.userId, superId));
    await drizzle.db.delete(users).where(eq(users.id, superId));
    await drizzle.db.delete(tenants).where(eq(tenants.id, tenantId));
    await drizzle.onModuleDestroy();
  });

  it('both rows exist in the table', async () => {
    const all = await drizzle.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, superId));
    expect(all).toHaveLength(2);
  });

  it('list() returns only the personal row, with and without a tenant filter', async () => {
    const unscoped = await personal.list(superId);
    expect(unscoped.items).toHaveLength(1);
    expect(unscoped.items[0]!.title).toBe('Personal comment');

    const scoped = await personal.list(superId, { tenantId });
    expect(scoped.items).toHaveLength(1);
    expect(scoped.items[0]!.title).toBe('Personal comment');
  });

  it('findByUser() returns only the personal row', async () => {
    const items = await personal.findByUser(superId);
    expect(items).toHaveLength(1);
    expect(items[0]!.title).toBe('Personal comment');
  });

  it('unreadCount() counts only the personal row', async () => {
    expect(await personal.unreadCount(superId)).toBe(1);
    expect(await personal.unreadCount(superId, tenantId)).toBe(1);
  });

  it('markAllRead() leaves the platform alert unread', async () => {
    const result = await personal.markAllRead(superId, tenantId);
    expect(result.updated).toBe(1);

    const platformRow = await drizzle.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, superId), eq(notifications.audience, 'platform')));
    // The personal "mark all read" must not silently clear the platform feed.
    expect(platformRow[0]!.isRead).toBe(false);
  });

  it('markRead() refuses to touch a platform alert', async () => {
    const [platformRow] = await drizzle.db
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.userId, superId), eq(notifications.audience, 'platform')));
    await expect(personal.markRead(superId, platformRow!.id, tenantId)).rejects.toThrow(
      /not found/i,
    );
  });
});
