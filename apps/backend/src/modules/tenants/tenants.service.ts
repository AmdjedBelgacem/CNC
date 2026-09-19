import { Injectable, NotFoundException } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { tenants } from '../../database/schema/tenants';
import { eq } from 'drizzle-orm';

@Injectable()
export class TenantsService {
  constructor(private drizzle: DrizzleService) {}

  async findBySlug(slug: string) {
    const tenant = await this.drizzle.db.query.tenants.findFirst({
      where: eq(tenants.slug, slug),
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async findAll() {
    return this.drizzle.db.query.tenants.findMany({
      where: eq(tenants.isActive, true),
    });
  }
}
