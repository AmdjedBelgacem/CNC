import { Controller, Get, Param, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get(':id')
  @UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user by ID (tenant-scoped)' })
  async findById(@Param('id') id: string, @CurrentUser() user: any) {
    // TenantScopeGuard already ensures request tenant == user tenant (or allowed multi-tenant).
    // Enforce tenant isolation at query level: only return user within caller's tenant.
    const callerTenantId = String(user.tenantId || '');
    const result = await this.users.findByIdScoped(id, callerTenantId);
    if (!result) throw new NotFoundException('User not found');
    return result;
  }
}
