import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, and, desc, gte, lt, sql, count } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { financeBudgets } from '../../database/schema/finance';
import { orders } from '../../database/schema/orders';
import type { CreateBudgetDto, UpdateBudgetDto } from './dto/finance.dto';
import type { Budget, BudgetWithActual, FinanceSummary, BudgetPeriod, BudgetCategory } from '@titan/shared';

type BudgetRow = typeof financeBudgets.$inferSelect;

@Injectable()
export class FinanceService {
  constructor(private drizzle: DrizzleService) {}

  private toBudget(row: BudgetRow): Budget {
    return {
      id: row.id,
      tenantId: row.tenantId,
      period: row.period as BudgetPeriod,
      category: row.category as BudgetCategory,
      targetCents: row.targetCents,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private periodWindow(period: BudgetPeriod): { start: Date; end: Date } {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    if (period === 'month') {
      return { start: new Date(y, m, 1), end: new Date(y, m + 1, 1) };
    }
    if (period === 'quarter') {
      const q = Math.floor(m / 3);
      return { start: new Date(y, q * 3, 1), end: new Date(y, q * 3 + 3, 1) };
    }
    return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1) };
  }

  private async actualForWindow(tenantId: string, start: Date, end: Date, category: string): Promise<number> {
    if (category !== 'revenue') return 0;
    const rows = await this.drizzle.db
      .select({ total: sql<number>`COALESCE(SUM(${orders.total}), 0)` })
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, tenantId),
          eq(orders.status, 'confirmed'),
          gte(orders.createdAt, start),
          lt(orders.createdAt, end),
        ),
      );
    return Number(rows[0]?.total ?? 0);
  }

  async listBudgets(tenantId: string): Promise<BudgetWithActual[]> {
    const rows = await this.drizzle.db
      .select()
      .from(financeBudgets)
      .where(eq(financeBudgets.tenantId, tenantId))
      .orderBy(desc(financeBudgets.createdAt));

    const results: BudgetWithActual[] = [];
    for (const row of rows) {
      const { start, end } = this.periodWindow(row.period as BudgetPeriod);
      const actualCents = await this.actualForWindow(tenantId, start, end, row.category);
      const varianceCents = actualCents - row.targetCents;
      const progressPct = row.targetCents > 0 ? Math.min(100, Math.round((actualCents / row.targetCents) * 100)) : 0;
      results.push({ ...this.toBudget(row), actualCents, varianceCents, progressPct });
    }
    return results;
  }

  async createBudget(tenantId: string, dto: CreateBudgetDto): Promise<Budget> {
    const [row] = await this.drizzle.db
      .insert(financeBudgets)
      .values({
        tenantId,
        period: dto.period,
        category: dto.category,
        targetCents: dto.targetCents,
        notes: dto.notes ?? null,
      })
      .returning();
    return this.toBudget(row!);
  }

  async updateBudget(tenantId: string, id: string, dto: UpdateBudgetDto): Promise<Budget> {
    const [existing] = await this.drizzle.db
      .select()
      .from(financeBudgets)
      .where(and(eq(financeBudgets.id, id), eq(financeBudgets.tenantId, tenantId)))
      .limit(1);
    if (!existing) throw new NotFoundException('Budget not found');
    const [row] = await this.drizzle.db
      .update(financeBudgets)
      .set({
        period: dto.period,
        category: dto.category,
        targetCents: dto.targetCents,
        notes: dto.notes ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(financeBudgets.id, id), eq(financeBudgets.tenantId, tenantId)))
      .returning();
    return this.toBudget(row!);
  }

  async deleteBudget(tenantId: string, id: string): Promise<{ deleted: boolean }> {
    const [existing] = await this.drizzle.db
      .select()
      .from(financeBudgets)
      .where(and(eq(financeBudgets.id, id), eq(financeBudgets.tenantId, tenantId)))
      .limit(1);
    if (!existing) throw new NotFoundException('Budget not found');
    await this.drizzle.db
      .delete(financeBudgets)
      .where(and(eq(financeBudgets.id, id), eq(financeBudgets.tenantId, tenantId)));
    return { deleted: true };
  }

  async getSummary(tenantId: string): Promise<FinanceSummary> {
    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * 864e5);
    const d7 = new Date(now.getTime() - 7 * 864e5);

    const [rev30, rev7, pending, refunded, totalOrders, byStatusRows, avgOrder] = await Promise.all([
      this.drizzle.db
        .select({ total: sql<number>`COALESCE(SUM(${orders.total}),0)` })
        .from(orders)
        .where(and(eq(orders.tenantId, tenantId), eq(orders.status, 'confirmed'), gte(orders.createdAt, d30))),
      this.drizzle.db
        .select({ total: sql<number>`COALESCE(SUM(${orders.total}),0)` })
        .from(orders)
        .where(and(eq(orders.tenantId, tenantId), eq(orders.status, 'confirmed'), gte(orders.createdAt, d7))),
      this.drizzle.db
        .select({ n: count(), total: sql<number>`COALESCE(SUM(${orders.total}),0)` })
        .from(orders)
        .where(and(eq(orders.tenantId, tenantId), eq(orders.status, 'pending'))),
      this.drizzle.db
        .select({ total: sql<number>`COALESCE(SUM(${orders.total}),0)` })
        .from(orders)
        .where(and(eq(orders.tenantId, tenantId), eq(orders.status, 'refunded'))),
      this.drizzle.db
        .select({ n: count() })
        .from(orders)
        .where(eq(orders.tenantId, tenantId)),
      this.drizzle.db
        .select({ status: orders.status, n: count() })
        .from(orders)
        .where(eq(orders.tenantId, tenantId))
        .groupBy(orders.status),
      this.drizzle.db
        .select({ avg: sql<number>`COALESCE(AVG(${orders.total}),0)` })
        .from(orders)
        .where(and(eq(orders.tenantId, tenantId), eq(orders.status, 'confirmed'))),
    ]);

    const byStatus: Record<string, number> = {};
    for (const r of byStatusRows) byStatus[r.status ?? 'unknown'] = Number(r.n);

    const orderCount = Number(totalOrders[0]?.n ?? 0);
    return {
      revenue30dCents: Number(rev30[0]?.total ?? 0),
      revenue7dCents: Number(rev7[0]?.total ?? 0),
      pendingCount: Number(pending[0]?.n ?? 0),
      pendingTotalCents: Number(pending[0]?.total ?? 0),
      refundedTotalCents: Number(refunded[0]?.total ?? 0),
      totalOrders: orderCount,
      byStatus,
      orderCount,
      averageOrderCents: Math.round(Number(avgOrder[0]?.avg ?? 0)),
    };
  }

  async updateOrderStatus(tenantId: string, orderId: string, status: string) {
    const [existing] = await this.drizzle.db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)))
      .limit(1);
    if (!existing) throw new NotFoundException('Order not found');
    const [row] = await this.drizzle.db
      .update(orders)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)))
      .returning();
    return row;
  }
}
