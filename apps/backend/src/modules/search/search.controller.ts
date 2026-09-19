import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

@ApiTags('search')
@Controller('search')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SearchController {
  constructor(private searchService: SearchService) {}

  @Public()
  @Get('public')
  @ApiOperation({ summary: 'Public search — tenant-isolated, published-only (courses, products, posts, events, people)' })
  searchPublic(
    @Query('q') query: string,
    @CurrentTenant() tenant: { id: string },
  ) {
    return this.searchService.searchPublic(query, tenant?.id);
  }

  @Get()
  @Roles('super_admin', 'admin', 'instructor')
  @ApiOperation({ summary: 'Tenant-scoped global search across courses, series, lessons and users' })
  search(
    @Query('q') query: string,
    @CurrentTenant() tenant: { id: string },
  ) {
    return this.searchService.search(query, tenant.id);
  }
}
