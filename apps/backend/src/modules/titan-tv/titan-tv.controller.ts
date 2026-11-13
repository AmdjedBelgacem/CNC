import { Controller, Get } from '@nestjs/common';
import { TitanTvService } from './titan-tv.service';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

@Controller('titan-tv')
export class TitanTvController {
  constructor(private svc: TitanTvService) {}

  @Get()
  async findAll(@CurrentTenant() tenant: { id: string } | null) {
    // No tenant, no library: this used to return every tenant's series and video URLs.
    if (!tenant?.id) return { data: [] };
    return { data: await this.svc.findAll(tenant.id) };
  }
}
