import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DmService } from './dm.service';

@ApiTags('dm')
@Controller('dm')
@UseGuards(JwtAuthGuard)
export class DmController {
  constructor(private dm: DmService) {}

  @Post('conversations')
  @ApiOperation({ summary: 'Idempotent 1:1 conversation create' })
  createConversation(@CurrentUser() user: { id: string; tenantId: string }, @Body() body: { peerId: string }) {
    return this.dm.createOrGetConversation(user.tenantId, user.id, body.peerId);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'List my DM conversations with unread counts' })
  listConversations(@CurrentUser() user: { id: string; tenantId: string }) {
    return this.dm.listConversations(user.tenantId, user.id);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Get messages for a DM conversation (tenant + membership checked)' })
  getMessages(
    @CurrentUser() user: { id: string; tenantId: string },
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    return this.dm.getMessages(user.tenantId, user.id, id, limit ? Number(limit) : 50);
  }

  @Post('messages')
  @ApiOperation({ summary: 'Send a DM message (block + membership checked)' })
  sendMessage(@CurrentUser() user: { id: string; tenantId: string }, @Body() body: { conversationId: string; body: string }) {
    return this.dm.sendMessage(user.tenantId, user.id, body.conversationId, body.body);
  }

  @Post('read')
  @ApiOperation({ summary: 'Mark conversation as read up to messageId' })
  markRead(
    @CurrentUser() user: { id: string; tenantId: string },
    @Body() body: { conversationId: string; messageId: string },
  ) {
    return this.dm.markRead(user.tenantId, user.id, body.conversationId, body.messageId);
  }
}
