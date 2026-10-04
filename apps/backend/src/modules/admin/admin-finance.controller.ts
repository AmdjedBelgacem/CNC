import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FinanceService } from './finance.service';
import { CreateBudgetDto, UpdateBudgetDto, UpdateOrderStatusDto } from './dto/finance.dto';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('admin-finance')
@Controller('admin')
@UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard, RolesGuard)
@ApiBearerAuth()
export class AdminFinanceController {
  constructor(private finance: FinanceService) {}

  @Get('finance/summary')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Finance summary (revenue, pending, refunds)' })
  getSummary(@CurrentTenant() tenant: { id: string }) {
    return this.finance.getSummary(tenant.id);
  }

  @Get('budgets')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'List finance budgets with actuals' })
  listBudgets(@CurrentTenant() tenant: { id: string }) {
    return this.finance.listBudgets(tenant.id);
  }

  @Post('budgets')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Create a finance budget' })
  createBudget(@CurrentTenant() tenant: { id: string }, @Body() body: CreateBudgetDto) {
    return this.finance.createBudget(tenant.id, body);
  }

  @Patch('budgets/:id')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Update a finance budget' })
  updateBudget(
    @CurrentTenant() tenant: { id: string },
    @Param('id') id: string,
    @Body() body: UpdateBudgetDto,
  ) {
    return this.finance.updateBudget(tenant.id, id, body);
  }

  @Delete('budgets/:id')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Delete a finance budget' })
  deleteBudget(@CurrentTenant() tenant: { id: string }, @Param('id') id: string) {
    return this.finance.deleteBudget(tenant.id, id);
  }

  @Patch('orders/:id/status')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Update order status' })
  updateOrderStatus(
    @CurrentTenant() tenant: { id: string },
    @Param('id') id: string,
    @Body() body: UpdateOrderStatusDto,
  ) {
    return this.finance.updateOrderStatus(tenant.id, id, body.status);
  }
}
