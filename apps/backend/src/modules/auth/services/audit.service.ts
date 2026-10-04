import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../../../database/drizzle.service';
import { auditLogs } from '../../../database/schema/auth';
import { eq, and, inArray } from 'drizzle-orm';

@Injectable()
export class AuditService {
  constructor(private drizzle: DrizzleService) {}

  async log(params: {
    userId?: string;
    action: string;
    entityType?: string;
    entityId?: string;
    details?: Record<string, unknown>;
    ip?: string;
    userAgent?: string;
    tenantId?: string;
  }): Promise<void> {
    try {
      await this.drizzle.db.insert(auditLogs).values({
        userId: params.userId || null,
        action: params.action,
        entityType: params.entityType || null,
        entityId: params.entityId || null,
        details: params.details || null,
        ip: params.ip || null,
        userAgent: params.userAgent || null,
        tenantId: params.tenantId || null,
      });
    } catch (error) {
      console.error('Audit log failed (non-blocking):', error);
    }
  }

  async getLogs(options: {
    userId?: string;
    action?: string;
    /** Match any of these actions. Needed because related events are logged under
     *  distinct names (e.g. user.login vs user.login.failed) and an exact-equality
     *  filter on one of them silently hides the others. */
    actions?: string[];
    tenantId?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<any[]> {
    const conditions: any[] = [];
    if (options.userId) conditions.push(eq(auditLogs.userId, options.userId));
    if (options.action) conditions.push(eq(auditLogs.action, options.action));
    if (options.actions && options.actions.length > 0) {
      conditions.push(inArray(auditLogs.action, options.actions));
    }
    if (options.tenantId) conditions.push(eq(auditLogs.tenantId, options.tenantId));

    return this.drizzle.db.query.auditLogs.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: (logs: any, { desc }: any) => [desc(logs.createdAt)],
      limit: options.limit || 50,
      offset: options.offset || 0,
    });
  }
}
