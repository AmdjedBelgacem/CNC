import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { DrizzleService } from '../src/database/drizzle.service';
import { notifications, platformNotificationPrefs, tenants, users } from '../src/database/schema';
import { PlatformAlertsService } from '../src/modules/notifications/platform-alerts.service';
import {
  PLATFORM_ALERT_GROUPS,
  defaultPlatformPrefs,
  mergePlatformPrefs,
} from '../src/modules/notifications/platform-alert-groups';

/**
 * Platform-critical alerts for super admins.
 *
 * The failure this guards against is a leak in either direction: platform
 * signals bleeding into a user's personal feed, or a super admin's personal
 * activity showing up in the cross-tenant operational feed. Both would be
 * silent — the rows share one table and one shape.
 *
 * Recipients are every row in `users` holding `super_admin`, so this suite
 * asserts per-recipient rather than by total count: the local database has a
 * seeded super admin who is not a fixture here.
 */

describe('platform alert group registry', () => {
  it('exposes a coherent taxonomy', () => {
    expect(PLATFORM_ALERT_GROUPS.length).toBeGreaterThanOrEqual(5);
    const keys = PLATFORM_ALERT_GROUPS.map((g) => g.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const g of PLATFORM_ALERT_GROUPS) {
      expect(['critical', 'warning', 'info']).toContain(g.severity);
      expect(g.label.length).toBeGreaterThan(0);
      expect(g.description.length).toBeGreaterThan(0);
    }
    // Money and security are the ones an operator must not miss.
    expect(defaultPlatformPrefs().payments).toBe(true);
    expect(defaultPlatformPrefs().security).toBe(true);
  });

  it('fills missing groups from defaults and drops unknown keys', () => {
    const merged = mergePlatformPrefs({ payments: false, bogusGroup: true, tenants: 'yes' });
    expect(merged.payments).toBe(false);
    // In the registry but absent from storage -> default applies.
    expect(merged.security).toBe(true);
    // Unknown key is discarded rather than surfacing in the settings UI.
    expect(merged).not.toHaveProperty('bogusGroup');
    // Wrong type is ignored, not coerced.
    expect(merged.tenants).toBe(true);
  });
});

describe('platform alerts (integration)', () => {
  let drizzle: DrizzleService;
  let alerts: PlatformAlertsService;

  const suffix = `palerts-${Date.now()}`;
  let homeTenant: string;
  let otherTenant: string;
  let superId: string;
  let super2Id: string;
  let adminId: string;

  const asSuper = (id: string) => ({ id, role: 'super_admin' });

  /** Platform-audience rows for one user, bypassing the service on purpose. */
  const platformRows = (userId: string) =>
    drizzle.db
      .select({ id: notifications.id, type: notifications.type })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.audience, 'platform')));

  const allRows = (userId: string) =>
    drizzle.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId));

  beforeAll(async () => {
    drizzle = new DrizzleService({ get: (k: string) => process.env[k] } as never);
    await drizzle.onModuleInit();
    // `audit` is @Optional, so the service must be constructible without it.
    alerts = new PlatformAlertsService(drizzle);

    const [t1] = await drizzle.db
      .insert(tenants)
      .values({ name: `PA home ${suffix}`, slug: `${suffix}-home` })
      .returning();
    homeTenant = t1.id;
    const [t2] = await drizzle.db
      .insert(tenants)
      .values({ name: `PA other ${suffix}`, slug: `${suffix}-other` })
      .returning();
    otherTenant = t2.id;

    // A super admin lives in one tenant like any other user.
    const [su] = await drizzle.db
      .insert(users)
      .values({
        tenantId: homeTenant,
        email: `${suffix}-super@example.com`,
        name: 'Super One',
        passwordHash: 'x',
        role: 'super_admin',
      })
      .returning();
    superId = su.id;
    const [su2] = await drizzle.db
      .insert(users)
      .values({
        tenantId: homeTenant,
        email: `${suffix}-super2@example.com`,
        name: 'Super Two',
        passwordHash: 'x',
        role: 'super_admin',
      })
      .returning();
    super2Id = su2.id;
    const [ad] = await drizzle.db
      .insert(users)
      .values({
        tenantId: homeTenant,
        email: `${suffix}-admin@example.com`,
        name: 'Plain Admin',
        passwordHash: 'x',
        role: 'admin',
      })
      .returning();
    adminId = ad.id;
  });

  afterAll(async () => {
    for (const id of [superId, super2Id, adminId]) {
      await drizzle.db.delete(notifications).where(eq(notifications.userId, id));
      await drizzle.db
        .delete(platformNotificationPrefs)
        .where(eq(platformNotificationPrefs.userId, id));
      await drizzle.db.delete(users).where(eq(users.id, id));
    }
    await drizzle.db.delete(tenants).where(eq(tenants.id, homeTenant));
    await drizzle.db.delete(tenants).where(eq(tenants.id, otherTenant));
    await drizzle.onModuleDestroy();
  });

  it('starts every super admin from the registry defaults', async () => {
    expect(await alerts.getPrefs(superId)).toEqual(defaultPlatformPrefs());
  });

  it('delivers a cross-tenant alert to every super admin', async () => {
    await alerts.emit({
      group: 'payments',
      type: 'payment_amount_mismatch',
      title: 'Amount mismatch on order X',
      body: 'Charged 10 but expected 100.',
      // Caused in the *other* tenant, which is the whole point of the feed.
      tenantId: otherTenant,
      entityType: 'order',
      entityId: 'order-1',
      data: { charged: 10, expected: 100 },
    });

    for (const id of [superId, super2Id]) {
      const feed = await alerts.list(asSuper(id));
      const matches = feed.items.filter((a) => a.type === 'payment_amount_mismatch');
      expect(matches).toHaveLength(1);
      const alert = matches[0]!;
      expect(alert.audience).toBe('platform');
      expect(alert.group).toBe('payments');
      expect(alert.severity).toBe('critical');
      expect(alert.isRead).toBe(false);
      // Cross-tenant context is preserved even though the recipient is not in
      // that tenant, so the operator knows where to look.
      expect(alert.tenantName).toContain('PA other');
      expect(alert.tenantSlug).toBe(`${suffix}-other`);
      expect(alert.data).toMatchObject({ charged: 10, expected: 100 });
    }
  });

  it('never delivers a platform alert to a non-super-admin', async () => {
    await alerts.emit({
      group: 'security',
      type: 'test_only',
      title: 'must not reach a plain admin',
      tenantId: otherTenant,
      entityId: 'admin-check',
    });
    expect(await platformRows(adminId)).toHaveLength(0);
  });

  it('does not leak platform alerts into the personal feed', async () => {
    expect((await allRows(superId)).every((n) => n.audience === 'platform')).toBe(true);

    // A personal notification is never surfaced as a platform alert.
    await drizzle.db.insert(notifications).values({
      tenantId: homeTenant,
      userId: superId,
      audience: 'personal',
      type: 'comment',
      category: 'social',
      title: 'Someone replied to you',
    });
    const feed = await alerts.list(asSuper(superId));
    expect(feed.items.some((a) => a.title === 'Someone replied to you')).toBe(false);
    expect(feed.items.every((a) => a.audience === 'platform')).toBe(true);
  });

  it('honours a muted group for that super admin only', async () => {
    await alerts.updatePrefs(asSuper(superId), { payments: false });
    expect((await alerts.getPrefs(superId)).payments).toBe(false);
    // Preferences are per person, not per role.
    expect((await alerts.getPrefs(super2Id)).payments).toBe(true);

    await alerts.emit({
      group: 'payments',
      type: 'payment_failed',
      title: 'Another payment failed',
      tenantId: otherTenant,
      entityId: 'order-2',
    });

    expect((await platformRows(superId)).map((r) => r.type)).not.toContain('payment_failed');
    expect((await platformRows(super2Id)).map((r) => r.type)).toContain('payment_failed');
  });

  it('rejects an unknown group instead of storing it', async () => {
    await expect(
      alerts.updatePrefs(asSuper(superId), { notAGroup: true } as never),
    ).rejects.toThrow(/Unknown alert group/i);
    expect(await alerts.getPrefs(superId)).not.toHaveProperty('notAGroup');
  });

  it('refuses a non-super-admin', async () => {
    const asAdmin = { id: adminId, role: 'admin' };
    await expect(alerts.list(asAdmin)).rejects.toThrow(/super admin/i);
    await expect(alerts.overview(asAdmin)).rejects.toThrow(/super admin/i);
    await expect(alerts.settings(asAdmin)).rejects.toThrow(/super admin/i);
    await expect(alerts.updatePrefs(asAdmin, { payments: false })).rejects.toThrow(/super admin/i);
    await expect(alerts.markRead(asAdmin, 'any')).rejects.toThrow(/super admin/i);
    await expect(alerts.markAllRead(asAdmin)).rejects.toThrow(/super admin/i);
  });

  it('will not let one super admin read another\'s alert', async () => {
    const theirs = await alerts.list(asSuper(super2Id));
    const theirId = theirs.items[0]!.id;
    await expect(alerts.markRead(asSuper(superId), theirId)).rejects.toThrow(/not found/i);
    // Still unread for its actual recipient.
    const stillUnread = await alerts.list(asSuper(super2Id), { unreadOnly: true });
    expect(stillUnread.items.some((a) => a.id === theirId)).toBe(true);
  });

  it('deduplicates repeats of the same underlying problem', async () => {
    const input = {
      group: 'system',
      type: 'payment_webhook_unhandled',
      title: 'Unhandled webhook',
      tenantId: otherTenant,
      entityId: 'evt-1',
    };
    // Count rows carrying this spec's unique event type. Only this file emits
    // it, so the count is not affected by a spec running in parallel.
    const withType = async (userId: string) =>
      (await platformRows(userId)).filter((r) => r.type === input.type).length;
    const before = await withType(super2Id);
    await alerts.emit(input);
    expect(await withType(super2Id)).toBe(before + 1);
    // A provider retrying must not become a second identical alert for anyone.
    expect(await alerts.emit(input)).toBe(0);
    expect(await withType(super2Id)).toBe(before + 1);
  });

  it('ignores an unknown group at emit time rather than storing it', async () => {
    const before = (await platformRows(superId)).length;
    expect(
      await alerts.emit({
        group: 'not-a-group',
        type: 'x',
        title: 'should not exist',
        tenantId: otherTenant,
      }),
    ).toBe(0);
    expect((await platformRows(superId)).length).toBe(before);
  });

  it('reports consistent counts for the overview strip', async () => {
    const overview = await alerts.overview(asSuper(super2Id));
    expect(overview.unread).toBeGreaterThan(0);
    expect(overview.severity.critical).toBeGreaterThan(0);
    expect(overview.byGroup.payments).toBeGreaterThan(0);
    // Unread is the sum of its per-severity breakdown, not a separate count.
    const sum = Object.values(overview.unreadBySeverity).reduce((a, b) => a + b, 0);
    expect(sum).toBe(overview.unread);
    expect(overview.unread).toBeLessThanOrEqual(overview.total);
  });

  it('filters by severity and group', async () => {
    const critical = await alerts.list(asSuper(superId), { severity: 'critical' });
    expect(critical.items.length).toBeGreaterThan(0);
    expect(critical.items.every((a) => a.severity === 'critical')).toBe(true);
    const byGroup = await alerts.list(asSuper(super2Id), { group: 'system' });
    expect(byGroup.items.some((a) => a.type === 'payment_webhook_unhandled')).toBe(true);
    expect(byGroup.items.every((a) => a.group === 'system')).toBe(true);
  });

  it('marks all read, optionally scoped to one group', async () => {
    const scoped = await alerts.markAllRead(asSuper(super2Id), 'payments');
    expect(scoped.updated).toBeGreaterThan(0);
    const remaining = await alerts.list(asSuper(super2Id), { unreadOnly: true });
    // Payments is caught up, while the system alert this spec raised is not.
    expect(remaining.items.every((a) => a.group !== 'payments')).toBe(true);
    expect(remaining.items.some((a) => a.type === 'payment_webhook_unhandled')).toBe(true);

    await alerts.markAllRead(asSuper(super2Id));
    expect((await alerts.list(asSuper(super2Id), { unreadOnly: true })).items).toHaveLength(0);
  });

  it('returns the registry annotated with the current toggles', async () => {
    const { groups } = await alerts.settings(asSuper(superId));
    expect(groups.map((g) => g.key)).toEqual(PLATFORM_ALERT_GROUPS.map((g) => g.key));
    const payments = groups.find((g) => g.key === 'payments')!;
    expect(payments.enabled).toBe(false);
    // Untouched group still reports its registry default.
    expect(groups.find((g) => g.key === 'security')!.enabled).toBe(true);
  });
});
