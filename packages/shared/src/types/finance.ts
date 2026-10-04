export type BudgetPeriod = 'month' | 'quarter' | 'year';

export type BudgetCategory = 'revenue' | 'ops' | 'marketing' | 'product' | 'other';

export interface Budget {
  id: string;
  tenantId: string;
  period: BudgetPeriod;
  category: BudgetCategory;
  targetCents: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetWithActual extends Budget {
  actualCents: number;
  varianceCents: number;
  progressPct: number;
}

export interface FinanceSummary {
  revenue30dCents: number;
  revenue7dCents: number;
  pendingCount: number;
  pendingTotalCents: number;
  refundedTotalCents: number;
  totalOrders: number;
  byStatus: Record<string, number>;
  orderCount: number;
  averageOrderCents: number;
}
