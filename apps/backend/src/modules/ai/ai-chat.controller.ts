import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { AiChatService } from './ai-chat.service';
import { AiSettingsService } from './ai-settings.service';
import { AiConversationsService } from './ai-conversations.service';
import { AiFeedbackService } from './ai-feedback.service';
import { AiChatDto, AiFeedbackDto, CreateAiConversationDto, UpdateAiConversationDto } from './dto/ai.dto';
import type { AiViewer } from './ai.types';

@ApiTags('ai')
@Controller('ai')
export class AiChatController {
  constructor(
    private readonly chat: AiChatService,
    private readonly settings: AiSettingsService,
    private readonly conversations: AiConversationsService,
    private readonly feedback: AiFeedbackService,
  ) {}

  // ------------------------------------------------------------------
  // Saved conversations. Every route is user- AND tenant-scoped, and the
  // scoping happens in SQL rather than being trusted from the caller.
  // ------------------------------------------------------------------

  @Get('conversations')
  @TenantScoped()
  @UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my AI conversations' })
  listConversations(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: AiViewer,
    @Query('status') status?: 'active' | 'archived',
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.conversations.list(tenant.id, String(user.id), {
      status: status === 'archived' ? 'archived' : 'active',
      search,
      page: page ? +page : 1,
      limit: limit ? +limit : 30,
    });
  }

  /**
   * Rate an answer. Tenant + owner are proven from the message row itself, so a
   * member cannot rate — or probe for — somebody else's transcript.
   */
  @Post('messages/:messageId/feedback')
  @TenantScoped()
  @UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rate an assistant answer (1 / -1, 0 clears)' })
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  async rateMessage(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: AiViewer,
    @Param('messageId') messageId: string,
    @Body() dto: AiFeedbackDto,
  ) {
    return this.feedback.rate(tenant.id, String(user.id), messageId, dto.rating, dto.reason ?? null);
  }

  @Get('conversations/:id/feedback')
  @TenantScoped()
  @UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'My votes on a conversation' })
  async myFeedback(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: AiViewer,
    @Param('id') conversationId: string,
  ) {
    return { data: await this.feedback.listForConversation(tenant.id, String(user.id), conversationId) };
  }

  @Post('conversations')
  @TenantScoped()
  @UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create an empty AI conversation' })
  async createConversation(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: AiViewer,
    @Body() dto: CreateAiConversationDto,
  ) {
    return this.conversations.create(tenant.id, String(user.id), {
      title: dto.title,
      source: dto.source,
      sourceRef: dto.sourceRef ?? null,
    });
  }

  @Get('conversations/:id')
  @TenantScoped()
  @UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Read one AI conversation with its transcript' })
  getConversation(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: AiViewer,
    @Param('id') id: string,
  ) {
    return this.conversations.get(tenant.id, String(user.id), id);
  }

  @Patch('conversations/:id')
  @TenantScoped()
  @UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rename or archive an AI conversation' })
  updateConversation(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: AiViewer,
    @Param('id') id: string,
    @Body() dto: UpdateAiConversationDto,
  ) {
    return this.conversations.update(tenant.id, String(user.id), id, dto);
  }

  @Delete('conversations/:id')
  @TenantScoped()
  @UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Archive (soft delete) an AI conversation' })
  async deleteConversation(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: AiViewer,
    @Param('id') id: string,
  ) {
    const archived = await this.conversations.archive(tenant.id, String(user.id), id);
    return { archived: true, conversation: archived };
  }

  @Post('chat')
  @TenantScoped()
  @UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ask the tenant-scoped AI assistant' })
  authenticatedChat(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: AiViewer,
    @Body() dto: AiChatDto,
    @Req() request: { ip?: string; headers?: Record<string, string | string[] | undefined> },
  ) {
    return this.chat.chat(tenant.id, dto, user, {
      ip: request.ip,
      userAgent: typeof request.headers?.['user-agent'] === 'string' ? request.headers['user-agent'] : undefined,
    });
  }

  @Public()
  @Post('public-chat')
  @TenantScoped()
  @UseGuards(OptionalAuthGuard, TenantGuard, TenantScopeGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Ask the explicitly enabled public AI assistant' })
  publicChat(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: AiViewer | null,
    @Body() dto: AiChatDto,
    @Req() request: { ip?: string; headers?: Record<string, string | string[] | undefined> },
  ) {
    return this.chat.chat(tenant.id, dto, user, {
      ip: request.ip,
      userAgent: typeof request.headers?.['user-agent'] === 'string' ? request.headers['user-agent'] : undefined,
    }, { publicMode: true });
  }

  @Public()
  @Get('config')
  @TenantScoped()
  @UseGuards(TenantGuard, TenantScopeGuard)
  @ApiOperation({ summary: 'Get non-sensitive public AI availability' })
  publicConfig(@CurrentTenant() tenant: { id: string }) {
    return this.settings.getPublicStatus(tenant.id);
  }
}
