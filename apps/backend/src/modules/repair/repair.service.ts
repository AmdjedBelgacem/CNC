import { Injectable, NotFoundException } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { repairShops } from '../../database/schema/social';
import { eq, and, asc, count, or } from 'drizzle-orm';
import { ilikeContains } from '../../common/utils/escape-like';
import {
  REPAIR_SHOP_WRITABLE_KEYS,
  type CreateRepairShopDto,
  type UpdateRepairShopDto,
} from './dto/repair.dto';

type RepairShopValues = Partial<typeof repairShops.$inferInsert>;

/** Copy only the declared shop fields; anything else on the body is ignored. */
function pickWritable(data: UpdateRepairShopDto): RepairShopValues {
  const values: Record<string, unknown> = {};
  for (const key of REPAIR_SHOP_WRITABLE_KEYS) {
    if (data[key] !== undefined) values[key] = data[key];
  }
  return values as RepairShopValues;
}

@Injectable()
export class RepairService {
  constructor(private drizzle: DrizzleService) {}

  async findAll(tenantId: string, opts?: {
    category?: string; search?: string; lat?: number; lng?: number; radius?: number;
    page?: number; limit?: number;
  }) {
    const conditions: any[] = [eq(repairShops.tenantId, tenantId), eq(repairShops.isActive, true)];
    if (opts?.category) conditions.push(eq(repairShops.category, opts.category));
    if (opts?.search) {
      conditions.push(
        or(
          ilikeContains(repairShops.name, opts.search),
          ilikeContains(repairShops.description, opts.search),
          ilikeContains(repairShops.city, opts.search),
        ),
      );
    }

    const page = Math.max(opts?.page || 1, 1);
    const limit = Math.min(Math.max(opts?.limit || 30, 1), 100);

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

  async findById(tenantId: string, id: string) {
    const shop = await this.drizzle.db.query.repairShops.findFirst({
      where: and(eq(repairShops.id, id), eq(repairShops.tenantId, tenantId)),
    });
    if (!shop) throw new NotFoundException('Repair shop not found');
    return shop;
  }

  async create(tenantId: string, data: CreateRepairShopDto) {
    const [shop] = await this.drizzle.db
      .insert(repairShops)
      .values({ ...pickWritable(data), name: data.name, address: data.address, tenantId })
      .returning();
    return shop;
  }

  async update(tenantId: string, id: string, data: UpdateRepairShopDto) {
    const [shop] = await this.drizzle.db
      .update(repairShops).set({ ...pickWritable(data), updatedAt: new Date() })
      .where(and(eq(repairShops.id, id), eq(repairShops.tenantId, tenantId))).returning();
    if (!shop) throw new NotFoundException('Repair shop not found');
    return shop;
  }
}
