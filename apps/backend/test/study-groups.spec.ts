import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DrizzleService } from '../src/database/drizzle.service';
import { groupMembers, studyGroups, users } from '../src/database/schema';
import { StudyGroupsService } from '../src/modules/study-groups/study-groups.service';

/**
 * Study groups: membership integrity.
 *
 * These run against the configured database the way the rest of the integration suite does, and
 * every row they create is deleted again — the rule elsewhere in this folder is "never delete what
 * you did not create", and that cuts both ways.
 *
 * The assertions that matter are the ones about drift. `member_count` is denormalised so the list
 * can order by it without a COUNT per row, which means it can disagree with reality; every mutation
 * here re-derives it, and the invariant checks below fail the moment a path forgets to.
 */
describe('study groups (integration)', () => {
  let drizzle: DrizzleService;
  let svc: StudyGroupsService;
  let hostUser: { id: string };
  let otherUser: { id: string };
  const created: string[] = [];

  beforeAll(async () => {
    drizzle = new DrizzleService({ get: (k: string) => process.env[k] } as never);
    await drizzle.onModuleInit();
    svc = new StudyGroupsService(drizzle);

    const rows = await drizzle.db
      .select({ id: users.id })
      .from(users)
      .orderBy(users.createdAt)
      .limit(2);

    if (rows.length < 2) {
      throw new Error('study-groups spec needs at least two seeded users');
    }
    hostUser = { id: rows[0].id };
    otherUser = { id: rows[1].id };
  });

  afterAll(async () => {
    if (created.length) {
      // Group delete cascades to memberships, so one statement clears both.
      await drizzle.db.delete(studyGroups).where(inArray(studyGroups.id, created));
    }
  });

  /** Count straight from the source of truth, bypassing the cached column entirely. */
  async function realCount(groupId: string): Promise<number> {
    const rows = await drizzle.db
      .select({ id: groupMembers.id })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId));
    return rows.length;
  }

  async function cachedCount(groupId: string): Promise<number> {
    const [row] = await drizzle.db
      .select({ memberCount: studyGroups.memberCount })
      .from(studyGroups)
      .where(eq(studyGroups.id, groupId));
    return row?.memberCount ?? -1;
  }

  async function track<T extends { id: string }>(row: T): Promise<T> {
    created.push(row.id);
    return row;
  }

  it('makes the creator host and first member, with counts that agree', async () => {
    const group = await track(
      await svc.create({ name: 'Spec: founding', city: 'Chicago', maxMembers: 5 }, hostUser.id),
    );

    expect(group.memberCount).toBe(1);
    expect(await realCount(group.id)).toBe(1);
    expect(await cachedCount(group.id)).toBe(await realCount(group.id));

    const [membership] = await drizzle.db
      .select()
      .from(groupMembers)
      .where(eq(groupMembers.groupId, group.id));
    expect(membership?.role).toBe('host');
    expect(membership?.userId).toBe(hostUser.id);
  });

  it('treats a repeat join as a no-op rather than an error', async () => {
    const group = await track(await svc.create({ name: 'Spec: idempotent join', maxMembers: 5 }, hostUser.id));

    await svc.join(group.id, otherUser.id);
    const after = await svc.join(group.id, otherUser.id);

    expect(after.data.isMember).toBe(true);
    expect(await realCount(group.id)).toBe(2);
    expect(await cachedCount(group.id)).toBe(2);
  });

  it('refuses a join past capacity and never lets the counter pass max_members', async () => {
    const group = await track(
      await svc.create({ name: 'Spec: capacity', maxMembers: 2 }, hostUser.id),
    );

    await svc.join(group.id, otherUser.id); // now full: host + other
    await expect(svc.join(group.id, otherUser.id)).resolves.toBeTruthy(); // already in, still fine

    // A third person must be turned away.
    const third = await drizzle.db.select({ id: users.id }).from(users).orderBy(users.createdAt).offset(2).limit(1);
    if (third.length > 0) {
      await expect(svc.join(group.id, third[0].id)).rejects.toThrow(ConflictException);
    }

    expect(await realCount(group.id)).toBeLessThanOrEqual(2);
    expect(await cachedCount(group.id)).toBe(await realCount(group.id));
  });

  it('rejects leaving a group you never joined', async () => {
    const group = await track(await svc.create({ name: 'Spec: stranger leave', maxMembers: 5 }, hostUser.id));
    await expect(svc.leave(group.id, otherUser.id)).rejects.toThrow(ConflictException);
  });

  it('hands the host role to the oldest member when the host leaves', async () => {
    const group = await track(await svc.create({ name: 'Spec: handover', maxMembers: 10 }, hostUser.id));
    await svc.join(group.id, otherUser.id);

    await svc.leave(group.id, hostUser.id);

    const detail = await svc.detail(group.id, { id: otherUser.id });
    expect(detail.data.hostId).toBe(otherUser.id);
    expect(detail.data.memberCount).toBe(1);
    expect(await realCount(group.id)).toBe(1);
    expect(await cachedCount(group.id)).toBe(1);

    // The promotion must reach group_members too, or the list and the permission check disagree.
    const [membership] = await drizzle.db
      .select()
      .from(groupMembers)
      .where(eq(groupMembers.groupId, group.id));
    expect(membership?.role).toBe('host');
  });

  it('archives a group whose last member walks away', async () => {
    const group = await track(await svc.create({ name: 'Spec: abandoned', maxMembers: 5 }, hostUser.id));

    await svc.leave(group.id, hostUser.id);

    await expect(svc.detail(group.id, { id: otherUser.id })).rejects.toThrow(NotFoundException);
    // The host still needs to reach it to restore or delete it.
    const asHost = await svc.detail(group.id, { id: hostUser.id });
    expect(asHost.data.isActive).toBe(false);
    expect(asHost.data.canManage).toBe(true);

    const list = await svc.list({ search: 'Spec: abandoned' });
    expect(list.data.find((g) => g.id === group.id)).toBeUndefined();
  });

  it('lets only the host or a site manager edit', async () => {
    const group = await track(await svc.create({ name: 'Spec: permissions', maxMembers: 5 }, hostUser.id));

    await expect(svc.update(group.id, { name: 'nope' }, { id: otherUser.id, role: 'learner' })).rejects.toThrow(
      ForbiddenException,
    );
    await expect(svc.remove(group.id, { id: otherUser.id, role: 'learner' })).rejects.toThrow(ForbiddenException);
    await expect(svc.update(group.id, { name: 'Spec: permissions renamed' }, { id: hostUser.id })).resolves.toBeTruthy();
    // A site manager is not the host but outranks them.
    await expect(svc.update(group.id, { city: 'Denver' }, { id: otherUser.id, role: 'admin' })).resolves.toBeTruthy();
  });

  it('will not shrink capacity below the number of people already in', async () => {
    const group = await track(await svc.create({ name: 'Spec: shrink', maxMembers: 6 }, hostUser.id));
    await svc.join(group.id, otherUser.id);

    await expect(svc.update(group.id, { maxMembers: 1 }, { id: hostUser.id })).rejects.toThrow(BadRequestException);
    await expect(svc.update(group.id, { maxMembers: 2 }, { id: hostUser.id })).resolves.toBeTruthy();
  });

  it('keeps member_count equal to the real rows after an arbitrary sequence', async () => {
    const group = await track(await svc.create({ name: 'Spec: drift', maxMembers: 50 }, hostUser.id));
    const everyone = await drizzle.db.select({ id: users.id }).from(users).orderBy(users.createdAt).limit(6);

    // Join everyone, then drop half, in an order that would expose an increment/decrement
    // implementation that misses a path.
    for (const u of everyone) {
      if (u.id === hostUser.id) continue;
      await svc.join(group.id, u.id);
    }
    const half = everyone.slice(0, 3);
    for (const u of half) {
      if (u.id === hostUser.id) continue;
      await svc.leave(group.id, u.id);
    }

    const real = await realCount(group.id);
    const cached = await cachedCount(group.id);
    expect(cached).toBe(real);
    expect(await svc.list({ search: 'Spec: drift' })).toBeTruthy();
  });
});
