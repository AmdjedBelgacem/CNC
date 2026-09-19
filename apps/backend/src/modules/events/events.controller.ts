import { Controller, Get, Post, Patch, Delete, Param, Query, Body, HttpCode, HttpStatus, UseGuards, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { EventsService } from './events.service';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private events: EventsService) {}

  @Public()
  @TenantScoped()
  @Get()
  @ApiOperation({ summary: 'List published events' })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'upcoming', required: false })
  findAll(
    @CurrentTenant() tenant: { id: string },
    @Query('type') type?: string,
    @Query('upcoming') upcoming?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.events.findByTenant(tenant.id, {
      type,
      upcoming: upcoming === 'true',
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
  }

  @Public()
  @TenantScoped()
  @Get('upcoming')
  @ApiOperation({ summary: 'Get upcoming events (limit 3)' })
  getUpcoming(
    @CurrentTenant() tenant: { id: string },
    @Query('limit') limit?: string,
  ) {
    return this.events.getUpcoming(tenant.id, limit ? +limit : 3);
  }

  @Public()
  @TenantScoped()
  @Get(':slug')
  @ApiOperation({ summary: 'Get event by slug' })
  findBySlug(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { id: string } | undefined,
    @Param('slug') slug: string,
  ) {
    return this.events.findBySlug(tenant.id, slug, user?.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard, TenantScopeGuard)
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Create an event' })
  create(
    @CurrentTenant() tenant: { id: string },
    @Body() body: any,
  ) {
    return this.events.create({ ...body, tenantId: tenant.id });
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard, TenantScopeGuard)
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Update an event' })
  update(
    @CurrentTenant() tenant: { id: string },
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.events.update(id, body, tenant.id);
  }

  @Post(':id/register')
  @UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register for an event' })
  register(
    @CurrentUser() user: { id: string } | undefined,
    @Param('id') id: string,
  ) {
    if (!user?.id) throw new UnauthorizedException('Authentication required');
    return this.events.register(id, user.id);
  }

  @Delete(':id/register')
  @UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel event registration' })
  cancelRegistration(
    @CurrentUser() user: { id: string } | undefined,
    @Param('id') id: string,
  ) {
    if (!user?.id) throw new UnauthorizedException('Authentication required');
    return this.events.cancelRegistration(id, user.id);
  }
}
