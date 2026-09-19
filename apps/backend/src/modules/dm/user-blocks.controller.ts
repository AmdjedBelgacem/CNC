import { Controller, Post, Delete, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DmService } from './dm.service';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserBlocksController {
  constructor(private dm: DmService) {}

  @Post(':id/block')
  @ApiOperation({ summary: 'Block a user (tenant-isolated)' })
  block(@CurrentUser() user: { id: string; tenantId: string }, @Param('id') id: string) {
    return this.dm.blockUser(user.tenantId, user.id, id);
  }

  @Delete(':id/block')
  @ApiOperation({ summary: 'Unblock a user' })
  unblock(@CurrentUser() user: { id: string; tenantId: string }, @Param('id') id: string) {
    return this.dm.unblockUser(user.tenantId, user.id, id);
  }
}
