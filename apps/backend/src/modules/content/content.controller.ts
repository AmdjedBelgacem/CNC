import { Controller, Get, Param, NotFoundException, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { ContentService } from './content.service';
import { NavigationService } from '../builder/navigation.service';

@ApiTags('content')
@Controller('content')
export class ContentController {
  constructor(
    private content: ContentService,
    private navigation: NavigationService,
  ) {}

  @Get('pages/:slug')
  @ApiOperation({ summary: 'Public: published layout for a page slug' })
  async getPublishedPage(@CurrentTenant() tenant: any, @Param('slug') slug: string, @Req() req: any) {
    if (!tenant?.id) throw new NotFoundException('Tenant not resolved');
    // Cookie, then `?locale=`, then Accept-Language.
    return this.content.getPublishedPage(tenant.id, slug, req);
  }

  @Get('pages')
  @ApiOperation({ summary: 'Public: every published, enabled page for the tenant' })
  async listPublishedPages(@CurrentTenant() tenant: any) {
    if (!tenant?.id) throw new NotFoundException('Tenant not resolved');
    return this.content.listPublishedPages(tenant.id);
  }

  @Get('navigation')
  @ApiOperation({ summary: 'Public: the tenant navigation tree, localized and pruned' })
  async getNavigation(@CurrentTenant() tenant: any, @Req() req: any) {
    if (!tenant?.id) throw new NotFoundException('Tenant not resolved');
    // Cookie, then `?locale=`, then Accept-Language — same order as a page.
    const locale = req.cookies?.locale === 'ar' || req.query?.locale === 'ar' ? 'ar' : 'en';
    return this.navigation.getPublicTree(tenant.id, locale);
  }

  @Get('themes/current')
  @ApiOperation({ summary: 'Public: published theme tokens for the tenant' })
  async getPublishedTheme(@CurrentTenant() tenant: any) {
    if (!tenant?.id) throw new NotFoundException('Tenant not resolved');
    return this.content.getPublishedTheme(tenant.id);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Public: allowlisted analytics measurement IDs (GA4 / Snapchat)' })
  async getPublicAnalytics(@CurrentTenant() tenant: any) {
    if (!tenant?.id) throw new NotFoundException('Tenant not resolved');
    return this.content.getPublicAnalytics(tenant.id);
  }
}
