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
