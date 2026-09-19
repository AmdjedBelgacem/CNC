import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { sponsors } from '../../database/schema/sponsors';
import { eq, asc } from 'drizzle-orm';

@Injectable()
export class SponsorsService {
  constructor(private drizzle: DrizzleService) {}

  async findByTenant(tenantId: string) {
    return this.drizzle.db.query.sponsors.findMany({
      where: eq(sponsors.tenantId, tenantId),
      orderBy: asc(sponsors.sortOrder),
    });
  }
}
