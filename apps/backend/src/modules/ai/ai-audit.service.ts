import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { aiAuditLogs, aiUsageLogs } from '../../database/schema/ai';

export interface AiUsageAuditInput {
  tenantId: string;
  userId?: string;
  requestId: string;
  operation: string;
  provider?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
  retrievedChunkIds?: string[];
  status: string;
  errorCode?: string;
}

export interface AiAuditContext {
  userId?: string;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AiAuditService {
  constructor(private readonly drizzle: DrizzleService) {}

  async usage(input: AiUsageAuditInput): Promise<void> {
    try {
      await this.drizzle.db.insert(aiUsageLogs).values({
        tenantId: input.tenantId,
        userId: input.userId || null,
        requestId: input.requestId.slice(0, 100),
        operation: input.operation.slice(0, 50),
        provider: input.provider?.slice(0, 64) || null,
        model: input.model?.slice(0, 200) || null,
        inputTokens: this.safeCount(input.inputTokens),
        outputTokens: this.safeCount(input.outputTokens),
        totalTokens: this.safeCount(input.totalTokens),
        latencyMs: this.safeCount(input.latencyMs),
        retrievedChunkIds: (input.retrievedChunkIds || []).slice(0, 50),
        status: input.status.slice(0, 30),
        errorCode: input.errorCode?.slice(0, 80) || null,
      });
    } catch {
      return;
    }
  }

  async event(
    tenantId: string,
    action: string,
    outcome: string,
    context: AiAuditContext = {},
    entityType?: string,
    entityId?: string,
    details: Record<string, unknown> = {},
  ): Promise<void> {
    try {
      await this.drizzle.db.insert(aiAuditLogs).values({
        tenantId,
        userId: context.userId || null,
        action: action.slice(0, 100),
        entityType: entityType?.slice(0, 100) || null,
        entityId: entityId?.slice(0, 255) || null,
        outcome: outcome.slice(0, 30),
        details: this.safeDetails(details),
        ip: context.ip?.slice(0, 45) || null,
        userAgent: context.userAgent?.slice(0, 1000) || null,
      });
    } catch {
      return;
    }
  }

  private safeCount(value: number | undefined): number {
    if (!Number.isFinite(value) || value === undefined || value < 0) return 0;
    return Math.min(Math.floor(value), 10_000_000);
  }

  private safeDetails(details: Record<string, unknown>): Record<string, unknown> {
    const blocked = /prompt|message|history|content|api.?key|cipher|secret|password|token|credential/i;
    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(details)) {
      if (blocked.test(key)) continue;
      if (typeof value === 'string') output[key] = value.slice(0, 500);
      else if (typeof value === 'number' || typeof value === 'boolean' || value === null) output[key] = value;
      else if (Array.isArray(value)) {
        output[key] = value
          .filter((item) => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean')
          .slice(0, 50);
      }
    }
    return output;
  }
}
