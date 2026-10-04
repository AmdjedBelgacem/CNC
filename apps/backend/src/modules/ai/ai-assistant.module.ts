import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiCoreModule } from './ai-core.module';
import { AiAdminController } from './ai-admin.controller';
import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './ai-chat.service';
import { AiConversationsService } from './ai-conversations.service';
import { AiEvalService } from './ai-eval.service';

@Module({
  imports: [AuthModule, AiCoreModule],
  controllers: [AiAdminController, AiChatController],
  // AiEvalService lives here, not in the global core module: it depends on
  // AiChatService, which is scoped to this module.
  providers: [AiChatService, AiConversationsService, AiEvalService],
})
export class AiAssistantModule {}
