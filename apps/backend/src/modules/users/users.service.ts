import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { users } from '../../database/schema/users';
import { and, eq } from 'drizzle-orm';

/** What one member may see of another: the public profile fields, nothing private. */
export const MEMBER_VISIBLE_COLUMNS = {
  id: true,
  username: true,
  name: true,
  headline: true,
  bio: true,
  avatarUrl: true,
  coverImageUrl: true,
  location: true,
  role: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private drizzle: DrizzleService) {}

  async findById(id: string) {
    return this.drizzle.db.query.users.findFirst({
      where: eq(users.id, id),
    });
  }

  /**
   * Tenant-scoped lookup for other members, so it returns only what a public profile shows.
   * It used to `select()` every column: any signed-in member could read another user's
   * password hash, email, auth ids and last login IP by id.
   */
  async findByIdScoped(id: string, tenantId: string) {
    return (
      (await this.drizzle.db.query.users.findFirst({
        where: and(eq(users.id, id), eq(users.tenantId, tenantId)),
        columns: MEMBER_VISIBLE_COLUMNS,
      })) ?? null
    );
  }

  async findByTenant(tenantId: string) {
    return this.drizzle.db.query.users.findMany({
      where: eq(users.tenantId, tenantId),
    });
  }
}
