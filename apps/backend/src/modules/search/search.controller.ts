import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';

@ApiTags('search')
@Controller('search')
@UseGuards(JwtAuthGuard, RolesGuard, TenantScopeGuard)
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Public()
  @Get('public')
  @ApiOperation({ summary: 'Published, tenant-scoped public search' })
  searchPublic(
    @Query('q') query: string,
    @Query('types') types: string | undefined,
    @Query('type') type: string | undefined,
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('sort') sort: string | undefined,
    @CurrentTenant() tenant: { id: string },
  ) {
    return this.search.searchPublic(query, tenant?.id, {
      types: types ?? type,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      sort: sort === 'title' || sort === 'newest' ? sort : 'relevance',
    });
  }

  @Public()
  @Get('suggest')
  @ApiOperation({ summary: 'Public search typeahead' })
  suggest(
    @Query('q') query: string,
    @CurrentTenant() tenant: { id: string },
  ) {
    return this.search.suggest(query, tenant?.id);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Published, tenant-scoped public search' })
  searchDefault(
    @Query('q') query: string,
    @Query('types') types: string | undefined,
    @Query('type') type: string | undefined,
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('sort') sort: string | undefined,
    @CurrentTenant() tenant: { id: string },
  ) {
    return this.search.searchPublic(query, tenant?.id, {
      types: types ?? type,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      sort: sort === 'title' || sort === 'newest' ? sort : 'relevance',
    });
  }
}

@ApiTags('search')
@ApiBearerAuth()
@Controller('admin/search')
@UseGuards(JwtAuthGuard, RolesGuard, TenantScopeGuard)
export class AdminSearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @Roles('super_admin', 'admin', 'instructor')
  @ApiOperation({ summary: 'Administrative search alias' })
  search(
    @Query('q') query: string,
    @Query('types') types: string | undefined,
    @Query('type') type: string | undefined,
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('sort') sort: string | undefined,
    @CurrentUser() user: { id: string; tenantId: string },
  ) {
    return this.searchService.searchAdmin(query, user.tenantId, {
      types: types ?? type,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      sort: sort === 'title' || sort === 'newest' ? sort : 'relevance',
    });
  }

  @Post('reindex')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Rebuild the current tenant search index' })
  reindex(@CurrentUser() user: { tenantId: string }) {
    return this.searchService.reindexTenant(user.tenantId);
  }
}
