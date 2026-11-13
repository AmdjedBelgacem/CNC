import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { RepairService } from './repair.service';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateRepairShopDto, UpdateRepairShopDto } from './dto/repair.dto';

@ApiTags('repair')
@Controller('repair')
export class RepairController {
  constructor(private repair: RepairService) {}

  @Public()
  @TenantScoped()
  @Get()
  @ApiOperation({ summary: 'List repair shops with filters' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(
    @CurrentTenant() tenant: { id: string },
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.repair.findAll(tenant.id, {
      category,
      search,
      page: page ? +page || undefined : undefined,
      limit: limit ? +limit || undefined : undefined,
    });
  }

  @Public()
  @TenantScoped()
  @Get(':id')
  @ApiOperation({ summary: 'Get repair shop by ID' })
  findById(@CurrentTenant() tenant: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.repair.findById(tenant.id, id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a repair shop listing' })
  create(@CurrentTenant() tenant: { id: string }, @Body() body: CreateRepairShopDto) {
    return this.repair.create(tenant.id, body);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a repair shop' })
  update(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateRepairShopDto,
  ) {
    return this.repair.update(tenant.id, id, body);
  }
}
