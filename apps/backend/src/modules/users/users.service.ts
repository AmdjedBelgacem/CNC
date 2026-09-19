import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { users } from '../../database/schema/users';
import { and, eq } from 'drizzle-orm';

@Injectable()
export class UsersService {
  constructor(private drizzle: DrizzleService) {}

  async findById(id: string) {
    return this.drizzle.db.query.users.findFirst({
      where: eq(users.id, id),
    });
  }

  async findByIdScoped(id: string, tenantId: string) {
    // Proper tenant-scoped lookup – no cross-tenant leakage, no existence oracle
    const rows = await this.drizzle.db.select().from(users).where(and(eq(users.id, id), eq(users.tenantId, tenantId))).limit(1);
    return (rows as any)[0] ?? null;
  }

  async findByTenant(tenantId: string) {
    return this.drizzle.db.query.users.findMany({
      where: eq(users.tenantId, tenantId),
    });
  }
}
