import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { chatConversations, chatMessages } from '../../database/schema/chat';
import { eq, asc } from 'drizzle-orm';

@Injectable()
export class ChatService {
  constructor(private drizzle: DrizzleService) {}

  async createConversation(tenantId: string | undefined, userId: string | undefined, subject: string) {
    const [conv] = await this.drizzle.db.insert(chatConversations).values({
      tenantId,
      userId,
      subject,
    }).returning();
    return conv;
  }

  async addMessage(conversationId: string, senderId: string, senderType: string, content: string) {
    const [msg] = await this.drizzle.db.insert(chatMessages).values({
      conversationId,
      senderId,
      senderType,
      content,
    }).returning();
    await this.drizzle.db.update(chatConversations).set({ updatedAt: new Date() }).where(eq(chatConversations.id, conversationId));
    return msg;
  }

  /**
   * Load a conversation, but only for someone entitled to it.
   *
   * `getMessages` used to take a bare conversationId straight from the socket and
   * return every message. The gateway passed a client-supplied value straight
   * through, so any connected socket — including an anonymous support widget —
   * could read any support conversation it could name. Returns null when the
   * caller is neither the conversation's owner nor staff of its tenant.
   */
  async getConversationForViewer(conversationId: string, viewer: { userId?: string; tenantId?: string; role?: string }) {
    if (typeof conversationId !== 'string' || !/^[0-9a-fA-F-]{36}$/.test(conversationId)) return null;
    const conv = await this.drizzle.db.query.chatConversations.findFirst({
      where: eq(chatConversations.id, conversationId),
    });
    if (!conv) return null;
    if (viewer.userId && conv.userId && String(conv.userId) === String(viewer.userId)) return conv;
    // Staff of the owning tenant may read any of its conversations. A tenant
    // mismatch is checked before the role so a role from one tenant cannot read
    // another tenant's chats.
    const isStaff = ['super_admin', 'admin', 'instructor', 'moderator', 'support'].includes(String(viewer.role));
    if (isStaff && viewer.tenantId && String(conv.tenantId) === String(viewer.tenantId)) return conv;
    return null;
  }

  async getMessages(conversationId: string) {
    return this.drizzle.db.select().from(chatMessages)
      .where(eq(chatMessages.conversationId, conversationId))
      .orderBy(asc(chatMessages.createdAt));
  }

  async getConversations(tenantId: string) {
    return this.drizzle.db.select().from(chatConversations)
      .where(eq(chatConversations.tenantId, tenantId))
      .orderBy(asc(chatConversations.updatedAt));
  }
}
