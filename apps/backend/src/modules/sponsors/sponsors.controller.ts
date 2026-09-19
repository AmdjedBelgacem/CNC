import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SponsorsService } from './sponsors.service';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

@ApiTags('sponsors')
@Controller('sponsors')
export class SponsorsController {
  constructor(private sponsors: SponsorsService) {}

  @Get()
  @ApiOperation({ summary: 'List sponsors for tenant' })
  findAll(@CurrentTenant() tenant: { id: string }) {
    return this.sponsors.findByTenant(tenant.id);
  }
}
