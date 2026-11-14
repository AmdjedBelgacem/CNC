import { afterEach, describe, expect, it } from 'vitest';
import { AiUsageLimitService } from '../src/modules/ai/ai-usage-limit.service';

/** Daily AI ceilings: per user, per anonymous visitor, per tenant. In-process (no Redis). */
const at = new Date('2026-11-14T12:00:00Z');

describe('AI daily usage limits', () => {
  afterEach(() => {
    delete process.env.AI_DAILY_LIMIT_PER_USER;
    delete process.env.AI_DAILY_LIMIT_PER_VISITOR;
    delete process.env.AI_DAILY_LIMIT_PER_TENANT;
  });

  it('stops a user at the per-user cap, and only that user', async () => {
    process.env.AI_DAILY_LIMIT_PER_USER = '3';
    const limiter = new AiUsageLimitService();
    for (let i = 0; i < 3; i++) await limiter.consume({ tenantId: 't', userId: 'u1', role: 'learner' }, at);
    await expect(limiter.consume({ tenantId: 't', userId: 'u1', role: 'learner' }, at)).rejects.toMatchObject({ status: 429 });
    await expect(limiter.consume({ tenantId: 't', userId: 'u2', role: 'learner' }, at)).resolves.toBeUndefined();
  });

  it('resets on the next UTC day', async () => {
    process.env.AI_DAILY_LIMIT_PER_USER = '1';
    const limiter = new AiUsageLimitService();
    await limiter.consume({ tenantId: 't', userId: 'u', role: 'learner' }, at);
    await expect(limiter.consume({ tenantId: 't', userId: 'u', role: 'learner' }, at)).rejects.toMatchObject({ status: 429 });
    await expect(
      limiter.consume({ tenantId: 't', userId: 'u', role: 'learner' }, new Date('2026-11-15T00:01:00Z')),
    ).resolves.toBeUndefined();
  });

  it('caps anonymous visitors per IP', async () => {
    process.env.AI_DAILY_LIMIT_PER_VISITOR = '2';
    const limiter = new AiUsageLimitService();
    await limiter.consume({ tenantId: 't', ip: '1.1.1.1' }, at);
    await limiter.consume({ tenantId: 't', ip: '1.1.1.1' }, at);
    await expect(limiter.consume({ tenantId: 't', ip: '1.1.1.1' }, at)).rejects.toMatchObject({ status: 429 });
    await expect(limiter.consume({ tenantId: 't', ip: '2.2.2.2' }, at)).resolves.toBeUndefined();
  });

  it('exempts admins from the per-user cap but not from the tenant cap', async () => {
    process.env.AI_DAILY_LIMIT_PER_USER = '1';
    process.env.AI_DAILY_LIMIT_PER_TENANT = '3';
    const limiter = new AiUsageLimitService();
    for (let i = 0; i < 3; i++) await limiter.consume({ tenantId: 't', userId: 'a', role: 'admin' }, at);
    await expect(limiter.consume({ tenantId: 't', userId: 'a', role: 'admin' }, at)).rejects.toMatchObject({ status: 429 });
  });

  it('keeps tenants apart', async () => {
    process.env.AI_DAILY_LIMIT_PER_TENANT = '1';
    const limiter = new AiUsageLimitService();
    await limiter.consume({ tenantId: 'a', userId: 'x', role: 'admin' }, at);
    await expect(limiter.consume({ tenantId: 'b', userId: 'y', role: 'admin' }, at)).resolves.toBeUndefined();
  });
});
