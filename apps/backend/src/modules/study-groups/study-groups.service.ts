import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { groupMembers, studyGroups } from '../../database/schema/social';
import { users } from '../../database/schema/users';
import type { CreateGroupDto, UpdateGroupDto } from './dto/create-group.dto';

/** Roles allowed to edit or delete any group, not only the one they host. */
const MANAGER_ROLES = new Set(['admin', 'super_admin', 'moderator']);

/** How many members the public detail endpoint previews before "view all". */
const MEMBER_PREVIEW = 12;

export interface ListGroupsFilters {
  search?: string;
  city?: string;
  academy?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class StudyGroupsService {
  constructor(private drizzle: DrizzleService) {}

  // -------------------------------------------------------------------------
  // Read
  // -------------------------------------------------------------------------

  /**
   * Public, paginated list. Inactive groups are excluded because that flag is how a host archives
   * a group — a deleted-in-spirit group must not keep appearing in search or on the map.
   *
   * `member_count` is read from the row rather than aggregated per request; it is a denormalised
   * counter maintained by `recount()` on every membership change. Doing a COUNT here would make the
   * list query scale with total memberships instead of with the groups it returns.
   */
  async list(filters: ListGroupsFilters) {
    const limit = Math.min(Math.max(filters.limit ?? 12, 1), 60);
    const page = Math.max(filters.page ?? 1, 1);

    const conditions = [eq(studyGroups.isActive, true)];

    if (filters.city) conditions.push(eq(studyGroups.city, filters.city));
    if (filters.academy) conditions.push(eq(studyGroups.academy, filters.academy));

    const term = filters.search?.trim();
    if (term) {
      // ILIKE rather than a trigram index: matches are on user-authored free text and the table is
      // small, so a scan over the already-narrowed active set is the right trade.
      const pattern = `%${term.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
      conditions.push(
        or(
          ilike(studyGroups.name, pattern),
          ilike(studyGroups.description, pattern),
          ilike(studyGroups.city, pattern),
        )!,
      );
    }

    const where = and(...conditions);

    const [items, [total]] = await Promise.all([
      this.drizzle.db
        .select()
        .from(studyGroups)
        .where(where)
        .orderBy(desc(studyGroups.memberCount), desc(studyGroups.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      this.drizzle.db.select({ value: count() }).from(studyGroups).where(where),
    ]);

    return { data: items, total: total?.value ?? 0, page, limit };
  }

  /** Distinct cities that actually have an active group — powers the city filter. */
  async listCities() {
    const rows = await this.drizzle.db
      .select({ city: studyGroups.city })
      .from(studyGroups)
      .where(and(eq(studyGroups.isActive, true), sql`${studyGroups.city} is not null`));
    return [...new Set(rows.map((r) => r.city).filter((c): c is string => !!c && c.length > 0))].sort(
      (a, b) => a.localeCompare(b),
    );
  }

  /**
   * One group with a member preview and the caller's relationship to it.
   *
   * An archived group returns 404 to everyone except its host and site managers: those people need
   * to reach it to un-archive it, but a member of the public should not land on a dead detail page
   * from a stale link.
   */
  async detail(id: string, caller?: { id: string; role?: string }) {
    const [group] = await this.drizzle.db.select().from(studyGroups).where(eq(studyGroups.id, id));
    if (!group) throw new NotFoundException('Study group not found');

    const canSeeArchived = this.canManage(group, caller);
    if (!group.isActive && !canSeeArchived) throw new NotFoundException('Study group not found');

    const members = await this.drizzle.db
      .select({
        userId: groupMembers.userId,
        role: groupMembers.role,
        joinedAt: groupMembers.joinedAt,
        name: users.name,
        username: users.username,
        avatarUrl: users.avatarUrl,
      })
      .from(groupMembers)
      .innerJoin(users, eq(groupMembers.userId, users.id))
      .where(eq(groupMembers.groupId, id))
      .orderBy(asc(groupMembers.joinedAt))
      .limit(MEMBER_PREVIEW);

    const [membership] = caller
      ? await this.drizzle.db
          .select({ role: groupMembers.role })
          .from(groupMembers)
          .where(and(eq(groupMembers.groupId, id), eq(groupMembers.userId, caller.id)))
      : [];

    return {
      data: {
        ...group,
        members,
        memberCount: await this.currentMemberCount(id),
        isMember: !!membership,
        isHost: group.hostId === caller?.id,
        canManage: canSeeArchived,
        isFull: await this.isFull(id, group.maxMembers ?? 20),
      },
    };
  }

  /** Groups the caller is in — hosting or membership, flagged so the UI can tell them apart. */
  async mine(callerId: string) {
    const rows = await this.drizzle.db
      .select({ group: studyGroups, memberRole: groupMembers.role, joinedAt: groupMembers.joinedAt })
      .from(groupMembers)
      .innerJoin(studyGroups, eq(groupMembers.groupId, studyGroups.id))
      .where(eq(groupMembers.userId, callerId))
      .orderBy(desc(studyGroups.createdAt));

    return {
      data: rows.map((r) => ({
        ...r.group,
        memberRole: r.memberRole,
        joinedAt: r.joinedAt,
        isHost: r.group.hostId === callerId,
        memberCount: r.group.memberCount,
      })),
    };
  }

  // -------------------------------------------------------------------------
  // Write
  // -------------------------------------------------------------------------

  /**
   * Create a group. The creator becomes both host and the first member, so `member_count` starts at
   * 1 rather than the column default — a group that claims 0 members while its host is standing in
   * it is wrong from the first render.
   */
  async create(dto: CreateGroupDto, hostId: string) {
    if ((dto.lat === undefined) !== (dto.lng === undefined)) {
      throw new BadRequestException('Latitude and longitude must be provided together');
    }

    return this.drizzle.db.transaction(async (tx) => {
      const [group] = await tx
        .insert(studyGroups)
        .values({
          hostId,
          name: dto.name,
          description: dto.description,
          academy: dto.academy,
          address: dto.address,
          city: dto.city,
          state: dto.state,
          lat: dto.lat,
          lng: dto.lng,
          meetingSchedule: dto.meetingSchedule,
          maxMembers: dto.maxMembers ?? 20,
          memberCount: 1,
          coverUrl: dto.coverUrl,
          isActive: true,
        })
        .returning();

      if (!group) throw new BadRequestException('Could not create the group');

      await tx.insert(groupMembers).values({ groupId: group.id, userId: hostId, role: 'host' });
      return group;
    });
  }

  /**
   * Edit a group. Only the host or a site manager may do this; `isActive: false` archives the group
   * (hidden from the list, still visible to the host) as opposed to `delete`, which destroys it.
   */
  async update(id: string, dto: UpdateGroupDto, caller: { id: string; role?: string }) {
    const group = await this.require(id);
    this.assertManage(group, caller);

    if ((dto.lat === undefined) !== (dto.lng === undefined)) {
      throw new BadRequestException('Latitude and longitude must be provided together');
    }

    /**
     * Lowering `max_members` below the number of people already in the group would silently strand
     * members over capacity — they could not be re-admitted and the host could not see why. Refuse
     * the edit instead; the host must remove people first.
     */
    if (dto.maxMembers !== undefined) {
      const current = await this.currentMemberCount(id);
      if (dto.maxMembers < current) {
        throw new BadRequestException(
          `Cannot set capacity to ${dto.maxMembers}: the group already has ${current} members`,
        );
      }
    }

    const patch = Object.fromEntries(
      Object.entries(dto).filter(([, v]) => v !== undefined),
    ) as Partial<typeof studyGroups.$inferInsert>;

    if (Object.keys(patch).length === 0) return group;

    const [updated] = await this.drizzle.db
      .update(studyGroups)
      .set(patch)
      .where(eq(studyGroups.id, id))
      .returning();
    return updated;
  }

  /**
   * Destroy a group. Hard delete on purpose: `ON DELETE CASCADE` takes the memberships with it, so
   * no orphaned rows survive the group they described. A host wanting to keep the history should
   * archive with `PATCH { isActive: false }` instead.
   */
  async remove(id: string, caller: { id: string; role?: string }) {
    const group = await this.require(id);
    this.assertManage(group, caller);
    await this.drizzle.db.delete(studyGroups).where(eq(studyGroups.id, id));
    return { data: { id, deleted: true } };
  }

  /**
   * Join a group.
   *
   * Idempotent: a repeat call is a no-op rather than a 409, because a double-clicked button or a
   * retried request must not leave the UI in an error state for an action that already succeeded.
   * The unique index is what makes that safe under concurrency — without it two parallel requests
   * both pass the "already a member?" check and both insert.
   */
  async join(groupId: string, callerId: string) {
    const group = await this.require(groupId);
    if (!group.isActive) throw new ConflictException('This group is no longer accepting members');

    const [existing] = await this.drizzle.db
      .select({ role: groupMembers.role })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, callerId)));

    if (existing) return this.detail(groupId, { id: callerId });

    if (await this.isFull(groupId, group.maxMembers ?? 20)) {
      throw new ConflictException('This group is full');
    }

    try {
      await this.drizzle.db.insert(groupMembers).values({ groupId, userId: callerId, role: 'member' });
    } catch (err) {
      // Lost the race to a concurrent join: the other request won, so the state we wanted is
      // already true. Anything else is a genuine failure.
      if (!isUniqueViolation(err)) throw err;
    }

    // Persist the new count. Without this the list keeps showing whatever `member_count` was at
    // creation time while the detail page (which counts rows) shows the truth — the two disagree
    // for every group anyone has ever joined.
    await this.recount(groupId);

    return this.detail(groupId, { id: callerId });
  }

  /**
   * Leave a group.
   *
   * The host case is the one that needs care. Simply letting them leave would leave the group with
   * a `host_id` pointing at someone who is no longer a member — nobody could edit it ever again.
   * So the oldest remaining member is promoted; if nobody is left, the group is archived, which is
   * the honest state for a group whose host walked away empty-handed.
   */
  async leave(groupId: string, callerId: string) {
    const group = await this.require(groupId);

    const [membership] = await this.drizzle.db
      .select({ role: groupMembers.role })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, callerId)));

    if (!membership) throw new ConflictException('You are not a member of this group');

    await this.drizzle.db
      .delete(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, callerId)));

    if (group.hostId === callerId) {
      const next = await this.drizzle.db
        .select({ userId: groupMembers.userId })
        .from(groupMembers)
        .where(eq(groupMembers.groupId, groupId))
        .orderBy(asc(groupMembers.joinedAt))
        .limit(1);

      const successor = next[0]?.userId;

      if (successor) {
        await this.drizzle.db.transaction(async (tx) => {
          await tx
            .update(studyGroups)
            .set({ hostId: successor })
            .where(eq(studyGroups.id, groupId));
          // Promoting the person without promoting their row leaves `study_groups.host_id` and
          // `group_members.role` disagreeing about who hosts the group — the list would render
          // them as an ordinary member while every permission check treats them as the host.
          await tx
            .update(groupMembers)
            .set({ role: 'host' })
            .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, successor)));
        });
      } else {
        await this.drizzle.db
          .update(studyGroups)
          .set({ isActive: false })
          .where(eq(studyGroups.id, groupId));
      }
    }

    const memberCount = await this.recount(groupId);
    return { data: { groupId, memberCount, left: true } };
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private async require(id: string) {
    const [group] = await this.drizzle.db.select().from(studyGroups).where(eq(studyGroups.id, id));
    if (!group) throw new NotFoundException('Study group not found');
    return group;
  }

  private canManage(group: typeof studyGroups.$inferSelect, caller?: { id: string; role?: string }) {
    if (!caller) return false;
    return group.hostId === caller.id || (caller.role ? MANAGER_ROLES.has(caller.role) : false);
  }

  private assertManage(group: typeof studyGroups.$inferSelect, caller: { id: string; role?: string }) {
    if (!this.canManage(group, caller)) {
      throw new ForbiddenException('Only the group host can manage this group');
    }
  }

  /**
   * Recompute `member_count` from the source of truth rather than incrementing a counter.
   *
   * A blind `member_count = member_count + 1` drifts the moment a request is retried, a transaction
   * rolls back after the increment, or a delete path is missed — and the number is displayed
   * everywhere, so drift is visible. Recounting is a single indexed COUNT on a table that holds
   * one row per membership, and it is always right.
   */
  private async recount(groupId: string): Promise<number> {
    const [row] = await this.drizzle.db
      .select({ value: count() })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId));

    const value = row?.value ?? 0;
    await this.drizzle.db
      .update(studyGroups)
      .set({ memberCount: value })
      .where(eq(studyGroups.id, groupId));
    return value;
  }

  private async currentMemberCount(groupId: string): Promise<number> {
    const [row] = await this.drizzle.db
      .select({ value: count() })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId));
    return row?.value ?? 0;
  }

  private async isFull(groupId: string, maxMembers: number): Promise<boolean> {
    return (await this.currentMemberCount(groupId)) >= maxMembers;
  }
}

/**
 * Postgres unique_violation (23505). Reached when two concurrent joins both pass the existence
 * check; the second insert loses, and the membership it wanted already exists.
 */
function isUniqueViolation(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  return code === '23505';
}
