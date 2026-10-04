import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { and, desc, eq, sql } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { aiConversations, aiMessages } from '../../database/schema/ai-assistant';
import { aiFeedback } from '../../database/schema/ai-learning';

/** Postgres would raise 22P02 on anything else, surfacing as a 500. */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface AiFeedbackSummary {
  total: number;
  helpful: number;
  unhelpful: number;
  /** -1..1, or 0 when there is no signal yet. */
  score: number;
  webAnswered: number;
  webHelpfulRate: number | null;
}

/**
 * Captures member verdicts on answers.
 *
 * This is the input to every future improvement. Without it, "the assistant got
 * better" is an opinion; with it, a prompt or model change can be shown to move
 * a number. Votes are one-per-member-per-answer and scoped to the owner of the
 * thread, so feedback can never be planted on someone else's conversation.
 */
@Injectable()
export class AiFeedbackService {
  constructor(private readonly drizzle: DrizzleService) {}

  /**
   * Record or clear a vote. `rating` is 1 or -1; 0 removes the vote so a member
   * can take back a misclick without leaving a phantom row.
   */
  async rate(
    tenantId: string,
    userId: string,
    messageId: string,
    rating: number,
    reason?: string | null,
  ): Promise<{ rating: number }> {
    if (!Number.isInteger(rating) || Math.abs(rating) > 1) {
      throw new BadRequestException('rating must be 1 or -1');
    }
    // A malformed id must be a 400. Handing a non-UUID to Postgres raises a
    // 22P02 and surfaces as a 500, which tells a prober the id was malformed.
    if (!UUID_V4.test(messageId)) throw new BadRequestException('Invalid message id');
    // Ownership is proven on the message itself: same tenant, same user, and the
    // message must actually belong to a conversation the caller owns.
    const [message] = await this.drizzle.db
      .select({
        id: aiMessages.id,
        userId: aiMessages.userId,
        tenantId: aiMessages.tenantId,
        role: aiMessages.role,
        meta: aiMessages.meta,
        conversationId: aiMessages.conversationId,
      })
      .from(aiMessages)
      .where(and(eq(aiMessages.id, messageId), eq(aiMessages.tenantId, tenantId)))
      .limit(1);
    if (!message) throw new NotFoundException('Message not found');
    if (String(message.userId) !== String(userId)) throw new ForbiddenException('Message access denied');
    if (message.role !== 'assistant') throw new BadRequestException('Only assistant answers can be rated');

    if (rating === 0) {
      await this.drizzle.db
        .delete(aiFeedback)
        .where(and(eq(aiFeedback.messageId, messageId), eq(aiFeedback.userId, userId)));
      return { rating: 0 };
    }

    const meta = (message.meta ?? {}) as Record<string, unknown>;
    const usedWeb = meta.usedWeb === true;
    const mode = typeof meta.mode === 'string' ? meta.mode : null;
    const trimmed = reason ? reason.slice(0, 200) : null;

    await this.drizzle.db
      .insert(aiFeedback)
      .values({
        tenantId,
        userId,
        conversationId: message.conversationId,
        messageId,
        rating,
        reason: trimmed,
        mode,
        usedWeb,
      })
      .onConflictDoUpdate({
        target: [aiFeedback.messageId, aiFeedback.userId],
        set: { rating, reason: trimmed, mode, usedWeb, updatedAt: new Date() },
      });
    return { rating };
  }

  async listForConversation(tenantId: string, userId: string, conversationId: string): Promise<
    Array<{ messageId: string; rating: number }>
  > {
    return this.drizzle.db
      .select({ messageId: aiFeedback.messageId, rating: aiFeedback.rating })
      .from(aiFeedback)
      .where(
        and(
          eq(aiFeedback.tenantId, tenantId),
          eq(aiFeedback.userId, userId),
          eq(aiFeedback.conversationId, conversationId),
        ),
      );
  }

  /** Aggregate signal for the admin dashboard. */
  async summary(tenantId: string): Promise<AiFeedbackSummary> {
    const [row] = await this.drizzle.db
      .select({
        total: sql<number>`count(*)::int`,
        helpful: sql<number>`count(*) filter (where ${aiFeedback.rating} > 0)::int`,
        unhelpful: sql<number>`count(*) filter (where ${aiFeedback.rating} < 0)::int`,
        webTotal: sql<number>`count(*) filter (where ${aiFeedback.usedWeb})::int`,
        webHelpful: sql<number>`count(*) filter (where ${aiFeedback.usedWeb} and ${aiFeedback.rating} > 0)::int`,
      })
      .from(aiFeedback)
      .where(eq(aiFeedback.tenantId, tenantId));

    const total = Number(row?.total ?? 0);
    const helpful = Number(row?.helpful ?? 0);
    const unhelpful = Number(row?.unhelpful ?? 0);
    const webTotal = Number(row?.webTotal ?? 0);
    const webHelpful = Number(row?.webHelpful ?? 0);
    return {
      total,
      helpful,
      unhelpful,
      score: total ? Number((((helpful - unhelpful) / total) as number).toFixed(4)) : 0,
      webAnswered: webTotal,
      // Null rather than 0 when nobody has rated a web answer: "no data" and
      // "universally disliked" are different facts.
      webHelpfulRate: webTotal ? Number((webHelpful / webTotal).toFixed(4)) : null,
    };
  }

  /** Worst-rated recent answers: the raw material for the next eval case. */
  async recent(tenantId: string, limit = 20): Promise<
    Array<{
      messageId: string;
      rating: number;
      reason: string | null;
      mode: string | null;
      usedWeb: boolean;
      createdAt: Date;
      content: string;
    }>
  > {
    const rows = await this.drizzle.db
      .select({
        messageId: aiFeedback.messageId,
        rating: aiFeedback.rating,
        reason: aiFeedback.reason,
        mode: aiFeedback.mode,
        usedWeb: aiFeedback.usedWeb,
        createdAt: aiFeedback.createdAt,
        content: aiMessages.content,
        conversationId: aiFeedback.conversationId,
      })
      .from(aiFeedback)
      .innerJoin(aiMessages, eq(aiMessages.id, aiFeedback.messageId))
      .where(eq(aiFeedback.tenantId, tenantId))
      .orderBy(desc(aiFeedback.createdAt))
      .limit(Math.min(Math.max(limit, 1), 100));
    return rows.map((row) => ({
      messageId: row.messageId,
      rating: row.rating,
      reason: row.reason,
      mode: row.mode,
      usedWeb: row.usedWeb,
      createdAt: row.createdAt,
      content: String(row.content ?? '').slice(0, 400),
    }));
  }

  /** Seed a conversation's existence check for the eval harness. */
  async conversationOwnedBy(tenantId: string, conversationId: string, userId: string): Promise<boolean> {
    const [row] = await this.drizzle.db
      .select({ id: aiConversations.id })
      .from(aiConversations)
      .where(
        and(
          eq(aiConversations.id, conversationId),
          eq(aiConversations.tenantId, tenantId),
          eq(aiConversations.userId, userId),
        ),
      )
      .limit(1);
    return Boolean(row);
  }
}
