import { Injectable, NotFoundException } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { repairShops } from '../../database/schema/social';
import { eq, and, asc, count, ilike, or } from 'drizzle-orm';

@Injectable()
export class RepairService {
  constructor(private drizzle: DrizzleService) {}

  async findAll(opts?: {
    category?: string; search?: string; lat?: number; lng?: number; radius?: number;
    page?: number; limit?: number;
  }) {
    const conditions: any[] = [eq(repairShops.isActive, true)];
    if (opts?.category) conditions.push(eq(repairShops.category, opts.category));
    if (opts?.search) {
      conditions.push(
        or(
          ilike(repairShops.name, `%${opts.search}%`),
          ilike(repairShops.description, `%${opts.search}%`),
          ilike(repairShops.city, `%${opts.search}%`),
        ),
      );
    }

    const page = opts?.page || 1;
    const limit = opts?.limit || 30;

    const data = await this.drizzle.db.query.repairShops.findMany({
      where: and(...conditions),
      orderBy: [asc(repairShops.name)],
      limit,
      offset: (page - 1) * limit,
    });

    const totalArr = await this.drizzle.db
      .select({ count: count() })
      .from(repairShops)
      .where(and(...conditions));

    return { data, total: totalArr[0]?.count || 0, page, limit };
  }

  async findById(id: string) {
    const shop = await this.drizzle.db.query.repairShops.findFirst({
      where: eq(repairShops.id, id),
    });
    if (!shop) throw new NotFoundException('Repair shop not found');
    return shop;
  }

  async create(data: any) {
    const [shop] = await this.drizzle.db.insert(repairShops).values(data).returning();
    return shop;
  }

  async update(id: string, data: any) {
    const [shop] = await this.drizzle.db
      .update(repairShops).set({ ...data, updatedAt: new Date() })
      .where(eq(repairShops.id, id)).returning();
    if (!shop) throw new NotFoundException('Repair shop not found');
    return shop;
  }
}
