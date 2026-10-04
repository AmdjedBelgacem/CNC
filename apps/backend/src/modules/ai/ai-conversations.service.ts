import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import {
  aiConversations,
  aiMessages,
  type AiSourceRef,
} from '../../database/schema/ai-assistant';

const TITLE_MAX = 120;
/** Used when a caller does not declare a generation (e.g. a hand-written turn). */
const PROMPT_VERSION_FALLBACK = 'v1';
const PAGE_MAX = 50;

/** Trims a first user message into a conversation title. */
export function deriveTitle(message: string, fallback = 'New conversation'): string {
  const flat = (message || '').replace(/\s+/g, ' ').trim();
  if (!flat) return fallback;
  const sentence = flat.split(/(?<=[.!?؟])\s/)[0] ?? flat;
  const clipped = sentence.length > TITLE_MAX ? `${sentence.slice(0, TITLE_MAX - 1).trimEnd()}…` : sentence;
  return clipped || fallback;
}

export interface AiConversationSummary {
  id: string;
  title: string;
  source: string;
  sourceRef: AiSourceRef | null;
  status: string;
  lastMessageAt: string;
  createdAt: string;
  messageCount: number;
  lastMessage: string | null;
}

export interface AiConversationDetail extends AiConversationSummary {
  messages: {
    id: string;
    role: string;
    content: string;
    citations: unknown[] | null;
    meta: Record<string, unknown> | null;
    createdAt: string;
  }[];
}

@Injectable()
export class AiConversationsService {
  constructor(private readonly drizzle: DrizzleService) {}

  /**
   * Lists the caller's conversations. Scoped by BOTH user and tenant, with the
   * tenant predicate repeated in SQL rather than trusted from the caller.
   */
  async list(
    tenantId: string,
    userId: string,
    opts: { status?: 'active' | 'archived'; search?: string; page?: number; limit?: number } = {},
  ): Promise<{ data: AiConversationSummary[]; total: number; page: number; limit: number }> {
    const status = opts.status ?? 'active';
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(Math.max(opts.limit ?? 30, 1), PAGE_MAX);
    const search = opts.search?.trim().slice(0, 120);

    const conditions: SQL[] = [
      eq(aiConversations.tenantId, tenantId),
      eq(aiConversations.userId, userId),
      eq(aiConversations.status, status),
    ];
    if (search) {
      // History search spans the title, the attached reference, and message bodies:
      // users recall "the one about spindle power", not the auto-generated title.
      const pattern = `%${search}%`;
      conditions.push(
        or(
          ilike(aiConversations.title, pattern),
          sql`coalesce(${aiConversations.sourceRef}->>'title','') ilike ${pattern}`,
          sql`coalesce(${aiConversations.sourceRef}->>'author','') ilike ${pattern}`,
          sql`exists (select 1 from ${aiMessages} m where m.conversation_id = ${aiConversations.id} and m.content ilike ${pattern})`,
        )!,
      );
    }

    const where = and(...conditions);
    const rows = await this.drizzle.db.query.aiConversations.findMany({
      where,
      orderBy: [desc(aiConversations.lastMessageAt)],
      limit,
      offset: (page - 1) * limit,
    });
    const [totalRow] = await this.drizzle.db
      .select({ count: sql<number>`count(*)::int` })
      .from(aiConversations)
      .where(where);

    const ids = rows.map((row) => row.id);

    // Counts + opening line for the page of conversations, in two round trips.
    const counts = ids.length
      ? await this.drizzle.db
          .select({
            conversationId: aiMessages.conversationId,
            count: sql<number>`count(*)::int`,
          })
          .from(aiMessages)
          .where(inArray(aiMessages.conversationId, ids))
          .groupBy(aiMessages.conversationId)
      : [];
    const countById = new Map(counts.map((row) => [row.conversationId, Number(row.count)]));

    const openings = ids.length
      ? await this.drizzle.db
          .select({
            conversationId: aiMessages.conversationId,
            content: aiMessages.content,
            createdAt: aiMessages.createdAt,
          })
          .from(aiMessages)
          .where(and(inArray(aiMessages.conversationId, ids), eq(aiMessages.role, 'user')))
          .orderBy(aiMessages.createdAt)
      : [];
    const openingById = new Map<string, string>();
    for (const row of openings) {
      // Rows arrive oldest-first, so the first write per conversation wins.
      if (!openingById.has(row.conversationId)) openingById.set(row.conversationId, row.content);
    }

    return {
      data: rows.map((row) =>
        this.toSummary(row, countById.get(row.id) ?? 0, openingById.get(row.id) ?? null),
      ),
      total: Number(totalRow?.count ?? 0),
      page,
      limit,
    };
  }

  /** A conversation plus its transcript. Ownership is enforced, not assumed. */
  async get(tenantId: string, userId: string, conversationId: string): Promise<AiConversationDetail> {
    const [row] = await this.drizzle.db.query.aiConversations.findMany({
      where: and(
        eq(aiConversations.id, conversationId),
        eq(aiConversations.tenantId, tenantId),
        eq(aiConversations.userId, userId),
      ),
      limit: 1,
    });
    if (!row) throw new NotFoundException('Conversation not found');

    const messages = await this.drizzle.db.query.aiMessages.findMany({
      where: and(
        eq(aiMessages.conversationId, conversationId),
        eq(aiMessages.tenantId, tenantId),
        eq(aiMessages.userId, userId),
      ),
      orderBy: [aiMessages.createdAt],
      limit: 500,
    });

    return {
      ...this.toSummary(row, messages.length, null),
      messages: messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        citations: (message.citations as unknown[] | null) ?? null,
        meta: (message.meta as Record<string, unknown> | null) ?? null,
        createdAt: message.createdAt.toISOString(),
      })),
    };
  }

  async create(
    tenantId: string,
    userId: string,
    input: { title?: string; source?: string; sourceRef?: AiSourceRef | null },
  ): Promise<{ id: string; title: string; source: string; sourceRef: AiSourceRef | null; createdAt: string }> {
    const [row] = await this.drizzle.db
      .insert(aiConversations)
      .values({
        tenantId,
        userId,
        title: input.title?.trim().slice(0, 200) || null,
        source: (input.source ?? 'general').slice(0, 32),
        sourceRef: input.sourceRef ?? null,
      })
      .returning();
    if (!row) throw new NotFoundException('Conversation not found');
    const created = row;
    return {
      id: created.id,
      title: created.title ?? 'New conversation',
      source: created.source,
      sourceRef: (created.sourceRef as AiSourceRef | null) ?? null,
      createdAt: created.createdAt.toISOString(),
    };
  }

  async update(
    tenantId: string,
    userId: string,
    conversationId: string,
    patch: { title?: string; status?: 'active' | 'archived' },
  ) {
    const [row] = await this.drizzle.db
      .update(aiConversations)
      .set({
        ...(patch.title !== undefined ? { title: patch.title.trim().slice(0, 200) || null } : {}),
        ...(patch.status ? { status: patch.status } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(aiConversations.id, conversationId),
          eq(aiConversations.tenantId, tenantId),
          eq(aiConversations.userId, userId),
        ),
      )
      .returning();
    if (!row) throw new NotFoundException('Conversation not found');
    return this.toSummary(row, 0, null);
  }

  /** Soft delete: the row is archived so nothing is destroyed. */
  async archive(tenantId: string, userId: string, conversationId: string) {
    return this.update(tenantId, userId, conversationId, { status: 'archived' });
  }

  /**
   * Resolves the conversation a request appends to, creating one when the caller
   * sent no id. A conversation owned by someone else (or in another tenant) is
   * never silently reused — it 403s.
   */
  async resolveForAppend(
    tenantId: string,
    userId: string,
    conversationId: string | undefined,
    seed: { message: string; source: string; sourceRef?: AiSourceRef | null },
  ): Promise<{ id: string; source: string; sourceRef: AiSourceRef | null }> {
    if (!conversationId) {
      const created = await this.create(tenantId, userId, {
        title: deriveTitle(seed.message),
        source: seed.source,
        sourceRef: seed.sourceRef ?? null,
      });
      return { id: created.id, source: created.source, sourceRef: created.sourceRef };
    }

    const [row] = await this.drizzle.db.query.aiConversations.findMany({
      where: eq(aiConversations.id, conversationId),
      limit: 1,
    });
    if (!row) throw new NotFoundException('Conversation not found');
    if (String(row.tenantId) !== String(tenantId) || String(row.userId) !== String(userId)) {
      throw new ForbiddenException('Conversation access denied');
    }
    // Archived threads are read-only. A new turn continues in a fresh conversation
    // instead of silently re-activating a thread the user removed from history.
    if (row.status === 'archived') {
      const created = await this.create(tenantId, userId, {
        title: deriveTitle(seed.message),
        source: seed.source,
        sourceRef: (row.sourceRef as AiSourceRef | null) ?? seed.sourceRef ?? null,
      });
      return { id: created.id, source: created.source, sourceRef: created.sourceRef };
    }
    // A conversation started from a post keeps that grounding for its life.
    return {
      id: row.id,
      source: row.source,
      sourceRef: (row.sourceRef as AiSourceRef | null) ?? seed.sourceRef ?? null,
    };
  }

  async appendMessage(
    tenantId: string,
    userId: string,
    conversationId: string,
    input: {
      role: 'user' | 'assistant' | 'system';
      content: string;
      citations?: unknown[] | null;
      meta?: Record<string, unknown> | null;
      /**
       * Which prompt generation produced a stored answer. Without it a stored
       * message cannot be compared against an eval run, which is the whole
       * point of recording it.
       */
      promptVersion?: string;
    },
  ) {
    const [row] = await this.drizzle.db
      .insert(aiMessages)
      .values({
        conversationId,
        tenantId,
        userId,
        role: input.role,
        content: input.content,
        promptVersion: input.promptVersion ?? PROMPT_VERSION_FALLBACK,
        citations: input.citations ?? null,
        // The caller whitelists meta; nothing here holds a provider credential.
        meta: input.meta ?? null,
      })
      .returning({ id: aiMessages.id, createdAt: aiMessages.createdAt });
    if (!row) throw new NotFoundException('Message not stored');

    // The title comes from the first user message, so an explicitly created
    // conversation is named as soon as it actually has content.
    const patch: Record<string, unknown> = {
      lastMessageAt: new Date(),
      updatedAt: new Date(),
    };
    if (input.role === 'user') {
      const [conversation] = await this.drizzle.db.query.aiConversations.findMany({
        where: eq(aiConversations.id, conversationId),
        columns: { title: true },
        limit: 1,
      });
      if (conversation && !conversation.title) patch.title = deriveTitle(input.content);
    }
    await this.drizzle.db
      .update(aiConversations)
      .set(patch)
      .where(eq(aiConversations.id, conversationId));
    return { id: row.id, createdAt: row.createdAt.toISOString() };
  }

  private toSummary(
    row: {
      id: string;
      title: string | null;
      source: string;
      sourceRef: unknown;
      status: string;
      lastMessageAt: Date;
      createdAt: Date;
    },
    messageCount: number,
    lastMessage: string | null,
  ): AiConversationSummary {
    return {
      id: row.id,
      title: row.title || 'New conversation',
      source: row.source,
      sourceRef: (row.sourceRef as AiSourceRef | null) ?? null,
      status: row.status,
      lastMessageAt: row.lastMessageAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      messageCount,
      lastMessage: lastMessage ? lastMessage.slice(0, 160) : null,
    };
  }
}
