import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { ContentService } from './content.service';

@ApiTags('content')
@Controller('content')
export class ContentController {
  constructor(private content: ContentService) {}

  @Get('pages/:slug')
  @ApiOperation({ summary: 'Public: published layout for a page slug' })
  async getPublishedPage(@CurrentTenant() tenant: any, @Param('slug') slug: string) {
    if (!tenant?.id) throw new NotFoundException('Tenant not resolved');
    return this.content.getPublishedPage(tenant.id, slug);
  }

  @Get('themes/current')
  @ApiOperation({ summary: 'Public: published theme tokens for the tenant' })
  async getPublishedTheme(@CurrentTenant() tenant: any) {
    if (!tenant?.id) throw new NotFoundException('Tenant not resolved');
    return this.content.getPublishedTheme(tenant.id);
  }
}
