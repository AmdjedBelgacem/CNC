import { Controller, Get, Param, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { AcademiesService } from './academies.service';

// Public academy endpoints — tenant resolved by TenantResolveGuard from
// x-tenant-slug (first-active fallback), same as /courses. Only published,
// non-archived academies are exposed.
@ApiTags('academies')
@Public()
@TenantScoped()
@Controller('academies')
export class AcademiesController {
  constructor(private academies: AcademiesService) {}

  @Get()
  @ApiOperation({ summary: 'Public: list published academies for the tenant' })
  findAll(@CurrentTenant() tenant: { id: string }, @Req() req: any) {
    // The resolver reads the locale cookie, then `?locale=`, then the browser
    // header, so the caller does not have to pass it explicitly.
    return this.academies.findPublished(tenant.id, req);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Public: academy detail with its published courses' })
  findBySlug(@CurrentTenant() tenant: { id: string }, @Param('slug') slug: string, @Req() req: any) {
    return this.academies.findPublishedBySlug(tenant.id, slug, req);
  }
}
